const express = require('express');

const { authenticate } = require('../auth/auth.middleware');

const { requirePermission } = require('../../middleware/authorization.middleware');

const { PERMISSIONS } = require('../authorization/permission.constants');

const {
  list,
  getById,
  create,
  update,
  approve,
  reject,
  suspend,
  remove,
  join,
  leave,
} = require('./membership.controller');

const router = express.Router();

router.get(
  '/:communityId/members',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_VIEW),
  list,
);

router.get(
  '/:communityId/members/:membershipId',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_VIEW),
  getById,
);

router.post(
  '/:communityId/members',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_INVITE),
  create,
);

router.patch(
  '/:communityId/members/:membershipId',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_UPDATE),
  update,
);

router.post(
  '/:communityId/members/:membershipId/approve',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_UPDATE),
  approve,
);

router.post(
  '/:communityId/members/:membershipId/reject',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_UPDATE),
  reject,
);

router.post(
  '/:communityId/members/:membershipId/suspend',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_REMOVE),
  suspend,
);

router.post(
  '/:communityId/members/:membershipId/remove',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_REMOVE),
  remove,
);

// Self-service membership: any authenticated user acting on their own membership.
// Business rules (approval, transitions) are enforced by the membership service.
router.post('/:communityId/join', authenticate, join);

router.post('/:communityId/leave', authenticate, leave);

module.exports = router;
