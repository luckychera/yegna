const {
  REPORT_TYPE,
  REPORT_FORMAT,
  REPORT_PERIOD,
} = require('./reporting.constants');

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  return error;
}

function validateReportType(reportType) {
  if (
    typeof reportType !== 'string'
    || !Object.values(REPORT_TYPE).includes(reportType)
  ) {
    throw createValidationError('invalid report type');
  }

  return reportType;
}

function validateReportFormat(format = REPORT_FORMAT.JSON) {
  if (!Object.values(REPORT_FORMAT).includes(format)) {
    throw createValidationError('invalid report format');
  }

  return format;
}

function validateReportPeriod(period = REPORT_PERIOD.CURRENT) {
  if (!Object.values(REPORT_PERIOD).includes(period)) {
    throw createValidationError('invalid report period');
  }

  return period;
}

function validateCommunityId(communityId) {
  if (
    typeof communityId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(communityId)
  ) {
    throw createValidationError('communityId must be a valid UUID');
  }

  return communityId;
}

function validateDateRange({ startDate = null, endDate = null }) {
  if (startDate !== null && Number.isNaN(Date.parse(startDate))) {
    throw createValidationError('startDate must be a valid date');
  }

  if (endDate !== null && Number.isNaN(Date.parse(endDate))) {
    throw createValidationError('endDate must be a valid date');
  }

  if (
    startDate !== null
    && endDate !== null
    && new Date(startDate) > new Date(endDate)
  ) {
    throw createValidationError('startDate must not be after endDate');
  }

  return {
    startDate,
    endDate,
  };
}

module.exports = {
  validateReportType,
  validateReportFormat,
  validateReportPeriod,
  validateCommunityId,
  validateDateRange,
};
