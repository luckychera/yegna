const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { getMe } = require('./users.controller');

const router = express.Router();

router.get('/me', authenticate, getMe);

module.exports = router;
