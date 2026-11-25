const PERMISSIONS = Object.freeze({
  COMMUNITY_VIEW: 'community.view',
  COMMUNITY_UPDATE: 'community.update',

  MEMBERS_VIEW: 'members.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_UPDATE: 'members.update',
  MEMBERS_REMOVE: 'members.remove',

  ROLES_VIEW: 'roles.view',
  ROLES_ASSIGN: 'roles.assign',
  ROLES_REVOKE: 'roles.revoke',

  CONTRIBUTIONS_VIEW: 'contributions.view',
  CONTRIBUTIONS_CREATE: 'contributions.create',
  CONTRIBUTIONS_UPDATE: 'contributions.update',

  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',

  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_REFUND: 'payments.refund',

  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  AUDIT_VIEW: 'audit.view',
});

module.exports = {
  PERMISSIONS,
};
