const { parsePagination } = require('../../utils/pagination');
const {
  parseEnumFilter,
  parseUuidFilter,
  parseDateFilter,
} = require('../../utils/query-filters');
const {
  CONTRIBUTION_STATUS,
  CONTRIBUTION_FREQUENCY,
  CONTRIBUTION_CURRENCY_DEFAULT,
} = require('./contribution.constants');

function createContributionError(message, statusCode = 400, code = 'VALIDATION_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function validateUuid(value, fieldName) {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw createContributionError(`${fieldName} must be a valid UUID`);
  }

  return value;
}

function validateDate(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createContributionError(`${fieldName} must be a valid date in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw createContributionError(`${fieldName} must be a valid calendar date`);
  }

  return value;
}

function validateAmount(value, fieldName = 'amount') {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createContributionError(`${fieldName} must be greater than zero`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) {
    throw createContributionError(`${fieldName} must have at most 2 decimal places`);
  }

  return amount.toFixed(2);
}

function validateCurrency(value) {
  const currency = value || CONTRIBUTION_CURRENCY_DEFAULT;

  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw createContributionError('currency must be a 3-letter uppercase currency code');
  }

  return currency;
}

function validateCreateContributionInput(input = {}) {
  const {
    membershipId,
    contributionPeriodStart,
    contributionPeriodEnd,
    dueDate,
    amount,
    currency,
    notes,
  } = input;

  validateUuid(membershipId, 'membershipId');

  validateDate(contributionPeriodStart, 'contributionPeriodStart');
  validateDate(contributionPeriodEnd, 'contributionPeriodEnd');
  validateDate(dueDate, 'dueDate');

  if (contributionPeriodEnd < contributionPeriodStart) {
    throw createContributionError('contributionPeriodEnd cannot be before contributionPeriodStart');
  }

  return {
    membershipId,
    contributionPeriodStart,
    contributionPeriodEnd,
    dueDate,
    amount: validateAmount(amount),
    currency: validateCurrency(currency),
    notes: notes === undefined || notes === null ? null : String(notes).trim(),
  };
}

function validateUpdateContributionInput(input = {}) {
  const allowedFields = [
    'contributionPeriodStart',
    'contributionPeriodEnd',
    'dueDate',
    'amount',
    'currency',
    'notes',
  ];

  const keys = Object.keys(input);

  if (keys.length === 0) {
    throw createContributionError('At least one field is required');
  }

  for (const key of keys) {
    if (!allowedFields.includes(key)) {
      throw createContributionError(`Field "${key}" cannot be updated`);
    }
  }

  const updates = {};

  if (input.contributionPeriodStart !== undefined) {
    updates.contributionPeriodStart = validateDate(
      input.contributionPeriodStart,
      'contributionPeriodStart',
    );
  }

  if (input.contributionPeriodEnd !== undefined) {
    updates.contributionPeriodEnd = validateDate(
      input.contributionPeriodEnd,
      'contributionPeriodEnd',
    );
  }

  if (
    updates.contributionPeriodStart &&
    updates.contributionPeriodEnd &&
    updates.contributionPeriodEnd < updates.contributionPeriodStart
  ) {
    throw createContributionError('contributionPeriodEnd cannot be before contributionPeriodStart');
  }

  if (input.dueDate !== undefined) {
    updates.dueDate = validateDate(input.dueDate, 'dueDate');
  }

  if (input.amount !== undefined) {
    updates.amount = validateAmount(input.amount);
  }

  if (input.currency !== undefined) {
    updates.currency = validateCurrency(input.currency);
  }

  if (input.notes !== undefined) {
    updates.notes = input.notes === null ? null : String(input.notes).trim();
  }

  return updates;
}

function validateContributionId(contributionId) {
  return validateUuid(contributionId, 'contributionId');
}

function validateStatus(status) {
  if (!Object.values(CONTRIBUTION_STATUS).includes(status)) {
    throw createContributionError(`Invalid contribution status: ${status}`);
  }

  return status;
}

function validateFrequency(frequency) {
  if (!Object.values(CONTRIBUTION_FREQUENCY).includes(frequency)) {
    throw createContributionError(`Invalid contribution frequency: ${frequency}`);
  }

  return frequency;
}

function validateListMyContributionsQuery(query = {}) {
  const dueFrom = parseDateFilter(query.dueFrom, 'dueFrom');
  const dueTo = parseDateFilter(query.dueTo, 'dueTo');

  if (dueFrom && dueTo && dueFrom > dueTo) {
    const error = new Error('dueFrom must not be after dueTo');
    error.statusCode = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  return {
    ...parsePagination(query),
    status: parseEnumFilter(query.status, Object.values(CONTRIBUTION_STATUS), 'status'),
    communityId: parseUuidFilter(query.communityId, 'communityId'),
    dueFrom,
    dueTo,
  };
}

module.exports = {
  validateListMyContributionsQuery,

  validateCreateContributionInput,
  validateUpdateContributionInput,
  validateContributionId,
  validateStatus,
  validateFrequency,
};
