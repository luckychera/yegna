const { pool } = require('../../config/database');

const { REPORT_PERIOD } = require('./reporting.constants');

const {
  validateCommunityId,
  validateReportPeriod,
  validateDateRange,
} = require('./reporting.validation');

function createReportingError(message, statusCode = 400, code = 'REPORTING_ERROR') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getPeriodDates({ period = REPORT_PERIOD.CURRENT, startDate = null, endDate = null }) {
  validateReportPeriod(period);

  if (period === REPORT_PERIOD.CUSTOM) {
    return validateDateRange({
      startDate,
      endDate,
    });
  }

  const now = new Date();

  if (period === REPORT_PERIOD.CURRENT) {
    return {
      startDate: null,
      endDate: null,
    };
  }

  if (period === REPORT_PERIOD.MONTH) {
    return {
      startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      endDate: now,
    };
  }

  if (period === REPORT_PERIOD.QUARTER) {
    const quarterStartMonth = Math.floor(now.getUTCMonth() / 3) * 3;

    return {
      startDate: new Date(Date.UTC(now.getUTCFullYear(), quarterStartMonth, 1)),
      endDate: now,
    };
  }

  if (period === REPORT_PERIOD.YEAR) {
    return {
      startDate: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)),
      endDate: now,
    };
  }

  return {
    startDate: null,
    endDate: null,
  };
}

async function ensureCommunityExists(communityId, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        community_type,
        status,
        created_at
      FROM communities
      WHERE id = $1
      LIMIT 1
    `,
    [communityId],
  );

  if (result.rowCount === 0) {
    throw createReportingError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
  }

  return result.rows[0];
}

async function getCommunityOverview(communityId, client = pool) {
  validateCommunityId(communityId);

  const community = await ensureCommunityExists(communityId, client);

  const membershipResult = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_memberships,
        COUNT(*) FILTER (
          WHERE status = 'active'
        )::INTEGER AS active_memberships,
        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending_memberships,
        COUNT(*) FILTER (
          WHERE status = 'suspended'
        )::INTEGER AS suspended_memberships,
        COUNT(*) FILTER (
          WHERE status = 'left'
        )::INTEGER AS left_memberships
      FROM community_memberships
      WHERE community_id = $1
    `,
    [communityId],
  );

  const contributionResult = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_contributions,
        COALESCE(
          SUM(amount),
          0
        )::NUMERIC(18, 2) AS total_expected,
        COALESCE(
          SUM(paid_amount),
          0
        )::NUMERIC(18, 2) AS total_paid
      FROM contributions
      WHERE community_id = $1
    `,
    [communityId],
  );

  const paymentResult = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_payments,
        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'successful'
          ),
          0
        )::NUMERIC(18, 2) AS successful_payment_amount
      FROM payment_transactions
      WHERE community_id = $1
    `,
    [communityId],
  );

  return {
    community,
    memberships: membershipResult.rows[0],
    contributions: contributionResult.rows[0],
    payments: paymentResult.rows[0],
  };
}

async function getMembershipReport(communityId, client = pool) {
  validateCommunityId(communityId);

  await ensureCommunityExists(communityId, client);

  const summaryResult = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_members,
        COUNT(*) FILTER (
          WHERE status = 'active'
        )::INTEGER AS active_members,
        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending_members,
        COUNT(*) FILTER (
          WHERE status = 'suspended'
        )::INTEGER AS suspended_members,
        COUNT(*) FILTER (
          WHERE status = 'left'
        )::INTEGER AS left_members
      FROM community_memberships
      WHERE community_id = $1
    `,
    [communityId],
  );

  const roleResult = await client.query(
    `
      SELECT
        cr.id AS role_id,
        cr.name AS role_name,
        COUNT(cmr.membership_id)::INTEGER AS member_count
      FROM community_roles cr
      LEFT JOIN membership_roles cmr
        ON cmr.role_id = cr.id
      LEFT JOIN community_memberships cm
        ON cm.id = cmr.membership_id
       AND cm.community_id = $1
      WHERE cr.community_id = $1
      GROUP BY cr.id, cr.name
      ORDER BY member_count DESC, cr.name ASC
    `,
    [communityId],
  );

  return {
    summary: summaryResult.rows[0],
    roles: roleResult.rows,
  };
}

async function getContributionReport(communityId, options = {}, client = pool) {
  validateCommunityId(communityId);

  await ensureCommunityExists(communityId, client);

  const { period = REPORT_PERIOD.CURRENT, startDate = null, endDate = null } = options;

  const dates = getPeriodDates({
    period,
    startDate,
    endDate,
  });

  const conditions = ['community_id = $1'];
  const values = [communityId];

  if (dates.startDate) {
    values.push(dates.startDate);
    conditions.push(`due_date >= $${values.length}`);
  }

  if (dates.endDate) {
    values.push(dates.endDate);
    conditions.push(`due_date <= $${values.length}`);
  }

  const result = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_contributions,

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending_contributions,

        COUNT(*) FILTER (
          WHERE status = 'paid'
        )::INTEGER AS paid_contributions,

        COUNT(*) FILTER (
          WHERE status = 'overdue'
        )::INTEGER AS overdue_contributions,

        COUNT(*) FILTER (
          WHERE status = 'waived'
        )::INTEGER AS waived_contributions,

        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::INTEGER AS cancelled_contributions,

        COALESCE(
          SUM(amount),
          0
        )::NUMERIC(18, 2) AS total_expected,

        COALESCE(
          SUM(paid_amount),
          0
        )::NUMERIC(18, 2) AS total_paid,

        COALESCE(
          SUM(
            GREATEST(
              amount - paid_amount,
              0
            )
          ),
          0
        )::NUMERIC(18, 2) AS total_outstanding

      FROM contributions
      WHERE ${conditions.join(' AND ')}
    `,
    values,
  );

  return {
    period: {
      type: period,
      startDate: dates.startDate,
      endDate: dates.endDate,
    },
    summary: result.rows[0],
  };
}

