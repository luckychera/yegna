const { pool } = require('../../config/database');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { CONTRIBUTION_STATUS } = require('./contribution.constants');

function createContributionError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function ensureCommunityExists(communityId) {
  const result = await pool.query(
    `
      SELECT id, name, status
      FROM communities
      WHERE id = $1
        AND archived_at IS NULL;
    `,
    [communityId],
  );

  if (result.rows.length === 0) {
    throw createContributionError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
  }

  return result.rows[0];
}

async function ensureMembershipExists(communityId, membershipId) {
  const result = await pool.query(
    `
      SELECT
        cm.id,
        cm.community_id,
        cm.user_id,
        cm.membership_number,
        cm.status,
        cm.joined_at,
        cm.approved_at
      FROM community_memberships cm
      WHERE cm.id = $1
        AND cm.community_id = $2;
    `,
    [membershipId, communityId],
  );

  if (result.rows.length === 0) {
    throw createContributionError('Membership not found', 404, 'MEMBERSHIP_NOT_FOUND');
  }

  return result.rows[0];
}

async function ensureActiveMembership(communityId, membershipId) {
  const membership = await ensureMembershipExists(communityId, membershipId);

  if (membership.status !== 'active') {
    throw createContributionError(
      'Contribution can only be created for an active membership',
      400,
      'MEMBERSHIP_NOT_ACTIVE',
    );
  }

  return membership;
}

async function listContributions(communityId) {
  await ensureCommunityExists(communityId);

  const result = await pool.query(
    `
      SELECT
        c.id,
        c.community_id,
        c.membership_id,
        c.contribution_period_start,
        c.contribution_period_end,
        c.due_date,
        c.amount,
        c.currency,
        c.status,
        c.paid_amount,
        c.waived_amount,
        c.penalty_amount,
        c.notes,
        c.created_at,
        c.updated_at,

        cm.user_id,
        cm.membership_number,

        up.first_name,
        up.middle_name,
        up.last_name,
        up.display_name

      FROM contributions c
      JOIN community_memberships cm
        ON cm.id = c.membership_id
      JOIN users u
        ON u.id = cm.user_id
      LEFT JOIN user_profiles up
        ON up.user_id = u.id

      WHERE c.community_id = $1
      ORDER BY c.due_date ASC, c.created_at ASC;
    `,
    [communityId],
  );

  return result.rows;
}

