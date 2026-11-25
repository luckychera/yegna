const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { getMyIdentity } = require('./identity.controller');

const router = express.Router();

router.get('/me', authenticate, getMyIdentity);

module.exports = router;
