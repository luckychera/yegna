const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const {
  getMyAuthorization,
  checkMembersViewAccess,
} = require('./authorization.controller');

const { requirePermission } = require('../../middleware/authorization.middleware');
const { PERMISSIONS } = require('./permission.constants');

const router = express.Router();

router.get('/me', authenticate, getMyAuthorization);

router.get(
  '/communities/:communityId/members/access',
  authenticate,
  requirePermission(PERMISSIONS.MEMBERS_VIEW),
  checkMembersViewAccess,
);

module.exports = router;



