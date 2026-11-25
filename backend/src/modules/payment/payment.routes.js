const express = require('express');

const { authenticate } = require('../auth/auth.middleware');
const { requirePermission } = require('../authorization/authorization.middleware');

const {
  createPaymentController,
  listPaymentsController,
  initializeProviderPaymentController,
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
router.get('/:communityId/payments', requirePermission('payments.view'), listPaymentsController);

router.get(
  '/:communityId/payments/:paymentId',
  requirePermission('payments.view'),
  getPaymentController,
);

// Create payment
router.post(
  '/:communityId/payments',
  requirePermission('payments.create'),
  createPaymentController,
);

// Initialize payment with external provider
router.post(
  '/:communityId/payments/:paymentId/initialize',
  requirePermission('payments.create'),
  initializeProviderPaymentController,
);

// Payment lifecycle
router.post(
  '/:communityId/payments/:paymentId/process',
  requirePermission('payments.create'),
  processPaymentController,
);

router.post(
  '/:communityId/payments/:paymentId/success',
  requirePermission('payments.create'),
  successfulPaymentController,
);

router.post(
  '/:communityId/payments/:paymentId/fail',
  requirePermission('payments.create'),
  failedPaymentController,
);

router.post(
  '/:communityId/payments/:paymentId/cancel',
  requirePermission('payments.create'),
  cancelPaymentController,
);

// Generic status update
router.patch(
  '/:communityId/payments/:paymentId/status',
  requirePermission('payments.create'),
  updatePaymentStatusController,
);

// Refund
router.post(
  '/:communityId/payments/:paymentId/refund',
  requirePermission('payments.refund'),
  refundPaymentController,
);

module.exports = router;
