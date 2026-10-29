const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function createPaginationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function parseIntegerParam(value, fieldName, { defaultValue, min, max }) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw createPaginationError(`${fieldName} must be a valid integer`);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw createPaginationError(`${fieldName} must be between ${min} and ${max}`);
  }

  return number;
}

function parsePagination(query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) {
  return {
    limit: parseIntegerParam(query.limit, 'limit', {
      defaultValue: defaultLimit,
      min: 1,
      max: maxLimit,
    }),
    offset: parseIntegerParam(query.offset, 'offset', {
      defaultValue: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    }),
  };
}

function buildPagination({ limit, offset, count, total }) {
  return { limit, offset, count, total };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  buildPagination,
};
