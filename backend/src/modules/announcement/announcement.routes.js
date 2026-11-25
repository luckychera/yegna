const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const {
  requirePermission,
  requireActiveMembership,
} = require('../authorization/authorization.middleware');
const { PERMISSIONS } = require('../authorization/permission.constants');
const controller = require('./announcement.controller');

// Mounted at /communities: every active member reads, managers write.
const communityRouter = express.Router();

communityRouter.get(
  '/:communityId/announcements',
  authenticate,
  requireActiveMembership(),
  controller.list,
);

communityRouter.get(
  '/:communityId/announcements/:announcementId',
  authenticate,
  requireActiveMembership(),
  controller.getById,
);

communityRouter.post(
  '/:communityId/announcements/:announcementId/read',
  authenticate,
  requireActiveMembership(),
  controller.markRead,
);

communityRouter.post(
  '/:communityId/announcements',
  authenticate,
  requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  controller.create,
);

communityRouter.patch(
  '/:communityId/announcements/:announcementId',
  authenticate,
  requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  controller.update,
);

communityRouter.delete(
  '/:communityId/announcements/:announcementId',
  authenticate,
  requirePermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE),
  controller.archive,
);

// Mounted at /announcements.
const meRouter = express.Router();

meRouter.get('/me', authenticate, controller.listMine);

module.exports = {
  communityRouter,
  meRouter,
};