async function getPaymentReport(communityId, options = {}, client = pool) {
  validateCommunityId(communityId);

  await ensureCommunityExists(communityId, client);

  const { period = REPORT_PERIOD.CURRENT, startDate = null, endDate = null } = options;

  const dates = getPeriodDates({
    period,
    startDate,
    endDate,
  });

  const conditions = ['community_id = $1'];
  const values = [communityId];

  if (dates.startDate) {
    values.push(dates.startDate);
    conditions.push(`created_at >= $${values.length}`);
  }

  if (dates.endDate) {
    values.push(dates.endDate);
    conditions.push(`created_at <= $${values.length}`);
  }

  const result = await client.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_payments,

        COUNT(*) FILTER (
          WHERE status = 'pending'
        )::INTEGER AS pending_payments,

        COUNT(*) FILTER (
          WHERE status = 'processing'
        )::INTEGER AS processing_payments,

        COUNT(*) FILTER (
          WHERE status = 'successful'
        )::INTEGER AS successful_payments,

        COUNT(*) FILTER (
          WHERE status = 'failed'
        )::INTEGER AS failed_payments,

        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::INTEGER AS cancelled_payments,

        COUNT(*) FILTER (
          WHERE status = 'refunded'
        )::INTEGER AS refunded_payments,

        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'successful'
          ),
          0
        )::NUMERIC(18, 2) AS successful_amount,

        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'refunded'
          ),
          0
        )::NUMERIC(18, 2) AS refunded_amount

      FROM payment_transactions
      WHERE ${conditions.join(' AND ')}
    `,
    values,
  );

  return {
    period: {
      type: period,
      startDate: dates.startDate,
      endDate: dates.endDate,
    },
    summary: result.rows[0],
  };
}

async function getFinancialSummary(communityId, options = {}, client = pool) {
  validateCommunityId(communityId);

  await ensureCommunityExists(communityId, client);

  const contributionReport = await getContributionReport(communityId, options, client);

  const paymentReport = await getPaymentReport(communityId, options, client);

  const ledgerResult = await client.query(
    `
    SELECT
      COUNT(le.id)::INTEGER AS total_ledger_entries,

      COALESCE(
        SUM(le.amount) FILTER (
          WHERE le.entry_type = 'credit'
        ),
        0
      )::NUMERIC(18, 2) AS total_credits,

      COALESCE(
        SUM(le.amount) FILTER (
          WHERE le.entry_type = 'debit'
        ),
        0
      )::NUMERIC(18, 2) AS total_debits

    FROM ledger_entries le
    INNER JOIN financial_accounts fa
      ON fa.id = le.account_id
    WHERE fa.community_id = $1
  `,
    [communityId],
  );

  const ledger = ledgerResult.rows[0];

  return {
    period: contributionReport.period,
    contributions: contributionReport.summary,
    payments: paymentReport.summary,
    ledger,
  };
}

async function getReport({
  communityId,
  reportType,
  period = REPORT_PERIOD.CURRENT,
  startDate = null,
  endDate = null,
}) {
  validateCommunityId(communityId);

  switch (reportType) {
    case 'community_overview':
      return getCommunityOverview(communityId);

    case 'membership':
      return getMembershipReport(communityId);

    case 'contribution':
      return getContributionReport(communityId, {
        period,
        startDate,
        endDate,
      });

    case 'payment':
      return getPaymentReport(communityId, {
        period,
        startDate,
        endDate,
      });

    case 'financial_summary':
      return getFinancialSummary(communityId, {
        period,
        startDate,
        endDate,
      });

    default:
      throw createReportingError('Unsupported report type', 400, 'INVALID_REPORT_TYPE');
  }
}

module.exports = {
  getPeriodDates,
  ensureCommunityExists,
  getCommunityOverview,
  getMembershipReport,
  getContributionReport,
  getPaymentReport,
  getFinancialSummary,
  getReport,
};
