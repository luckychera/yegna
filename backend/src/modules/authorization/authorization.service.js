const { pool } = require('../../config/database');

async function getUserAuthorization(userId) {
  const result = await pool.query(
    `
      SELECT
        cm.id AS membership_id,
        cm.community_id,
        cm.membership_number,
        cm.status AS membership_status,

        cr.id AS role_id,
        cr.name AS role_name,
        cr.permissions,

        mr.assigned_at

      FROM community_memberships cm

      LEFT JOIN membership_roles mr
        ON mr.membership_id = cm.id
       AND mr.revoked_at IS NULL

      LEFT JOIN community_roles cr
        ON cr.id = mr.role_id
       AND cr.community_id = cm.community_id

      WHERE cm.user_id = $1
        AND cm.status = 'active'

      ORDER BY cm.created_at, cr.name;
    `,
    [userId],
  );

  const communities = new Map();

  for (const row of result.rows) {
    if (!communities.has(row.community_id)) {
      communities.set(row.community_id, {
        communityId: row.community_id,
        membershipId: row.membership_id,
        membershipNumber: row.membership_number,
        membershipStatus: row.membership_status,
        roles: [],
        permissions: new Set(),
      });
    }

    const community = communities.get(row.community_id);

    if (row.role_id) {
      community.roles.push({
        id: row.role_id,
        name: row.role_name,
        assignedAt: row.assigned_at,
      });

      if (Array.isArray(row.permissions)) {
        for (const permission of row.permissions) {
          if (typeof permission === 'string') {
            community.permissions.add(permission);
          }
        }
      }
    }
  }

  return Array.from(communities.values()).map((community) => ({
    communityId: community.communityId,
    membershipId: community.membershipId,
    membershipNumber: community.membershipNumber,
    membershipStatus: community.membershipStatus,
    roles: community.roles,
    permissions: Array.from(community.permissions).sort(),
  }));
}

async function getUserCommunityAuthorization(userId, communityId) {
  const result = await pool.query(
    `
      SELECT
        cm.id AS membership_id,
        cm.community_id,
        cm.membership_number,
        cm.status AS membership_status,

        cr.id AS role_id,
        cr.name AS role_name,
        cr.permissions,

        mr.assigned_at

      FROM community_memberships cm

      LEFT JOIN membership_roles mr
        ON mr.membership_id = cm.id
       AND mr.revoked_at IS NULL

      LEFT JOIN community_roles cr
        ON cr.id = mr.role_id
       AND cr.community_id = cm.community_id

      WHERE cm.user_id = $1
        AND cm.community_id = $2
        AND cm.status = 'active'

      ORDER BY cr.name;
    `,
    [userId, communityId],
  );

  const membership = result.rows[0];

  if (!membership) {
    return {
      communityId,
      membershipId: null,
      membershipNumber: null,
      membershipStatus: null,
      roles: [],
      permissions: [],
    };
  }

  const roles = [];
  const permissions = new Set();

  for (const row of result.rows) {
    if (!row.role_id) {
      continue;
    }

    roles.push({
      id: row.role_id,
      name: row.role_name,
      assignedAt: row.assigned_at,
    });

    if (Array.isArray(row.permissions)) {
      for (const permission of row.permissions) {
        if (typeof permission === 'string') {
          permissions.add(permission);
        }
      }
    }
  }

  return {
    communityId: membership.community_id,
    membershipId: membership.membership_id,
    membershipNumber: membership.membership_number,
    membershipStatus: membership.membership_status,
    roles,
    permissions: Array.from(permissions).sort(),
  };
}

module.exports = {
  getUserAuthorization,
  getUserCommunityAuthorization,
};
