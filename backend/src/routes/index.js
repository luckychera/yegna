const express = require('express');

const healthRoutes = require('./health.routes');
const authRoutes = require('../modules/auth/auth.routes');
const identityRoutes = require('../modules/identity/identity.routes');
const authorizationRoutes = require('../modules/authorization/authorization.routes');
const communityRoutes = require('../modules/community/community.routes');
const membershipRoutes = require('../modules/membership/membership.routes');
const invitationRoutes = require('../modules/invitation/invitation.routes');
const contributionRoutes = require('../modules/contribution/contribution.routes');
const paymentRoutes = require('../modules/payment/payment.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/identity', identityRoutes);
router.use('/authorization', authorizationRoutes);
router.use('/communities', communityRoutes);
router.use('/communities', membershipRoutes);
router.use('/communities', invitationRoutes);
router.use('/communities', contributionRoutes);
router.use(paymentRoutes);

module.exports = router;
