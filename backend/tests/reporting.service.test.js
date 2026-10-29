const assert = require('node:assert/strict');
const test = require('node:test');

const { pool } = require('../src/config/database');

const {
  getPeriodDates,
  getCommunityOverview,
  getMembershipReport,
  getContributionReport,
  getPaymentReport,
  getFinancialSummary,
  getReport,
} = require('../src/modules/reporting/reporting.service');

const { REPORT_TYPE, REPORT_PERIOD } = require('../src/modules/reporting/reporting.constants');

const TEST_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';

test.after(async () => {
  await pool.end();
});

test('gets the current reporting period', () => {
  const result = getPeriodDates({
    period: REPORT_PERIOD.CURRENT,
  });

  assert.equal(result.startDate, null);
  assert.equal(result.endDate, null);
});

test('gets the current month reporting period', () => {
  const result = getPeriodDates({
    period: REPORT_PERIOD.MONTH,
  });

  assert.ok(result.startDate instanceof Date);
  assert.ok(result.endDate instanceof Date);
  assert.ok(result.startDate <= result.endDate);
  assert.equal(result.startDate.getUTCDate(), 1);
});

test('gets the current quarter reporting period', () => {
  const result = getPeriodDates({
    period: REPORT_PERIOD.QUARTER,
  });

  assert.ok(result.startDate instanceof Date);
  assert.ok(result.endDate instanceof Date);
  assert.ok(result.startDate <= result.endDate);
});

test('gets the current year reporting period', () => {
  const result = getPeriodDates({
    period: REPORT_PERIOD.YEAR,
  });

  assert.ok(result.startDate instanceof Date);
  assert.ok(result.endDate instanceof Date);
  assert.equal(result.startDate.getUTCMonth(), 0);
  assert.equal(result.startDate.getUTCDate(), 1);
});

test('validates a custom reporting period', () => {
  const result = getPeriodDates({
    period: REPORT_PERIOD.CUSTOM,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  });

  assert.equal(result.startDate, '2026-01-01');
  assert.equal(result.endDate, '2026-03-31');
});

test('rejects an invalid custom reporting date range', () => {
  assert.throws(
    () =>
      getPeriodDates({
        period: REPORT_PERIOD.CUSTOM,
        startDate: '2026-04-01',
        endDate: '2026-03-01',
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});

test('gets the community overview report', async () => {
  const report = await getCommunityOverview(TEST_COMMUNITY_ID);

  assert.equal(report.community.id, TEST_COMMUNITY_ID);

  assert.ok(report.community.name);
  assert.ok(report.memberships);
  assert.ok(report.contributions);
  assert.ok(report.payments);

  assert.equal(typeof report.memberships.total_memberships, 'number');

  assert.equal(typeof report.contributions.total_contributions, 'number');

  assert.equal(typeof report.payments.total_payments, 'number');
});

test('gets the membership report', async () => {
  const report = await getMembershipReport(TEST_COMMUNITY_ID);

  assert.ok(report.summary);
  assert.ok(Array.isArray(report.roles));

  assert.equal(typeof report.summary.total_members, 'number');

  assert.equal(typeof report.summary.active_members, 'number');
});

test('gets the contribution report', async () => {
  const report = await getContributionReport(TEST_COMMUNITY_ID, {
    period: REPORT_PERIOD.CURRENT,
  });

  assert.equal(report.period.type, REPORT_PERIOD.CURRENT);

  assert.ok(report.summary);

  assert.equal(typeof report.summary.total_contributions, 'number');

  assert.equal(typeof report.summary.total_expected, 'string');

  assert.equal(typeof report.summary.total_paid, 'string');

  assert.equal(typeof report.summary.total_outstanding, 'string');
});

test('gets the payment report', async () => {
  const report = await getPaymentReport(TEST_COMMUNITY_ID, {
    period: REPORT_PERIOD.CURRENT,
  });

  assert.equal(report.period.type, REPORT_PERIOD.CURRENT);

  assert.ok(report.summary);

  assert.equal(typeof report.summary.total_payments, 'number');

  assert.equal(typeof report.summary.successful_payments, 'number');

  assert.equal(typeof report.summary.successful_amount, 'string');
});

test('gets the financial summary report', async () => {
  const report = await getFinancialSummary(TEST_COMMUNITY_ID, {
    period: REPORT_PERIOD.CURRENT,
  });

  assert.ok(report.period);
  assert.ok(report.contributions);
  assert.ok(report.payments);
  assert.ok(report.ledger);

  assert.equal(typeof report.ledger.total_ledger_entries, 'number');

  assert.equal(typeof report.ledger.total_credits, 'string');

  assert.equal(typeof report.ledger.total_debits, 'string');
});

test('gets reports through the generic report dispatcher', async () => {
  const overview = await getReport({
    communityId: TEST_COMMUNITY_ID,
    reportType: REPORT_TYPE.COMMUNITY_OVERVIEW,
  });

  assert.equal(overview.community.id, TEST_COMMUNITY_ID);

  const membership = await getReport({
    communityId: TEST_COMMUNITY_ID,
    reportType: REPORT_TYPE.MEMBERSHIP,
  });

  assert.ok(membership.summary);

  const contribution = await getReport({
    communityId: TEST_COMMUNITY_ID,
    reportType: REPORT_TYPE.CONTRIBUTION,
  });

  assert.ok(contribution.summary);

  const payment = await getReport({
    communityId: TEST_COMMUNITY_ID,
    reportType: REPORT_TYPE.PAYMENT,
  });

  assert.ok(payment.summary);

  const financial = await getReport({
    communityId: TEST_COMMUNITY_ID,
    reportType: REPORT_TYPE.FINANCIAL_SUMMARY,
  });

  assert.ok(financial.ledger);
});

test('rejects an unknown community', async () => {
  await assert.rejects(
    () => getCommunityOverview('11111111-1111-4111-8111-111111111111'),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'COMMUNITY_NOT_FOUND');
      return true;
    },
  );
});

test('rejects an invalid community ID', async () => {
  await assert.rejects(
    () => getCommunityOverview('not-a-uuid'),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'VALIDATION_ERROR');
      return true;
    },
  );
});

test('rejects an unsupported report type', async () => {
  await assert.rejects(
    () =>
      getReport({
        communityId: TEST_COMMUNITY_ID,
        reportType: 'invalid_report',
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'INVALID_REPORT_TYPE');
      return true;
    },
  );
});