async function getContributionById(communityId, contributionId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.community_id,
        c.membership_id,
        c.contribution_period_start,
        c.contribution_period_end,
        c.due_date,
        c.amount,
        c.currency,
        c.status,
        c.paid_amount,
        c.waived_amount,
        c.penalty_amount,
        c.notes,
        c.created_at,
        c.updated_at,

        cm.user_id,
        cm.membership_number,

        up.first_name,
        up.middle_name,
        up.last_name,
        up.display_name

      FROM contributions c
      JOIN community_memberships cm
        ON cm.id = c.membership_id
      JOIN users u
        ON u.id = cm.user_id
      LEFT JOIN user_profiles up
        ON up.user_id = u.id

      WHERE c.community_id = $1
        AND c.id = $2;
    `,
    [communityId, contributionId],
  );

  if (result.rows.length === 0) {
    throw createContributionError('Contribution not found', 404, 'CONTRIBUTION_NOT_FOUND');
  }

  return result.rows[0];
}

async function createContribution({
  communityId,
  membershipId,
  contributionPeriodStart,
  contributionPeriodEnd,
  dueDate,
  amount,
  currency,
  notes = null,
  actorUserId,
}) {
  await ensureCommunityExists(communityId);
  await ensureActiveMembership(communityId, membershipId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const duplicateResult = await client.query(
      `
        SELECT id
        FROM contributions
        WHERE community_id = $1
          AND membership_id = $2
          AND contribution_period_start = $3
          AND contribution_period_end = $4
        FOR UPDATE;
      `,
      [communityId, membershipId, contributionPeriodStart, contributionPeriodEnd],
    );

    if (duplicateResult.rows.length > 0) {
      throw createContributionError(
        'A contribution already exists for this membership and period',
        409,
        'CONTRIBUTION_ALREADY_EXISTS',
      );
    }

    const result = await client.query(
      `
        INSERT INTO contributions (
          community_id,
          membership_id,
          contribution_period_start,
          contribution_period_end,
          due_date,
          amount,
          currency,
          status,
          paid_amount,
          waived_amount,
          penalty_amount,
          notes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          0,
          0,
          0,
          $9
        )
        RETURNING
          id,
          community_id,
          membership_id,
          contribution_period_start,
          contribution_period_end,
          due_date,
          amount,
          currency,
          status,
          paid_amount,
          waived_amount,
          penalty_amount,
          notes,
          created_at,
          updated_at;
      `,
      [
        communityId,
        membershipId,
        contributionPeriodStart,
        contributionPeriodEnd,
        dueDate,
        amount,
        currency,
        CONTRIBUTION_STATUS.PENDING,
        notes,
      ],
    );

    const contribution = result.rows[0];

    await createAuditLog({
      userId: actorUserId,
      communityId,
      action: AUDIT_ACTIONS.CONTRIBUTION_CREATED,
      entityType: AUDIT_ENTITY_TYPES.CONTRIBUTION,
      entityId: contribution.id,
      newValues: contribution,
      client,
    });

    await client.query('COMMIT');

    return contribution;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateContribution(communityId, contributionId, updates, actorUserId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
        SELECT *
        FROM contributions
        WHERE community_id = $1
          AND id = $2
        FOR UPDATE;
      `,
      [communityId, contributionId],
    );

    if (existingResult.rows.length === 0) {
      throw createContributionError('Contribution not found', 404, 'CONTRIBUTION_NOT_FOUND');
    }

    const existing = existingResult.rows[0];

    if (
      existing.status === CONTRIBUTION_STATUS.PAID ||
      existing.status === CONTRIBUTION_STATUS.WAIVED ||
      existing.status === CONTRIBUTION_STATUS.CANCELLED
    ) {
      throw createContributionError(
        'This contribution can no longer be edited',
        400,
        'CONTRIBUTION_NOT_EDITABLE',
      );
    }

    const periodStart = updates.contributionPeriodStart || existing.contribution_period_start;

    const periodEnd = updates.contributionPeriodEnd || existing.contribution_period_end;

    if (periodEnd < periodStart) {
      throw createContributionError(
        'contributionPeriodEnd cannot be before contributionPeriodStart',
        400,
        'INVALID_CONTRIBUTION_PERIOD',
      );
    }

    const result = await client.query(
      `
        UPDATE contributions
        SET
          contribution_period_start = $1,
          contribution_period_end = $2,
          due_date = COALESCE($3, due_date),
          amount = COALESCE($4, amount),
          currency = COALESCE($5, currency),
          notes = CASE
            WHEN $6::BOOLEAN THEN $7
            ELSE notes
          END
          WHERE id = $8
            AND community_id = $9
          RETURNING
          id,
          community_id,
          membership_id,
          contribution_period_start,
          contribution_period_end,
          due_date,
          amount,
          currency,
          status,
          paid_amount,
          waived_amount,
          penalty_amount,
          notes,
          created_at,
          updated_at;
      `,
      [
        periodStart,
        periodEnd,
        updates.dueDate || null,
        updates.amount || null,
        updates.currency || null,
        Object.prototype.hasOwnProperty.call(updates, 'notes'),
        updates.notes,
        contributionId,
        communityId,
      ],
    );

    const contribution = result.rows[0];

    await createAuditLog({
      userId: actorUserId,
      communityId,
      action: AUDIT_ACTIONS.CONTRIBUTION_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.CONTRIBUTION,
      entityId: contribution.id,
      oldValues: existing,
      newValues: contribution,
      client,
    });

    await client.query('COMMIT');

    return contribution;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function changeContributionStatus(communityId, contributionId, status, actorUserId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT *
        FROM contributions
        WHERE community_id = $1
          AND id = $2
        FOR UPDATE;
      `,
      [communityId, contributionId],
    );

    if (result.rows.length === 0) {
      throw createContributionError('Contribution not found', 404, 'CONTRIBUTION_NOT_FOUND');
    }

    const existing = result.rows[0];

    if (
      existing.status === CONTRIBUTION_STATUS.PAID ||
      existing.status === CONTRIBUTION_STATUS.WAIVED ||
      existing.status === CONTRIBUTION_STATUS.CANCELLED
    ) {
      throw createContributionError(
        'This contribution has reached a final state',
        400,
        'CONTRIBUTION_FINALIZED',
      );
    }

    if (status === CONTRIBUTION_STATUS.WAIVED && Number(existing.paid_amount) > 0) {
      throw createContributionError(
        'A partially paid contribution cannot be waived',
        400,
        'CONTRIBUTION_ALREADY_PARTIALLY_PAID',
      );
    }

    const updatedResult = await client.query(
      `
        UPDATE contributions
        SET
          status = $1
        WHERE community_id = $2
          AND id = $3
        RETURNING
          id,
          community_id,
          membership_id,
          contribution_period_start,
          contribution_period_end,
          due_date,
          amount,
          currency,
          status,
          paid_amount,
          waived_amount,
          penalty_amount,
          notes,
          created_at,
          updated_at;
      `,
      [status, communityId, contributionId],
    );

    const contribution = updatedResult.rows[0];

    await createAuditLog({
      userId: actorUserId,
      communityId,
      action:
        status === CONTRIBUTION_STATUS.WAIVED
          ? AUDIT_ACTIONS.CONTRIBUTION_WAIVED
          : AUDIT_ACTIONS.CONTRIBUTION_CANCELLED,
      entityType: AUDIT_ENTITY_TYPES.CONTRIBUTION,
      entityId: contribution.id,
      oldValues: existing,
      newValues: contribution,
      client,
    });

    await client.query('COMMIT');

    return contribution;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listContributions,
  getContributionById,
  createContribution,
  updateContribution,
  changeContributionStatus,
};
