const express = require('express');

const healthRoutes = require('./health.routes');
const authRoutes = require('../modules/auth/auth.routes');
const identityRoutes = require('../modules/identity/identity.routes');
const authorizationRoutes = require('../modules/authorization/authorization.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/identity', identityRoutes);
router.use('/authorization', authorizationRoutes);

module.exports = router;
