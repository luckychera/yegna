const CONTRIBUTION_STATUS = Object.freeze({
  PENDING: 'pending',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  WAIVED: 'waived',
  CANCELLED: 'cancelled',
});

const CONTRIBUTION_FREQUENCY = Object.freeze({
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
});

const CONTRIBUTION_CURRENCY_DEFAULT = 'ETB';

module.exports = {
  CONTRIBUTION_STATUS,
  CONTRIBUTION_FREQUENCY,
  CONTRIBUTION_CURRENCY_DEFAULT,
};
