const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createFilterError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function assertSingleValue(value, fieldName) {
  if (typeof value !== 'string') {
    throw createFilterError(`${fieldName} must be a single value`);
  }
}

function parseEnumFilter(value, allowed, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  assertSingleValue(value, fieldName);

  if (!allowed.includes(value)) {
    throw createFilterError(`${fieldName} must be one of: ${allowed.join(', ')}`);
  }

  return value;
}

function parseUuidFilter(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  assertSingleValue(value, fieldName);

  if (!UUID_PATTERN.test(value)) {
    throw createFilterError(`${fieldName} must be a valid UUID`);
  }

  return value;
}

function parseDateFilter(value, fieldName) {
  if (value === undefined) {
    return undefined;
  }

  assertSingleValue(value, fieldName);

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    !DATE_PATTERN.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw createFilterError(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }

  return value;
}

function parseSearchFilter(value, fieldName, maxLength = 100) {
  if (value === undefined) {
    return undefined;
  }

  assertSingleValue(value, fieldName);

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw createFilterError(`${fieldName} must be at most ${maxLength} characters`);
  }

  return trimmed || undefined;
}

// Escapes LIKE/ILIKE wildcards so user input is always matched literally.
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

module.exports = {
  UUID_PATTERN,
  parseEnumFilter,
  parseUuidFilter,
  parseDateFilter,
  parseSearchFilter,
  escapeLikePattern,
};
