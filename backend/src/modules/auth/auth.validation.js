function validateRegistrationInput(body) {
  const errors = {};

  const faydaIdentifier =
    typeof body.faydaIdentifier === 'string' ? body.faydaIdentifier.trim() : null;

  const faydaIdentifierType =
    typeof body.faydaIdentifierType === 'string'
      ? body.faydaIdentifierType.trim().toLowerCase()
      : null;

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;

  const phone = typeof body.phone === 'string' ? body.phone.trim() : null;

  const password = typeof body.password === 'string' ? body.password : null;

  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : null;

  const middleName = typeof body.middleName === 'string' ? body.middleName.trim() : null;

  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : null;

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : null;

  const preferredLanguage =
    typeof body.preferredLanguage === 'string'
      ? body.preferredLanguage.trim().toLowerCase()
      : 'en';

  const timezone =
    typeof body.timezone === 'string' ? body.timezone.trim() : 'Africa/Addis_Ababa';

  if (!faydaIdentifier) {
    errors.faydaIdentifier = 'Fayda identifier is required';
  } else if (!/^\d{12}$/.test(faydaIdentifier)) {
    errors.faydaIdentifier = 'Fayda identifier must contain 12 digits';
  }

  if (!faydaIdentifierType) {
    errors.faydaIdentifierType = 'Fayda identifier type is required';
  } else if (!['fan', 'fin'].includes(faydaIdentifierType)) {
    errors.faydaIdentifierType = 'Fayda identifier type must be FAN or FIN';
  }

  if (!email && !phone) {
    errors.contact = 'Email or phone is required';
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Invalid email address';
  }

  if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) {
    errors.phone = 'Invalid phone number';
  }

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else if (password.length > 72) {
    errors.password = 'Password must not exceed 72 characters';
  }

  if (!firstName) {
    errors.firstName = 'First name is required';
  } else if (firstName.length > 100) {
    errors.firstName = 'First name must not exceed 100 characters';
  }

  if (!lastName) {
    errors.lastName = 'Last name is required';
  } else if (lastName.length > 100) {
    errors.lastName = 'Last name must not exceed 100 characters';
  }

  if (middleName && middleName.length > 100) {
    errors.middleName = 'Middle name must not exceed 100 characters';
  }

  if (displayName && displayName.length > 200) {
    errors.displayName = 'Display name must not exceed 200 characters';
  }

  if (preferredLanguage.length > 10) {
    errors.preferredLanguage = 'Invalid preferred language';
  }

  if (timezone.length > 64) {
    errors.timezone = 'Invalid timezone';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
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

function validateLoginInput(body) {
  const errors = {};

  const identifier =
    typeof body.identifier === 'string' ? body.identifier.trim() : null;

  const password = typeof body.password === 'string' ? body.password : null;

  if (!identifier) {
    errors.identifier = 'Email or phone is required';
  } else if (identifier.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      errors.identifier = 'Invalid email address';
    }
  } else if (!/^\+?[1-9]\d{7,14}$/.test(identifier)) {
    errors.identifier = 'Invalid phone number';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      identifier: identifier && identifier.includes('@')
        ? identifier.toLowerCase()
        : identifier,
      password,
    },
  };
}

module.exports = {
  validateRegistrationInput,
  validateLoginInput,
};
