function createValidationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateCreateInvitation(data) {
  if (!data || typeof data !== 'object') {
    throw createValidationError('Request body is required');
  }

  if (typeof data.invitedUserId !== 'string' || !data.invitedUserId.trim()) {
    throw createValidationError('invitedUserId is required');
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

module.exports = {
  validateCreateInvitation,
  validateInvitationId,
};
