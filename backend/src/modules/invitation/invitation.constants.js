const INVITATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
});

const INVITATION_DEFAULT_EXPIRY_DAYS = 7;

module.exports = {
  INVITATION_STATUS,
  INVITATION_DEFAULT_EXPIRY_DAYS,
};
