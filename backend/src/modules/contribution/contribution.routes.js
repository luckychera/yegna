const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { requirePermission } = require('../../middleware/authorization.middleware');
const { PERMISSIONS } = require('../authorization/permission.constants');

const { list, getById, create, update, waive, cancel } = require('./contribution.controller');

const router = express.Router();

router.get(
  '/:communityId/contributions',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_VIEW),
  list,
);

router.get(
  '/:communityId/contributions/:contributionId',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_VIEW),
  getById,
);

router.post(
  '/:communityId/contributions',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_CREATE),
  create,
);

router.patch(
  '/:communityId/contributions/:contributionId',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_UPDATE),
  update,
);

router.post(
  '/:communityId/contributions/:contributionId/waive',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_UPDATE),
  waive,
);

router.post(
  '/:communityId/contributions/:contributionId/cancel',
  authenticate,
  requirePermission(PERMISSIONS.CONTRIBUTIONS_UPDATE),
  cancel,
);

module.exports = router;
