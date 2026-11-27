const { PERMISSIONS } = require('../authorization/permission.constants');

/**
 * Predefined community roles. Rank is assignment authority, not a permission.
 * A person can assign a role only when its rank is below their own, except the
 * community creator, who may also assign admin. There is no separate owner role.
 */
const SYSTEM_ROLES = Object.freeze([
  {
    name: 'member',
    rank: 1,
    description: 'Takes part in the community and can invite people, who join as members.',
    permissions: [PERMISSIONS.COMMUNITY_VIEW, PERMISSIONS.MEMBERS_INVITE],
  },
  {
    name: 'committee_member',
    rank: 2,
    description: 'Sees the member list and can publish announcements.',
    permissions: [
      PERMISSIONS.COMMUNITY_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.MEMBERS_INVITE,
      PERMISSIONS.ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.CONTRIBUTIONS_VIEW,
    ],
  },
  {
    name: 'secretary',
    rank: 3,
    description: 'Keeps the member list and community announcements.',
    permissions: [
      PERMISSIONS.COMMUNITY_VIEW,
      PERMISSIONS.MEMBERS_VIEW,
      PERMISSIONS.MEMBERS_INVITE,
      PERMISSIONS.MEMBERS_UPDATE,
      PERMISSIONS.ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.CONTRIBUTIONS_VIEW,
    ],
  },
  {
    name: 'treasurer',
    rank: 3,
    description: 'Records contributions and payments. Cannot change roles.',
    permissions: [
      PERMISSIONS.COMMUNITY_VIEW,
      PERMISSIONS.CONTRIBUTIONS_VIEW,
      PERMISSIONS.CONTRIBUTIONS_CREATE,
      PERMISSIONS.CONTRIBUTIONS_UPDATE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.PAYMENTS_CREATE,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.REPORTS_VIEW,
    ],
  },
  {
    name: 'admin',
    rank: 4,
    description: 'Administers the community. Only the community creator can appoint another admin.',
    permissions: Object.values(PERMISSIONS),
  },
]);

const SYSTEM_ROLE_BY_NAME = Object.freeze(
  Object.fromEntries(SYSTEM_ROLES.map((role) => [role.name, role])),
);

module.exports = {
  SYSTEM_ROLES,
  SYSTEM_ROLE_BY_NAME,
};
