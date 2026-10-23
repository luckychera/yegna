const { getReport } = require('./reporting.service');

const { validateCommunityId, validateReportPeriod } = require('./reporting.validation');

const { REPORT_TYPE, REPORT_PERIOD } = require('./reporting.constants');

function sendReport(res, report) {
  return res.status(200).json({
    success: true,
    data: report,
  });
}

function getCommonReportOptions(query) {
  const period = query.period || REPORT_PERIOD.CURRENT;

  validateReportPeriod(period);

  const options = {
    period,
  };

  if (period === REPORT_PERIOD.CUSTOM) {
    options.startDate = query.startDate;
    options.endDate = query.endDate;
  }

  return options;
}

async function getCommunityOverviewController(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const report = await getReport({
      communityId,
      reportType: REPORT_TYPE.COMMUNITY_OVERVIEW,
    });

    return sendReport(res, report);
  } catch (error) {
    return next(error);
  }
}

async function getMembershipReportController(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const report = await getReport({
      communityId,
      reportType: REPORT_TYPE.MEMBERSHIP,
    });

    return sendReport(res, report);
  } catch (error) {
    return next(error);
  }
}

async function getContributionReportController(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const report = await getReport({
      communityId,
      reportType: REPORT_TYPE.CONTRIBUTION,
      ...getCommonReportOptions(req.query),
    });

    return sendReport(res, report);
  } catch (error) {
    return next(error);
  }
}

async function getPaymentReportController(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const report = await getReport({
      communityId,
      reportType: REPORT_TYPE.PAYMENT,
      options: getCommonReportOptions(req.query),
    });

    return sendReport(res, report);
  } catch (error) {
    return next(error);
  }
}

async function getFinancialSummaryController(req, res, next) {
  try {
    const communityId = validateCommunityId(req.params.communityId);

    const report = await getReport({
      communityId,
      reportType: REPORT_TYPE.FINANCIAL_SUMMARY,
      options: getCommonReportOptions(req.query),
    });

    return sendReport(res, report);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCommunityOverviewController,
  getMembershipReportController,
  getContributionReportController,
  getPaymentReportController,
  getFinancialSummaryController,
};
