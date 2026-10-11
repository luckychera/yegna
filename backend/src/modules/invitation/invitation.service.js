const crypto = require('crypto');

const { pool } = require('../../config/database');
const { INVITATION_STATUS, INVITATION_DEFAULT_EXPIRY_DAYS } = require('./invitation.constants');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { createMembership } = require('../membership/membership.service');

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

async function revokeInvitation(invitationId, actorUserId) {
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

async function acceptInvitation({ invitationToken, invitedUserId }) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const tokenHash = hashInvitationToken(invitationToken);

    const invitationResult = await client.query(
      `
        SELECT *
        FROM community_invitations
        WHERE token_hash = $1
        FOR UPDATE
      `,
      [tokenHash],
    );

    if (invitationResult.rowCount === 0) {
      throw createServiceError('Invalid invitation token', 404, 'INVITATION_NOT_FOUND');
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

module.exports = {
  createInvitation,
  getInvitationById,
  listInvitations,
  acceptInvitation,
  rejectInvitation,
  revokeInvitation,
  generateInvitationToken,
  hashInvitationToken,
};
