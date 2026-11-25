const express = require('express');

const {
  register,
  login,
  refresh,
  logout,
  changePasswordHandler,
  listSessions,
  revokeSession,
  revokeOthers,
} = require('./auth.controller');
const { authenticate } = require('./auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePasswordHandler);

router.get('/sessions', authenticate, listSessions);
// Must stay above '/sessions/:sessionId/...'.
router.post('/sessions/revoke-others', authenticate, revokeOthers);
router.post('/sessions/:sessionId/revoke', authenticate, revokeSession);

module.exports = router;
