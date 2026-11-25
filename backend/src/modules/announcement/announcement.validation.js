const ANNOUNCEMENT_CATEGORIES = Object.freeze([
  'update',
  'meeting',
  'event',
  'contribution_reminder',
  'notice',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = ['title', 'body', 'category', 'eventAt', 'location', 'isPinned'];

function validationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateAnnouncementId(announcementId) {
  if (typeof announcementId !== 'string' || !UUID_PATTERN.test(announcementId)) {
    throw validationError('Announcement ID must be a valid UUID', 'INVALID_ANNOUNCEMENT_ID');
  }

  return announcementId;
}

function normalizeText(value, field, { min, max }) {
  if (typeof value !== 'string') {
    throw validationError(`${field} must be text`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    throw validationError(min > 1 ? `${field} must be at least ${min} characters` : `${field} is required`);
  }

  if (trimmed.length > max) {
    throw validationError(`${field} must not exceed ${max} characters`);
  }

  return trimmed;
}

function normalizeOptionalText(value, field, max) {
  if (value === null || value === undefined) return null;

  if (typeof value !== 'string') {
    throw validationError(`${field} must be text`);
  }

  const trimmed = value.trim();

  if (trimmed.length > max) {
    throw validationError(`${field} must not exceed ${max} characters`);
  }

  return trimmed || null;
}

function normalizeEventAt(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw validationError('eventAt must be a valid date and time');
  }

  return new Date(value).toISOString();
}

function validateAnnouncementInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError('Announcement details are required', 'INVALID_ANNOUNCEMENT_INPUT');
  }

  const unknown = Object.keys(input).filter((key) => !ALLOWED_FIELDS.includes(key));

  if (unknown.length > 0) {
    throw validationError(`Unsupported field: ${unknown[0]}`, 'INVALID_ANNOUNCEMENT_INPUT');
  }

  if (partial && Object.keys(input).length === 0) {
    throw validationError('At least one field must be provided', 'INVALID_ANNOUNCEMENT_INPUT');
  }

  const result = {};

  if (!partial || input.title !== undefined) {
    result.title = normalizeText(input.title, 'Title', { min: 3, max: 160 });
  }

  if (!partial || input.body !== undefined) {
    result.body = normalizeText(input.body, 'Message', { min: 1, max: 5000 });
  }

  if (input.category !== undefined || !partial) {
    const category = input.category === undefined ? 'update' : input.category;

    if (!ANNOUNCEMENT_CATEGORIES.includes(category)) {
      throw validationError(`category must be one of: ${ANNOUNCEMENT_CATEGORIES.join(', ')}`);
    }

    result.category = category;
  }

  if (input.eventAt !== undefined || !partial) {
    result.eventAt = normalizeEventAt(input.eventAt);
  }

  if (input.location !== undefined || !partial) {
    result.location = normalizeOptionalText(input.location, 'Location', 200);
  }

  if (input.isPinned !== undefined || !partial) {
    const isPinned = input.isPinned === undefined ? false : input.isPinned;

    if (typeof isPinned !== 'boolean') {
      throw validationError('isPinned must be true or false');
    }

    result.isPinned = isPinned;
  }

  return result;
}

module.exports = {
  ANNOUNCEMENT_CATEGORIES,
  validateAnnouncementId,
  validateAnnouncementInput,
};
