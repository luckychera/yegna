const MEMBERSHIP_STATUSES = Object.freeze([
  'pending',
  'active',
  'suspended',
  'rejected',
  'left',
]);

function createValidationError(message, code) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateCreateMembershipInput(input) {
  const { userId, membershipNumber, metadata } = input;

  if (!userId || typeof userId !== 'string') {
    throw createValidationError(
      'User ID is required',
      'USER_ID_REQUIRED',
    );
  }

  if (membershipNumber !== undefined && membershipNumber !== null) {
    if (
      typeof membershipNumber !== 'string' ||
      !membershipNumber.trim()
    ) {
      throw createValidationError(
        'Membership number must be a non-empty string',
        'INVALID_MEMBERSHIP_NUMBER',
      );
    }

    if (membershipNumber.trim().length > 50) {
      throw createValidationError(
        'Membership number must not exceed 50 characters',
        'MEMBERSHIP_NUMBER_TOO_LONG',
      );
    }
  }

  if (metadata !== undefined && metadata !== null) {
    if (
      typeof metadata !== 'object' ||
      Array.isArray(metadata)
    ) {
      throw createValidationError(
        'Membership metadata must be an object',
        'INVALID_MEMBERSHIP_METADATA',
      );
    }
  }

  return {
    userId,
    membershipNumber: membershipNumber?.trim() || null,
    metadata: metadata || {},
  };
}

function validateUpdateMembershipInput(input) {
  const { membershipNumber, metadata } = input;

  if (
    membershipNumber === undefined &&
    metadata === undefined
  ) {
    throw createValidationError(
      'At least one membership field must be provided',
      'NO_MEMBERSHIP_FIELDS',
    );
  }

  if (membershipNumber !== undefined && membershipNumber !== null) {
    if (
      typeof membershipNumber !== 'string' ||
      !membershipNumber.trim()
    ) {
      throw createValidationError(
        'Membership number must be a non-empty string',
        'INVALID_MEMBERSHIP_NUMBER',
      );
    }

    if (membershipNumber.trim().length > 50) {
      throw createValidationError(
        'Membership number must not exceed 50 characters',
        'MEMBERSHIP_NUMBER_TOO_LONG',
      );
    }
  }

  if (metadata !== undefined && metadata !== null) {
    if (
      typeof metadata !== 'object' ||
      Array.isArray(metadata)
    ) {
      throw createValidationError(
        'Membership metadata must be an object',
        'INVALID_MEMBERSHIP_METADATA',
      );
    }
  }

  return {
    ...(membershipNumber !== undefined
      ? { membershipNumber: membershipNumber?.trim() || null }
      : {}),
    ...(metadata !== undefined
      ? { metadata: metadata || {} }
      : {}),
  };
}

function validateMembershipId(membershipId) {
  if (
    !membershipId ||
    typeof membershipId !== 'string'
  ) {
    throw createValidationError(
      'Membership ID is required',
      'MEMBERSHIP_ID_REQUIRED',
    );
  }

  return membershipId;
}

module.exports = {
  MEMBERSHIP_STATUSES,
  validateCreateMembershipInput,
  validateUpdateMembershipInput,
  validateMembershipId,
};
