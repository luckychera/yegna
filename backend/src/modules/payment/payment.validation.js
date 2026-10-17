const {
  PAYMENT_CURRENCY_DEFAULT,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} = require('./payment.constants');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const PROVIDER_PATTERN = /^[a-z0-9_-]{2,50}$/i;
const PROVIDER_REFERENCE_PATTERN = /^[^\s]{1,255}$/;

function createValidationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

function validateUuid(value, fieldName) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw createValidationError(`${fieldName} must be a valid UUID`);
  }

  return value;
}

function validateAmount(value, fieldName = 'amount') {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw createValidationError(`${fieldName} must be a positive amount`);
  }

  const amount = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    throw createValidationError(`${fieldName} must be a positive amount with up to 2 decimals`);
  }

  return amount;
}

function validateCurrency(value = PAYMENT_CURRENCY_DEFAULT) {
  if (typeof value !== 'string' || !CURRENCY_PATTERN.test(value)) {
    throw createValidationError('currency must be a 3-letter uppercase currency code');
  }

  return value;
}

function validateProvider(value) {
  if (typeof value !== 'string' || !PROVIDER_PATTERN.test(value)) {
    throw createValidationError('provider must be a valid provider identifier');
  }

  return value.toLowerCase();
}

function validateProviderReference(value, fieldName) {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'string' ||
    !PROVIDER_REFERENCE_PATTERN.test(value)
  ) {
    throw createValidationError(`${fieldName} must be a valid provider reference`);
  }

  return value;
}

function validatePaymentMethod(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError('paymentMethod must be a non-empty string');
  }

  return value.trim().toLowerCase();
}

function validateCreatePaymentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createValidationError('Payment data is required');
  }

  const communityId = validateUuid(input.communityId, 'communityId');
  const userId = validateUuid(input.userId, 'userId');

  const contributionId =
    input.contributionId === undefined || input.contributionId === null
      ? null
      : validateUuid(input.contributionId, 'contributionId');

  const provider = validateProvider(input.provider);
  const amount = validateAmount(input.amount);
  const currency = validateCurrency(
    input.currency === undefined ? PAYMENT_CURRENCY_DEFAULT : input.currency,
  );

  const paymentMethod = validatePaymentMethod(input.paymentMethod);
  const providerTransactionId = validateProviderReference(
    input.providerTransactionId,
    'providerTransactionId',
  );
  const providerReference = validateProviderReference(
    input.providerReference,
    'providerReference',
  );

  return {
    communityId,
    userId,
    contributionId,
    provider,
    amount,
    currency,
    paymentMethod,
    providerTransactionId,
    providerReference,
  };
}

function validatePaymentId(paymentId) {
  return validateUuid(paymentId, 'paymentId');
}

function validatePaymentStatus(status) {
  if (!Object.values(PAYMENT_STATUS).includes(status)) {
    throw createValidationError(`Invalid payment status: ${status}`);
  }

  return status;
}

function validatePaymentMethodValue(paymentMethod) {
  if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
    throw createValidationError(`Invalid payment method: ${paymentMethod}`);
  }

  return paymentMethod;
}

module.exports = {
  createValidationError,
  validateUuid,
  validateAmount,
  validateCurrency,
  validateProvider,
  validateProviderReference,
  validatePaymentMethod,
  validateCreatePaymentInput,
  validatePaymentId,
  validatePaymentStatus,
  validatePaymentMethodValue,
};
