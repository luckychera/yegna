const express = require('express');

const { register, login, refresh, logout, changePasswordHandler } = require('./auth.controller');
const { authenticate } = require('./auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePasswordHandler);

module.exports = router;
