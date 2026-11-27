const { pool } = require('../../config/database');
const { PERMISSIONS } = require('../authorization/permission.constants');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { SYSTEM_ROLES, SYSTEM_ROLE_BY_NAME } = require('./role.catalog');

function createRoleError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function ensureSystemRoles(client, communityId) {
  for (const role of SYSTEM_ROLES) {
    await client.query(
      `
        INSERT INTO community_roles (
          community_id,
          name,
          description,
          permissions,
          is_system_role
        )
        VALUES ($1, $2, $3, $4::JSONB, TRUE)
        ON CONFLICT (community_id, name)
        DO NOTHING;
      `,
      [communityId, role.name, role.description, JSON.stringify(role.permissions)],
    );
  }
}

async function getRoleById(client, communityId, roleId) {
  const result = await client.query(
    `
      SELECT id, community_id, name, description, is_system_role
      FROM community_roles
      WHERE id = $1
        AND community_id = $2;
    `,
    [roleId, communityId],
  );

  return result.rows[0] || null;
}

async function getRoleByName(client, communityId, name) {
  const result = await client.query(
    `
      SELECT id, community_id, name, description, is_system_role
      FROM community_roles
      WHERE community_id = $1
        AND name = $2;
    `,
    [communityId, name],
  );

  return result.rows[0] || null;
}

async function loadActor(client, communityId, userId) {
  const communityResult = await client.query(
    `SELECT created_by FROM communities WHERE id = $1`,
    [communityId],
  );

  const authResult = await client.query(
    `
      SELECT cr.name, cr.permissions
      FROM community_memberships cm
      JOIN membership_roles mr
        ON mr.membership_id = cm.id
       AND mr.revoked_at IS NULL
      JOIN community_roles cr
        ON cr.id = mr.role_id
      WHERE cm.community_id = $1
        AND cm.user_id = $2
        AND cm.status = 'active';
    `,
    [communityId, userId],
  );

  const permissions = new Set();
  const roleNames = [];

  for (const row of authResult.rows) {
    roleNames.push(row.name);

    if (Array.isArray(row.permissions)) {
      for (const permission of row.permissions) {
        permissions.add(permission);
      }
    }
  }

  const rank = roleNames.reduce((highest, name) => {
    const catalog = SYSTEM_ROLE_BY_NAME[name];

    return catalog ? Math.max(highest, catalog.rank) : highest;
  }, 0);

  return {
    isCreator: communityResult.rows[0]?.created_by === userId,
    permissions,
    roleNames,
    rank,
  };
}

function assertCanAssign(actor, role) {
  const catalog = SYSTEM_ROLE_BY_NAME[role.name];

  if (!catalog || !role.is_system_role) {
    throw createRoleError('That role cannot be assigned', 400, 'ROLE_NOT_ASSIGNABLE');
  }

  if (role.name === 'member' && !actor.permissions.has(PERMISSIONS.ROLES_ASSIGN)) {
    return;
  }

  if (!actor.permissions.has(PERMISSIONS.ROLES_ASSIGN)) {
    throw createRoleError(
      'You cannot assign that role',
      403,
      'ROLE_ASSIGNMENT_DENIED',
    );
  }

  if (role.name === 'admin') {
    if (!(actor.isCreator && actor.roleNames.includes('admin'))) {
      throw createRoleError(
        'Only the community creator can appoint an administrator',
        403,
        'ROLE_ASSIGNMENT_DENIED',
      );
    }

    return;
  }

  if (catalog.rank >= actor.rank) {
    throw createRoleError(
      'You cannot assign a role at or above your own authority',
      403,
      'ROLE_ASSIGNMENT_DENIED',
    );
  }
}

async function activeRoleNames(client, membershipId) {
  const result = await client.query(
    `
      SELECT cr.name
      FROM membership_roles mr
      JOIN community_roles cr ON cr.id = mr.role_id
      WHERE mr.membership_id = $1
        AND mr.revoked_at IS NULL
      ORDER BY cr.name;
    `,
    [membershipId],
  );

  return result.rows.map((row) => row.name);
}

