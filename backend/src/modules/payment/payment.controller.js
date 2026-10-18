const {
  validateCreatePaymentInput,
  validatePaymentId,
  validatePaymentStatus,
} = require('./payment.validation');

const {
  listPayments,
  getPaymentById,
  createPayment,
  initializeProviderPayment,
  updatePaymentStatus,
  markPaymentProcessing,
  markPaymentSuccessful,
  markPaymentFailed,
  cancelPayment,
  refundPayment,
} = require('./payment.service');

function getActorUserId(req) {
  return req.user.id;
}

async function createPaymentController(req, res, next) {
  try {
    const { communityId } = req.params;

    const input = validateCreatePaymentInput({
      ...req.body,
      communityId,
      userId: getActorUserId(req),
    });

    const result = await createPayment({
      ...input,
      actorUserId: getActorUserId(req),
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function initializeProviderPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const result = await initializeProviderPayment({
      communityId,
      paymentId,
      providerName: req.body?.provider || 'chapa',
      callbackUrl: req.body?.callbackUrl || null,
      returnUrl: req.body?.returnUrl || null,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function listPaymentsController(req, res, next) {
  try {
    const { communityId } = req.params;

    const payments = await listPayments(communityId);

    return res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    return next(error);
  }
}

async function getPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await getPaymentById(communityId, paymentId);

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function processPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await markPaymentProcessing(communityId, paymentId, getActorUserId(req));

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function successfulPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await markPaymentSuccessful(communityId, paymentId, getActorUserId(req));

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function failedPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await markPaymentFailed(
      communityId,
      paymentId,
      getActorUserId(req),
      req.body?.failureReason || null,
    );

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await cancelPayment(communityId, paymentId, getActorUserId(req));

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function refundPaymentController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;

    validatePaymentId(paymentId);

    const payment = await refundPayment(communityId, paymentId, getActorUserId(req));

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

async function updatePaymentStatusController(req, res, next) {
  try {
    const { communityId, paymentId } = req.params;
    const { status } = req.body;

    validatePaymentId(paymentId);
    validatePaymentStatus(status);

    const payment = await updatePaymentStatus(communityId, paymentId, status, getActorUserId(req));

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createPaymentController,
  initializeProviderPaymentController,
  listPaymentsController,
  getPaymentController,
  processPaymentController,
  successfulPaymentController,
  failedPaymentController,
  cancelPaymentController,
  refundPaymentController,
  updatePaymentStatusController,
};
