const ALLOWED_PROFILE_FIELDS = new Set([
  'firstName',
  'middleName',
  'lastName',
  'displayName',
  'avatarUrl',
  'preferredLanguage',
  'timezone',
]);

function createValidationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateUpdateProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createValidationError(
      'A profile object is required',
      'INVALID_PROFILE_INPUT',
    );
  }

  const keys = Object.keys(input);

  if (keys.length === 0) {
    throw createValidationError(
      'At least one profile field must be provided',
      'NO_PROFILE_FIELDS',
    );
  }

  const unsupported = keys.filter(
    (key) => !ALLOWED_PROFILE_FIELDS.has(key),
  );

  if (unsupported.length > 0) {
    throw createValidationError(
      `Unsupported profile field: ${unsupported[0]}`,
      'UNSUPPORTED_PROFILE_FIELD',
    );
  }

  const result = {};

  for (const key of keys) {
    const value = input[key];

    if (value !== null && typeof value !== 'string') {
      throw createValidationError(
        `${key} must be a string or null`,
        'INVALID_PROFILE_FIELD',
      );
    }

    if (['firstName', 'lastName'].includes(key)) {
      if (typeof value !== 'string' || !value.trim()) {
        throw createValidationError(
          `${key} is required and cannot be empty`,
          'INVALID_PROFILE_NAME',
        );
      }

      if (value.trim().length > 100) {
        throw createValidationError(
          `${key} must not exceed 100 characters`,
          'INVALID_PROFILE_NAME',
        );
      }

      result[key] = value.trim();
      continue;
    }

    if (key === 'middleName' && value !== null && value.trim().length > 100) {
      throw createValidationError(
        'middleName must not exceed 100 characters',
        'INVALID_PROFILE_NAME',
      );
    }

    if (key === 'displayName' && value !== null && value.trim().length > 200) {
      throw createValidationError(
        'displayName must not exceed 200 characters',
        'INVALID_DISPLAY_NAME',
      );
    }

    if (key === 'preferredLanguage') {
      if (typeof value !== 'string' || !/^[a-z]{2}(-[A-Z]{2})?$/.test(value)) {
        throw createValidationError(
          'preferredLanguage must be a valid language code',
          'INVALID_PREFERRED_LANGUAGE',
        );
      }
    }

    if (key === 'timezone') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 64) {
        throw createValidationError(
          'timezone must be a non-empty string of at most 64 characters',
          'INVALID_TIMEZONE',
        );
      }
    }

    if (key === 'avatarUrl' && value !== null && value.trim()) {
      let parsedUrl;

      try {
        parsedUrl = new URL(value.trim());
      } catch {
        throw createValidationError(
          'avatarUrl must be a valid HTTP or HTTPS URL',
          'INVALID_AVATAR_URL',
        );
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw createValidationError(
          'avatarUrl must use HTTP or HTTPS',
          'INVALID_AVATAR_URL',
        );
      }
    }

    result[key] =
      typeof value === 'string' && value.trim() === ''
        ? null
        : typeof value === 'string'
          ? value.trim()
          : value;
  }

  return result;
}

module.exports = {
  validateUpdateProfileInput,
};
