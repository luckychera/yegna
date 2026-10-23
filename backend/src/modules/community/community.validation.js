const { parsePagination } = require('../../utils/pagination');
const {
  parseEnumFilter,
  parseSearchFilter,
} = require('../../utils/query-filters');
const { MEMBERSHIP_STATUSES } = require('../membership/membership.validation');

const COMMUNITY_TYPES = Object.freeze([
  'equb',
  'edir',
  'mahiber',
  'association',
  'neighborhood',
  'youth_group',
  'religious',
  'social',
  'professional',
  'other',
]);

function createValidationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateCreateCommunityInput(input) {
  const {
    name,
    description,
    communityType,
    logoUrl,
  } = input;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createValidationError(
      'Community name is required',
      'COMMUNITY_NAME_REQUIRED',
    );
  }

  if (name.trim().length > 200) {
    throw createValidationError(
      'Community name must not exceed 200 characters',
      'COMMUNITY_NAME_TOO_LONG',
    );
  }

  if (
    communityType === undefined ||
    communityType === null ||
    typeof communityType !== 'string'
  ) {
    throw createValidationError(
      'Community type is required',
      'COMMUNITY_TYPE_REQUIRED',
    );
  }

  if (!COMMUNITY_TYPES.includes(communityType)) {
    throw createValidationError(
      `Community type must be one of: ${COMMUNITY_TYPES.join(', ')}`,
      'INVALID_COMMUNITY_TYPE',
    );
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw createValidationError(
        'Community description must be a string',
        'INVALID_COMMUNITY_DESCRIPTION',
      );
    }
  }

  if (logoUrl !== undefined && logoUrl !== null) {
    if (typeof logoUrl !== 'string') {
      throw createValidationError(
        'Community logo URL must be a string',
        'INVALID_COMMUNITY_LOGO_URL',
      );
    }
  }

  return {
    name: name.trim(),
    description: description?.trim() || null,
    communityType,
    logoUrl: logoUrl?.trim() || null,
  };
}

function validateUpdateCommunityInput(input) {
  const { name, description, communityType, logoUrl } = input;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw createValidationError(
        'Community name must be a non-empty string',
        'INVALID_COMMUNITY_NAME',
      );
    }

    if (name.trim().length > 200) {
      throw createValidationError(
        'Community name must not exceed 200 characters',
        'COMMUNITY_NAME_TOO_LONG',
      );
    }
  }

  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      throw createValidationError(
        'Community description must be a string',
        'INVALID_COMMUNITY_DESCRIPTION',
      );
    }
  }

  if (communityType !== undefined) {
    if (
      typeof communityType !== 'string' ||
      !COMMUNITY_TYPES.includes(communityType)
    ) {
      throw createValidationError(
        `Community type must be one of: ${COMMUNITY_TYPES.join(', ')}`,
        'INVALID_COMMUNITY_TYPE',
      );
    }
  }

  if (logoUrl !== undefined && logoUrl !== null) {
    if (typeof logoUrl !== 'string') {
      throw createValidationError(
        'Community logo URL must be a string',
        'INVALID_COMMUNITY_LOGO_URL',
      );
    }
  }

  if (
    name === undefined &&
    description === undefined &&
    communityType === undefined &&
    logoUrl === undefined
  ) {
    throw createValidationError(
      'At least one community field must be provided',
      'NO_COMMUNITY_FIELDS',
    );
  }

  return {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(description !== undefined
      ? { description: description?.trim() || null }
      : {}),
    ...(communityType !== undefined ? { communityType } : {}),
    ...(logoUrl !== undefined ? { logoUrl: logoUrl?.trim() || null } : {}),
  };
}

const COMMUNITY_SORTS = Object.freeze(['newest', 'popular', 'name']);
const DEFAULT_MY_COMMUNITY_STATUSES = Object.freeze(['pending', 'active', 'suspended']);

function validateListCommunitiesQuery(query = {}) {
  return {
    ...parsePagination(query),
    search: parseSearchFilter(query.q, 'q'),
    communityType: parseEnumFilter(query.type, COMMUNITY_TYPES, 'type'),
    sort: parseEnumFilter(query.sort, COMMUNITY_SORTS, 'sort') || 'newest',
  };
}

function validateListMyCommunitiesQuery(query = {}) {
  const status = parseEnumFilter(query.status, MEMBERSHIP_STATUSES, 'status');

  return {
    ...parsePagination(query),
    statuses: status ? [status] : [...DEFAULT_MY_COMMUNITY_STATUSES],
  };
}

module.exports = {
  COMMUNITY_TYPES,
  COMMUNITY_SORTS,
  validateCreateCommunityInput,
  validateUpdateCommunityInput,
  validateListCommunitiesQuery,
  validateListMyCommunitiesQuery,
};
