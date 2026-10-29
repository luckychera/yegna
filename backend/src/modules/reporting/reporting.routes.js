const express = require('express');

const {
  authenticate,
} = require('../auth/auth.middleware');

const {
  requirePermission,
} = require('../authorization/authorization.middleware');

const {
  getCommunityOverviewController,
  getMembershipReportController,
  getContributionReportController,
  getPaymentReportController,
  getFinancialSummaryController,
} = require('./reporting.controller');

const router = express.Router();

router.get(
  '/community/:communityId',
  authenticate,
  requirePermission('reports.view'),
  getCommunityOverviewController,
);

router.get(
  '/membership/:communityId',
  authenticate,
  requirePermission('reports.view'),
  getMembershipReportController,
);

router.get(
  '/contributions/:communityId',
  authenticate,
  requirePermission('reports.view'),
  getContributionReportController,
);

router.get(
  '/payments/:communityId',
  authenticate,
  requirePermission('reports.view'),
  getPaymentReportController,
);

router.get(
  '/financial-summary/:communityId',
  authenticate,
  requirePermission('reports.view'),
  getFinancialSummaryController,
);

module.exports = router;
