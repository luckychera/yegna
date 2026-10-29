const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { getMe, updateMe } = require('./users.controller');

const router = express.Router();

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);

module.exports = router;
