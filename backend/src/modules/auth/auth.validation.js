function validatePassword(password) {
  if (typeof password !== 'string') {
    return {
      valid: false,
      message: 'Password must be a string',
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      message: 'Password must not exceed 128 characters',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    };
  }

  return {
    valid: true,
  };
}

function validateRegistrationInput(input) {
  const {
    faydaIdentifier,
    faydaIdentifierType,
    email,
    phone,
    password,
    firstName,
    middleName,
    lastName,
    displayName,
    preferredLanguage,
    timezone,
  } = input;

  if (!faydaIdentifier) {
    throw createValidationError('Fayda identifier is required', 'FAYDA_IDENTIFIER_REQUIRED');
  }

  if (!faydaIdentifierType) {
    throw createValidationError(
      'Fayda identifier type is required',
      'FAYDA_IDENTIFIER_TYPE_REQUIRED',
    );
  }

  if (!email && !phone) {
    throw createValidationError('Email or phone is required', 'CONTACT_REQUIRED');
  }

  const passwordValidation = validatePassword(password);

  if (!passwordValidation.valid) {
    throw createValidationError(passwordValidation.message, 'INVALID_PASSWORD');
  }

  if (!firstName || typeof firstName !== 'string') {
    throw createValidationError('First name is required', 'FIRST_NAME_REQUIRED');
  }

  if (!lastName || typeof lastName !== 'string') {
    throw createValidationError('Last name is required', 'LAST_NAME_REQUIRED');
  }

  return {
    data: {
      faydaIdentifier,
      faydaIdentifierType,
      email,
      phone,
      password,
      firstName,
      middleName,
      lastName,
      displayName,
      preferredLanguage,
      timezone,
    },
  };
}

function validateLoginInput(input) {
  const { email, phone, password } = input;

  if (!email && !phone) {
    throw createValidationError('Email or phone is required', 'CONTACT_REQUIRED');
  }

  if (!password || typeof password !== 'string') {
    throw createValidationError('Password is required', 'PASSWORD_REQUIRED');
  }

  return {
    data: {
      email,
      phone,
      password,
    },
  };
}

function createValidationError(message, code) {
  const error = new Error(message);

  error.statusCode = 400;
  error.code = code;

  return error;
}

module.exports = {
  validatePassword,
  validateRegistrationInput,
  validateLoginInput,
};