async function replaceRole(client, { communityId, membershipId, role, actorUserId, reason }) {
  const previous = await activeRoleNames(client, membershipId);

  await client.query(
    `
      UPDATE membership_roles
      SET revoked_at = NOW()
      WHERE membership_id = $1
        AND revoked_at IS NULL
        AND role_id <> $2;
    `,
    [membershipId, role.id],
  );

  const kept = await client.query(
    `
      UPDATE membership_roles
      SET assigned_at = NOW(),
          assigned_by = $3
      WHERE membership_id = $1
        AND role_id = $2
        AND revoked_at IS NULL;
    `,
    [membershipId, role.id, actorUserId],
  );

  if (kept.rowCount === 0) {
    await client.query(
      `
        INSERT INTO membership_roles (membership_id, role_id, assigned_by)
        VALUES ($1, $2, $3);
      `,
      [membershipId, role.id, actorUserId],
    );
  }

  const unchanged = previous.length === 1 && previous[0] === role.name;

  if (!unchanged) {
    await createAuditLog({
      userId: actorUserId,
      communityId,
      action: AUDIT_ACTIONS.ROLE_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.ROLE,
      entityId: membershipId,
      oldValues: { roles: previous },
      newValues: { role: role.name },
      metadata: reason ? { reason } : {},
      client,
    });
  }
}

/**
 * Gives an active membership its role. An explicit role replaces whatever was
 * there. Otherwise a membership with no role becomes a member. Pending
 * memberships are left untouched, so an invitation cannot grant permissions
 * before acceptance and activation.
 */
async function ensureRoleForActiveMembership(client, {
  communityId,
  membershipId,
  roleId = null,
  actorUserId,
  reason = null,
  onlyIfMissing = false,
}) {
  const membershipResult = await client.query(
    `SELECT status FROM community_memberships WHERE id = $1 AND community_id = $2`,
    [membershipId, communityId],
  );
  const membership = membershipResult.rows[0];

  if (!membership || membership.status !== 'active') {
    return;
  }

  await ensureSystemRoles(client, communityId);

  if (onlyIfMissing && (await activeRoleNames(client, membershipId)).length > 0) {
    return;
  }

  const role = roleId
    ? await getRoleById(client, communityId, roleId)
    : await getRoleByName(client, communityId, 'member');

  if (!role) {
    throw createRoleError('Role not found', 404, 'ROLE_NOT_FOUND');
  }

  await replaceRole(client, { communityId, membershipId, role, actorUserId, reason });
}

/** Role applied when an invitation is accepted. Stale authority falls back to member. */
async function resolveAcceptanceRole(client, { communityId, inviterUserId, roleId }) {
  await ensureSystemRoles(client, communityId);
  const actor = await loadActor(client, communityId, inviterUserId);
  const stored = roleId ? await getRoleById(client, communityId, roleId) : null;
  const memberRole = await getRoleByName(client, communityId, 'member');

  if (!stored) {
    return { role: memberRole, fallback: false };
  }

  try {
    assertCanAssign(actor, stored);

    return { role: stored, fallback: false };
  } catch (error) {
    if (error.code !== 'ROLE_ASSIGNMENT_DENIED' && error.code !== 'ROLE_NOT_ASSIGNABLE') {
      throw error;
    }

    return { role: memberRole, fallback: true };
  }
}

async function resolveInvitationRole(client, { communityId, inviterUserId, roleId }) {
  await ensureSystemRoles(client, communityId);
  const actor = await loadActor(client, communityId, inviterUserId);
  const memberRole = await getRoleByName(client, communityId, 'member');

  if (!roleId) {
    return memberRole;
  }

  const role = await getRoleById(client, communityId, roleId);

  if (!role) {
    throw createRoleError('Role not found in this community', 400, 'ROLE_NOT_ASSIGNABLE');
  }

  assertCanAssign(actor, role);

  return role;
}

/**
 * Re-checks the inviter's authority at acceptance time. A role they can no
 * longer assign falls back to member instead of granting a stale privilege.
 */
