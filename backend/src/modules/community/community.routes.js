const express = require('express');

const { authenticate } = require('../auth/auth.middleware');

const {
  requirePermission,
} = require('../../middleware/authorization.middleware');

const { PERMISSIONS } = require('../authorization/permission.constants');

const {
  create,
  getById,
  update,
  list,
  listMine,
} = require('./community.controller');

const router = express.Router();

router.post(
  '/',
  authenticate,
  create,
);

router.get(
  '/',
  authenticate,
  list,
);

// Must stay above '/:communityId' so "me" is never parsed as a community ID.
router.get(
  '/me',
  authenticate,
  listMine,
);

router.get(
  '/:communityId',
  authenticate,
  requirePermission(PERMISSIONS.COMMUNITY_VIEW),
  getById,
);

router.patch(
  '/:communityId',
  authenticate,
  requirePermission(PERMISSIONS.COMMUNITY_UPDATE),
  update,
);

module.exports = router;
