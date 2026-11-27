/**
 * Permission strings exposed by the backend (GET /communities/me → permissions[]).
 * The UI only ever asks "does the backend say I may do X?", never "is this user an admin?".
 */
export const PERMISSIONS = {
  COMMUNITY_VIEW: 'community.view',
  COMMUNITY_UPDATE: 'community.update',
  MEMBERS_VIEW: 'members.view',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_UPDATE: 'members.update',
  MEMBERS_REMOVE: 'members.remove',
  ROLES_ASSIGN: 'roles.assign',
  CONTRIBUTIONS_VIEW: 'contributions.view',
  CONTRIBUTIONS_CREATE: 'contributions.create',
  CONTRIBUTIONS_UPDATE: 'contributions.update',
  PAYMENTS_VIEW: 'payments.view',
  REPORTS_VIEW: 'reports.view',
  ANNOUNCEMENTS_MANAGE: 'announcements.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[(keyof typeof PERMISSIONS)];
