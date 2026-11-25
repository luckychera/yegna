const REPORT_TYPE = Object.freeze({
  COMMUNITY_OVERVIEW: 'community_overview',
  MEMBERSHIP: 'membership',
  CONTRIBUTION: 'contribution',
  PAYMENT: 'payment',
  FINANCIAL_SUMMARY: 'financial_summary',
});

const REPORT_FORMAT = Object.freeze({
  JSON: 'json',
  CSV: 'csv',
});

const REPORT_PERIOD = Object.freeze({
  CURRENT: 'current',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  CUSTOM: 'custom',
});

module.exports = {
  REPORT_TYPE,
  REPORT_FORMAT,
  REPORT_PERIOD,
};
