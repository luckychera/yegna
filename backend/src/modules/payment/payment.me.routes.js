const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const {
  listMyPaymentsController,
} = require('./payment.controller');

const {
  checkoutController,
  verifyController,
} = require('./payment.me.controller');

const router = express.Router();

router.use(authenticate);

// A user's own payments across communities.
router.get('/me', listMyPaymentsController);

// Member checkout flow.
router.post('/checkout', checkoutController);

// Member-side provider verification.
router.post('/:paymentId/verify', verifyController);

module.exports = router;
