const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { requirePermission } = require('../authorization/authorization.middleware');

const {
  createPaymentController,
  listPaymentsController,
  getPaymentController,
  processPaymentController,
  successfulPaymentController,
  failedPaymentController,
  cancelPaymentController,
  refundPaymentController,
  updatePaymentStatusController,
} = require('./payment.controller');

const router = express.Router();

router.use(authenticate);

// View payments
router.get(
  '/communities/:communityId/payments',
  requirePermission('payments.view'),
  listPaymentsController,
);

router.get(
  '/communities/:communityId/payments/:paymentId',
  requirePermission('payments.view'),
  getPaymentController,
);

// Create payment
router.post(
  '/communities/:communityId/payments',
  requirePermission('payments.create'),
  createPaymentController,
);

// Payment lifecycle
router.post(
  '/communities/:communityId/payments/:paymentId/process',
  requirePermission('payments.create'),
  processPaymentController,
);

router.post(
  '/communities/:communityId/payments/:paymentId/success',
  requirePermission('payments.create'),
  successfulPaymentController,
);

router.post(
  '/communities/:communityId/payments/:paymentId/fail',
  requirePermission('payments.create'),
  failedPaymentController,
);

router.post(
  '/communities/:communityId/payments/:paymentId/cancel',
  requirePermission('payments.create'),
  cancelPaymentController,
);

// Generic status update
router.patch(
  '/communities/:communityId/payments/:paymentId/status',
  requirePermission('payments.create'),
  updatePaymentStatusController,
);

// Refund
router.post(
  '/communities/:communityId/payments/:paymentId/refund',
  requirePermission('payments.refund'),
  refundPaymentController,
);

module.exports = router;
