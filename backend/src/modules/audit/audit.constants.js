const AUDIT_ACTIONS = Object.freeze({
  MEMBERSHIP_CREATED: 'membership.created',
  MEMBERSHIP_UPDATED: 'membership.updated',
  MEMBERSHIP_APPROVED: 'membership.approved',
  MEMBERSHIP_REJECTED: 'membership.rejected',
  MEMBERSHIP_SUSPENDED: 'membership.suspended',
  MEMBERSHIP_REMOVED: 'membership.removed',
  MEMBERSHIP_REJOINED: 'membership.rejoined',
  MEMBERSHIP_REACTIVATED: 'membership.reactivated',

  INVITATION_CREATED: 'invitation.created',
  INVITATION_ACCEPTED: 'invitation.accepted',
  INVITATION_REJECTED: 'invitation.rejected',
  INVITATION_REVOKED: 'invitation.revoked',
  INVITATION_EXPIRED: 'invitation.expired',

  CONTRIBUTION_CREATED: 'contribution.created',
  CONTRIBUTION_UPDATED: 'contribution.updated',
  CONTRIBUTION_WAIVED: 'contribution.waived',
  CONTRIBUTION_CANCELLED: 'contribution.cancelled',
  CONTRIBUTION_OVERDUE: 'contribution.overdue',
  CONTRIBUTION_PAID: 'contribution.paid',
  CONTRIBUTION_PARTIALLY_PAID: 'contribution.partially_paid',
});

const AUDIT_ENTITY_TYPES = Object.freeze({
  MEMBERSHIP: 'membership',
  INVITATION: 'invitation',
  COMMUNITY: 'community',
  USER: 'user',
  ROLE: 'role',
  CONTRIBUTION: 'contribution',
  PAYMENT: 'payment',
  LEDGER_TRANSACTION: 'ledger_transaction',
});

module.exports = {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
};
