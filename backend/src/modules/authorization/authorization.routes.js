const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { getMyAuthorization } = require('./authorization.controller');

const router = express.Router();

router.get('/me', authenticate, getMyAuthorization);

module.exports = router;
