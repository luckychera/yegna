const { pool } = require('../../config/database');
const { createAuditLog } = require('../audit/audit.service');
const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { CONTRIBUTION_STATUS } = require('./contribution.constants');
const { notifySafely } = require('../notification/notification.events');

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
  const membership = await ensureActiveMembership(communityId, membershipId);

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

    await notifySafely({
      userId: membership.user_id,
      communityId,
      type: 'contribution_created',
      title: 'New contribution assigned',
      message: `A contribution of ${contribution.currency} ${contribution.amount} has been assigned to you.`,
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: {
        contributionId: contribution.id,
        dueDate: contribution.due_date,
        amount: contribution.amount,
        currency: contribution.currency,
      },
    });

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

// Contributions are due on an Ethiopian calendar day, so "past due" is evaluated in
// Africa/Addis_Ababa regardless of the database session time zone.
const TODAY_IN_ETHIOPIA_SQL = "(NOW() AT TIME ZONE 'Africa/Addis_Ababa')::DATE";

// Unpaid contributions whose due date has passed. The stored status is only moved
// to "overdue" by explicit status changes, so this is derived for display purposes.
const IS_PAST_DUE_SQL = `(
  c.status = 'overdue'
  OR (c.status IN ('pending', 'partially_paid') AND c.due_date < ${TODAY_IN_ETHIOPIA_SQL})
)`;

const OUTSTANDING_AMOUNT_SQL = 'GREATEST(c.amount - c.paid_amount - c.waived_amount, 0)';

// The caller's own contributions across every community they have a membership in.
// Amounts are returned as decimal strings to avoid floating point money errors.
async function listMyContributions({
  userId,
  status,
  communityId,
  dueFrom,
  dueTo,
  limit,
  offset,
}) {
  const params = [userId];
  const filters = ['cm.user_id = $1'];

  if (status) {
    params.push(status);
    filters.push(`c.status = $${params.length}`);
  }

  if (communityId) {
    params.push(communityId);
    filters.push(`c.community_id = $${params.length}`);
  }

  if (dueFrom) {
    params.push(dueFrom);
    filters.push(`c.due_date >= $${params.length}::DATE`);
  }

  if (dueTo) {
    params.push(dueTo);
    filters.push(`c.due_date <= $${params.length}::DATE`);
  }

  const where = filters.join(' AND ');

  const summaryResult = await pool.query(
    `
      SELECT
        c.currency,
        COUNT(*)::INT AS count,
        COALESCE(SUM(c.amount), 0) AS total_amount,
        COALESCE(SUM(c.paid_amount), 0) AS paid_amount,
        COALESCE(
          SUM(${OUTSTANDING_AMOUNT_SQL})
            FILTER (WHERE c.status IN ('pending', 'partially_paid', 'overdue')),
          0
        ) AS outstanding_amount,
        COUNT(*) FILTER (
          WHERE c.status IN ('pending', 'partially_paid') AND NOT ${IS_PAST_DUE_SQL}
        )::INT AS pending_count,
        COUNT(*) FILTER (WHERE ${IS_PAST_DUE_SQL})::INT AS overdue_count
      FROM contributions c
      JOIN community_memberships cm
        ON cm.id = c.membership_id
      WHERE ${where}
      GROUP BY c.currency
      ORDER BY c.currency;
    `,
    params,
  );

  const total = summaryResult.rows.reduce((sum, row) => sum + row.count, 0);

  params.push(limit, offset);

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
        ${OUTSTANDING_AMOUNT_SQL} AS outstanding_amount,
        ${IS_PAST_DUE_SQL} AS is_past_due,
        c.notes,
        c.created_at,
        co.name AS community_name,
        co.logo_url AS community_logo_url
      FROM contributions c
      JOIN community_memberships cm
        ON cm.id = c.membership_id
      JOIN communities co
        ON co.id = c.community_id
      WHERE ${where}
      ORDER BY c.due_date DESC, c.created_at DESC, c.id
      LIMIT $${params.length - 1}
      OFFSET $${params.length};
    `,
    params,
  );

  return {
    contributions: result.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      membershipId: row.membership_id,
      community: {
        id: row.community_id,
        name: row.community_name,
        logoUrl: row.community_logo_url,
      },
      periodStart: row.contribution_period_start,
      periodEnd: row.contribution_period_end,
      dueDate: row.due_date,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      isOverdue: row.is_past_due,
      paidAmount: row.paid_amount,
      waivedAmount: row.waived_amount,
      penaltyAmount: row.penalty_amount,
      outstandingAmount: row.outstanding_amount,
      notes: row.notes,
      createdAt: row.created_at,
    })),
    summary: summaryResult.rows.map((row) => ({
      currency: row.currency,
      count: row.count,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      outstandingAmount: row.outstanding_amount,
      pendingCount: row.pending_count,
      overdueCount: row.overdue_count,
    })),
    total,
  };
}

module.exports = {
  listMyContributions,

  listContributions,
  getContributionById,
  createContribution,
  updateContribution,
  changeContributionStatus,
};