async function applyInvitationRole(client, {
  communityId,
  membershipId,
  roleId,
  inviterUserId,
  actorUserId,
}) {
  await ensureSystemRoles(client, communityId);
  const actor = await loadActor(client, communityId, inviterUserId);
  const stored = roleId ? await getRoleById(client, communityId, roleId) : null;
  let role = await getRoleByName(client, communityId, 'member');
  let reason = null;

  if (stored) {
    try {
      assertCanAssign(actor, stored);
      role = stored;
    } catch (error) {
      if (error.code !== 'ROLE_ASSIGNMENT_DENIED' && error.code !== 'ROLE_NOT_ASSIGNABLE') {
        throw error;
      }

      reason = 'The invited role was no longer allowed, so the member role was applied.';
    }
  }

  await replaceRole(client, {
    communityId,
    membershipId,
    role,
    actorUserId,
    reason,
  });
}

async function listAssignableRoles({ communityId, actorUserId }) {
  const client = await pool.connect();

  try {
    await ensureSystemRoles(client, communityId);
    const actor = await loadActor(client, communityId, actorUserId);
    const result = await client.query(
      `
        SELECT id, name, description, is_system_role
        FROM community_roles
        WHERE community_id = $1
          AND is_system_role = TRUE
        ORDER BY name;
      `,
      [communityId],
    );

    return result.rows
      .filter((role) => {
        try {
          assertCanAssign(actor, role);
          return true;
        } catch {
          return false;
        }
      })
      .map(({ id, name, description }) => ({ id, name, description }));
  } finally {
    client.release();
  }
}

async function changeMemberRole({ communityId, membershipId, roleId, actorUserId }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureSystemRoles(client, communityId);

    const membershipResult = await client.query(
      `
        SELECT cm.id, cm.user_id, cm.status, c.created_by
        FROM community_memberships cm
        JOIN communities c ON c.id = cm.community_id
        WHERE cm.id = $1
          AND cm.community_id = $2
        FOR UPDATE OF cm;
      `,
      [membershipId, communityId],
    );
    const membership = membershipResult.rows[0];

    if (!membership) {
      throw createRoleError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
    }

    if (membership.user_id === actorUserId) {
      throw createRoleError('You cannot change your own role', 403, 'SELF_ROLE_CHANGE');
    }

    if (membership.user_id === membership.created_by && actorUserId !== membership.created_by) {
      throw createRoleError(
        'The community creator’s role can only be changed by the creator',
        403,
        'OWNERSHIP_PROTECTED',
      );
    }

    if (membership.status !== 'active') {
      throw createRoleError(
        'A role can be changed after the membership is active',
        409,
        'ROLE_REQUIRES_ACTIVE_MEMBERSHIP',
      );
    }

    const role = await getRoleById(client, communityId, roleId);

    if (!role) {
      throw createRoleError('Role not found in this community', 400, 'ROLE_NOT_ASSIGNABLE');
    }

    const actor = await loadActor(client, communityId, actorUserId);
    assertCanAssign(actor, role);

    const previous = await activeRoleNames(client, membershipId);

    if (previous.includes('admin') && role.name !== 'admin') {
      const others = await client.query(
        `
          SELECT COUNT(*)::INT AS total
          FROM community_memberships cm
          JOIN membership_roles mr
            ON mr.membership_id = cm.id
           AND mr.revoked_at IS NULL
          JOIN community_roles cr
            ON cr.id = mr.role_id
           AND cr.name = 'admin'
          WHERE cm.community_id = $1
            AND cm.status = 'active'
            AND cm.id <> $2;
        `,
        [communityId, membershipId],
      );

      if (others.rows[0].total === 0) {
        throw createRoleError(
          'This community must keep at least one active administrator',
          409,
          'LAST_ADMINISTRATOR',
        );
      }
    }

    await replaceRole(client, { communityId, membershipId, role, actorUserId, reason: null });
    await client.query('COMMIT');

    return { membershipId, role: { id: role.id, name: role.name, description: role.description } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureSystemRoles,
  ensureRoleForActiveMembership,
  resolveInvitationRole,
  resolveAcceptanceRole,
  applyInvitationRole,
  listAssignableRoles,
  changeMemberRole,
};
