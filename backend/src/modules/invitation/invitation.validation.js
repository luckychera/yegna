const { parsePagination } = require('../../utils/pagination');
const { parseEnumFilter } = require('../../utils/query-filters');
const { INVITATION_STATUS } = require('./invitation.constants');

function createValidationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateCreateInvitation(data) {
  if (!data || typeof data !== 'object') {
    throw createValidationError('Request body is required');
  }

  const invitedUserId = typeof data.invitedUserId === 'string' ? data.invitedUserId.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';

  if (!invitedUserId && !email) {
    throw createValidationError('invitedUserId or email is required');
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createValidationError('email must be a valid email address');
  }

  if (data.roleId !== undefined && data.roleId !== null && data.roleId !== '') {
    if (typeof data.roleId !== 'string' || !UUID_PATTERN.test(data.roleId)) {
      throw createValidationError('roleId must be a valid role id');
    }
  }

  if (data.metadata !== undefined) {
    if (
      typeof data.metadata !== 'object' ||
      data.metadata === null ||
      Array.isArray(data.metadata)
    ) {
      throw createValidationError('metadata must be an object');
    }
  }
}

function validateInvitationId(invitationId) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(invitationId)) {
    throw createValidationError('Invalid invitation ID');
  }
}

function validateListMyInvitationsQuery(query = {}) {
  return {
    ...parsePagination(query),
    status: parseEnumFilter(query.status, Object.values(INVITATION_STATUS), 'status'),
  };
}

module.exports = {
  validateListMyInvitationsQuery,

  validateCreateInvitation,
  validateInvitationId,
  readInvitationTarget: (data) => {
    validateCreateInvitation(data);

    const invitedUserId = typeof data.invitedUserId === 'string' ? data.invitedUserId.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim() : '';
    const roleId = data.roleId || null;

    return {
      invitedUserId: invitedUserId || null,
      email: email || null,
      roleId,
      metadata: data.metadata,
    };
  },
};
