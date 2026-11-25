const express = require('express');
const { authenticate } = require('../auth/auth.middleware');

const {
  list,
  unreadCount,
  getById,
  markRead,
  markAllRead,
} = require('./notification.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', list);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllRead);
router.get('/:notificationId', getById);
router.patch('/:notificationId/read', markRead);

module.exports = router;
