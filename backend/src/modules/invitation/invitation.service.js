const crypto = require('crypto');

const { pool } = require('../../config/database');
const { INVITATION_STATUS, INVITATION_DEFAULT_EXPIRY_DAYS } = require('./invitation.constants');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { createMembership } = require('../membership/membership.service');
const { notifySafely } = require('../notification/notification.events');

const INVITATION_TOKEN_BYTES = 32;

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function generateInvitationToken() {
  return crypto.randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getInvitationExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_DEFAULT_EXPIRY_DAYS);
  return expiresAt;
}

async function createInvitation({ communityId, inviterUserId, invitedUserId, metadata = {} }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const communityResult = await client.query(
      `
        SELECT id
        FROM communities
        WHERE id = $1
        FOR UPDATE
      `,
      [communityId],
    );

    if (communityResult.rowCount === 0) {
      throw createServiceError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
    }

    const userResult = await client.query(
      `
        SELECT id
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [invitedUserId],
    );

    if (userResult.rowCount === 0) {
      throw createServiceError('Invited user not found', 404, 'USER_NOT_FOUND');
    }

    if (inviterUserId === invitedUserId) {
      throw createServiceError('You cannot invite yourself', 400, 'SELF_INVITATION_NOT_ALLOWED');
    }

    const membershipResult = await client.query(
      `
        SELECT id, status
        FROM community_memberships
        WHERE community_id = $1
          AND user_id = $2
      `,
      [communityId, invitedUserId],
    );

    if (membershipResult.rowCount > 0) {
      const membership = membershipResult.rows[0];

      if (
        membership.status === 'active' ||
        membership.status === 'pending' ||
        membership.status === 'suspended'
      ) {
        throw createServiceError(
          'User already has a membership in this community',
          409,
          'MEMBERSHIP_ALREADY_EXISTS',
        );
      }
    }

    const pendingInvitationResult = await client.query(
      `
        SELECT id
        FROM community_invitations
        WHERE community_id = $1
          AND invited_user_id = $2
          AND status = $3
        LIMIT 1
      `,
      [communityId, invitedUserId, INVITATION_STATUS.PENDING],
    );

    if (pendingInvitationResult.rowCount > 0) {
      throw createServiceError(
        'A pending invitation already exists for this user',
        409,
        'INVITATION_ALREADY_EXISTS',
      );
    }

    const token = generateInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = getInvitationExpiry();

    const invitationResult = await client.query(
      `
        INSERT INTO community_invitations (
          community_id,
          inviter_user_id,
          invited_user_id,
          token_hash,
          status,
          expires_at,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          community_id,
          inviter_user_id,
          invited_user_id,
          status,
          expires_at,
          metadata,
          created_at,
          updated_at
      `,
      [
        communityId,
        inviterUserId,
        invitedUserId,
        tokenHash,
        INVITATION_STATUS.PENDING,
        expiresAt,
        JSON.stringify(metadata),
      ],
    );

    const invitation = invitationResult.rows[0];

    await createAuditLog({
      userId: inviterUserId,
      communityId,
      action: AUDIT_ACTIONS.INVITATION_CREATED,
      entityType: AUDIT_ENTITY_TYPES.INVITATION,
      entityId: invitation.id,
      newValues: {
        invitedUserId,
        status: invitation.status,
        expiresAt: invitation.expires_at,
      },
      client,
    });

    await client.query('COMMIT');

    await notifySafely({
      userId: invitedUserId,
      communityId,
      type: 'invitation_received',
      title: 'Community invitation received',
      message: 'You have received an invitation to join a community.',
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { invitationId: invitation.id },
    });

    return {
      ...invitation,
      token,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      throw createServiceError(
        'A pending invitation already exists for this user',
        409,
        'INVITATION_ALREADY_EXISTS',
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function getInvitationById(communityId, invitationId) {
  const result = await pool.query(
    `
      SELECT
        id,
        community_id,
        inviter_user_id,
        invited_user_id,
        status,
        expires_at,
        accepted_at,
        rejected_at,
        revoked_at,
        metadata,
        created_at,
        updated_at
      FROM community_invitations
      WHERE id = $1
        AND community_id = $2
    `,
    [invitationId, communityId],
  );

  if (result.rowCount === 0) {
    throw createServiceError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
  }

  return result.rows[0];
}

async function listInvitations(communityId, status) {
  const values = [communityId];
  let statusClause = '';

  if (status) {
    values.push(status);
    statusClause = `AND status = $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT
        id,
        community_id,
        inviter_user_id,
        invited_user_id,
        status,
        expires_at,
        accepted_at,
        rejected_at,
        revoked_at,
        metadata,
        created_at,
        updated_at
      FROM community_invitations
      WHERE community_id = $1
        ${statusClause}
      ORDER BY created_at DESC
    `,
    values,
  );

  return result.rows;
}

async function rejectInvitation(invitationId, invitedUserId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT *
        FROM community_invitations
        WHERE id = $1
        FOR UPDATE
      `,
      [invitationId],
    );

    if (result.rowCount === 0) {
      throw createServiceError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = result.rows[0];

    if (invitation.invited_user_id !== invitedUserId) {
      throw createServiceError(
        'You are not allowed to reject this invitation',
        403,
        'INVITATION_ACCESS_DENIED',
      );
    }

    if (invitation.status !== INVITATION_STATUS.PENDING) {
      throw createServiceError(
        'Only pending invitations can be rejected',
        409,
        'INVALID_INVITATION_STATUS',
      );
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      await client.query(
        `
          UPDATE community_invitations
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
        `,
        [INVITATION_STATUS.EXPIRED, invitationId],
      );

      await client.query('COMMIT');

      throw createServiceError('Invitation has expired', 409, 'INVITATION_EXPIRED');
    }

    const updatedResult = await client.query(
      `
        UPDATE community_invitations
        SET
          status = $1,
          rejected_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          community_id,
          inviter_user_id,
          invited_user_id,
          status,
          expires_at,
          rejected_at,
          created_at,
          updated_at
      `,
      [INVITATION_STATUS.REJECTED, invitationId],
    );

    const updatedInvitation = updatedResult.rows[0];

    await createAuditLog({
      userId: invitedUserId,
      communityId: invitation.community_id,
      action: AUDIT_ACTIONS.INVITATION_REJECTED,
      entityType: AUDIT_ENTITY_TYPES.INVITATION,
      entityId: invitationId,
      oldValues: {
        status: invitation.status,
      },
      newValues: {
        status: updatedInvitation.status,
        rejectedAt: updatedInvitation.rejected_at,
      },
      client,
    });

    await client.query('COMMIT');

    await notifySafely({
      userId: invitation.inviter_user_id,
      communityId: invitation.community_id,
      type: 'invitation_rejected',
      title: 'Invitation declined',
      message: 'A member has declined your community invitation.',
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { invitationId: invitation.id },
    });

    return updatedInvitation;
  } catch (error) {
    if (client._queryable) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Transaction may already be committed.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

// communityId is optional so existing callers keep working. When provided (as the
// HTTP route does), an invitation from any other community is reported as not found.
async function revokeInvitation(invitationId, actorUserId, communityId = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT *
        FROM community_invitations
        WHERE id = $1
        FOR UPDATE
      `,
      [invitationId],
    );

    if (result.rowCount === 0) {
      throw createServiceError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = result.rows[0];

    if (communityId && invitation.community_id !== communityId) {
      throw createServiceError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    if (invitation.status !== INVITATION_STATUS.PENDING) {
      throw createServiceError(
        'Only pending invitations can be revoked',
        409,
        'INVALID_INVITATION_STATUS',
      );
    }

    const updatedResult = await client.query(
      `
        UPDATE community_invitations
        SET
          status = $1,
          revoked_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          community_id,
          inviter_user_id,
          invited_user_id,
          status,
          expires_at,
          revoked_at,
          created_at,
          updated_at
      `,
      [INVITATION_STATUS.REVOKED, invitationId],
    );

    const updatedInvitation = updatedResult.rows[0];

    await createAuditLog({
      userId: actorUserId,
      communityId: invitation.community_id,
      action: AUDIT_ACTIONS.INVITATION_REVOKED,
      entityType: AUDIT_ENTITY_TYPES.INVITATION,
      entityId: invitationId,
      oldValues: {
        status: invitation.status,
      },
      newValues: {
        status: updatedInvitation.status,
        revokedAt: updatedInvitation.revoked_at,
      },
      client,
    });

    await client.query('COMMIT');

    return updatedInvitation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Accepts an invitation identified either by its secret token (the original
// flow) or by its ID (used by the in-app invitation inbox, which never receives
// the token). Both paths share the same recipient check, status/expiry rules and
// membership transaction below.
async function acceptInvitation({ invitationToken, invitationId, invitedUserId }) {
  if (!invitationId && (typeof invitationToken !== 'string' || !invitationToken)) {
    const error = createServiceError('invitationToken is required', 400, 'VALIDATION_ERROR');
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invitationResult = invitationId
      ? await client.query(
          `
            SELECT *
            FROM community_invitations
            WHERE id = $1
            FOR UPDATE
          `,
          [invitationId],
        )
      : await client.query(
          `
            SELECT *
            FROM community_invitations
            WHERE token_hash = $1
            FOR UPDATE
          `,
          [hashInvitationToken(invitationToken)],
        );

    if (invitationResult.rowCount === 0) {
      throw invitationId
        ? createServiceError('Invitation not found', 404, 'INVITATION_NOT_FOUND')
        : createServiceError('Invalid invitation token', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = invitationResult.rows[0];

    if (invitation.invited_user_id !== invitedUserId) {
      throw createServiceError(
        'This invitation does not belong to the authenticated user',
        403,
        'INVITATION_ACCESS_DENIED',
      );
    }

    if (invitation.status !== INVITATION_STATUS.PENDING) {
      throw createServiceError('Invitation is no longer pending', 409, 'INVALID_INVITATION_STATUS');
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      await client.query(
        `
          UPDATE community_invitations
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
        `,
        [INVITATION_STATUS.EXPIRED, invitation.id],
      );

      await client.query('COMMIT');

      throw createServiceError('Invitation has expired', 409, 'INVITATION_EXPIRED');
    }

    const membershipResult = await client.query(
      `
        SELECT id, status
        FROM community_memberships
        WHERE community_id = $1
          AND user_id = $2
        FOR UPDATE
      `,
      [invitation.community_id, invitedUserId],
    );

    if (membershipResult.rowCount > 0) {
      const membership = membershipResult.rows[0];

      if (
        membership.status === 'active' ||
        membership.status === 'pending' ||
        membership.status === 'suspended'
      ) {
        throw createServiceError(
          'User already has a membership in this community',
          409,
          'MEMBERSHIP_ALREADY_EXISTS',
        );
      }
    }

    const membership = await createMembership({
      communityId: invitation.community_id,
      userId: invitedUserId,
      metadata: {
        source: 'invitation',
        invitationId: invitation.id,
      },
      actorUserId: invitedUserId,
      client,
      initialStatus: 'active',
    });

    const updatedInvitationResult = await client.query(
      `
        UPDATE community_invitations
        SET
          status = $1,
          accepted_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          community_id,
          inviter_user_id,
          invited_user_id,
          status,
          expires_at,
          accepted_at,
          created_at,
          updated_at
      `,
      [INVITATION_STATUS.ACCEPTED, invitation.id],
    );

    const updatedInvitation = updatedInvitationResult.rows[0];

    await createAuditLog({
      userId: invitedUserId,
      communityId: invitation.community_id,
      action: AUDIT_ACTIONS.INVITATION_ACCEPTED,
      entityType: AUDIT_ENTITY_TYPES.INVITATION,
      entityId: invitation.id,
      oldValues: {
        status: invitation.status,
      },
      newValues: {
        status: updatedInvitation.status,
        acceptedAt: updatedInvitation.accepted_at,
      },
      client,
    });

    await client.query('COMMIT');

    await notifySafely({
      userId: invitation.inviter_user_id,
      communityId: invitation.community_id,
      type: 'invitation_accepted',
      title: 'Invitation accepted',
      message: 'A member has accepted your community invitation.',
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { invitationId: invitation.id },
    });

    return {
      invitation: updatedInvitation,
      membership,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const MY_INVITATION_STATUSES = Object.freeze(Object.values(INVITATION_STATUS));

// Pending invitations whose expiry has passed are reported as "expired" here even
// though the stored status only changes when someone acts on them.
const EFFECTIVE_INVITATION_STATUS_SQL = `
  CASE
    WHEN ci.status = 'pending' AND ci.expires_at <= NOW() THEN 'expired'
    ELSE ci.status
  END
`;

// Invitations addressed to the authenticated user. Never selects token_hash.
async function listMyInvitations({ userId, status, limit, offset }) {
  const params = [userId];
  let statusFilter = '';

  if (status) {
    params.push(status);
    statusFilter = `AND (${EFFECTIVE_INVITATION_STATUS_SQL}) = $${params.length}`;
  }

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM community_invitations ci
      JOIN communities c
        ON c.id = ci.community_id
       AND c.archived_at IS NULL
      WHERE ci.invited_user_id = $1
        ${statusFilter};
    `,
    params,
  );

  params.push(limit, offset);

  const result = await pool.query(
    `
      SELECT
        ci.id,
        ci.community_id,
        ci.status AS stored_status,
        (${EFFECTIVE_INVITATION_STATUS_SQL}) AS status,
        ci.expires_at,
        ci.accepted_at,
        ci.rejected_at,
        ci.created_at,
        c.name AS community_name,
        c.logo_url AS community_logo_url,
        COALESCE(
          NULLIF(TRIM(up.display_name), ''),
          NULLIF(TRIM(CONCAT_WS(' ', up.first_name, up.last_name)), '')
        ) AS inviter_name
      FROM community_invitations ci
      JOIN communities c
        ON c.id = ci.community_id
       AND c.archived_at IS NULL
      LEFT JOIN user_profiles up
        ON up.user_id = ci.inviter_user_id
      WHERE ci.invited_user_id = $1
        ${statusFilter}
      ORDER BY ci.created_at DESC, ci.id
      LIMIT $${params.length - 1}
      OFFSET $${params.length};
    `,
    params,
  );

  return {
    invitations: result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      rejectedAt: row.rejected_at,
      createdAt: row.created_at,
      community: {
        id: row.community_id,
        name: row.community_name,
        logoUrl: row.community_logo_url,
      },
      inviter: {
        name: row.inviter_name,
      },
    })),
    total: countResult.rows[0].total,
  };
}

module.exports = {
  MY_INVITATION_STATUSES,
  listMyInvitations,

  createInvitation,
  getInvitationById,
  listInvitations,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
  generateInvitationToken,
  hashInvitationToken,
};
