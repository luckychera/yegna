const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { requirePermission } = require('../../middleware/authorization.middleware');

const {
  create,
  list,
  getById,
  accept,
  reject,
  revoke,
  listMine,
  acceptById,
} = require('./invitation.controller');

const router = express.Router();

// Community invitation management
router.post(
  '/communities/:communityId/invitations',
  authenticate,
  requirePermission('members.invite'),
  create,
);

router.get(
  '/communities/:communityId/invitations',
  authenticate,
  requirePermission('members.view'),
  list,
);

router.get(
  '/communities/:communityId/invitations/:invitationId',
  authenticate,
  requirePermission('members.view'),
  getById,
);

router.post(
  '/communities/:communityId/invitations/:invitationId/revoke',
  authenticate,
  requirePermission('members.invite'),
  revoke,
);

// Member invitation actions
// "/invitations/me" must stay above any "/invitations/:invitationId" route.
router.get('/invitations/me', authenticate, listMine);

router.post('/invitations/accept', authenticate, accept);

router.post('/invitations/:invitationId/accept', authenticate, acceptById);

router.post('/invitations/:invitationId/reject', authenticate, reject);

module.exports = router;
