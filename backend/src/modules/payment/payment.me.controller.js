const {
  validatePaymentId,
  validateCreatePaymentInput,
} = require('./payment.validation');

const {
  createPayment,
  initializeProviderPayment,
  updatePaymentStatus,
} = require('./payment.service');

const { getPaymentProvider } = require('./payment-provider/payment-provider.factory');
const { PAYMENT_STATUS } = require('./payment.constants');

function createControllerError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function checkoutController(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      contributionId,
      amount,
      returnUrl,
    } = req.body || {};

    if (!contributionId) {
      throw createControllerError(
        'Contribution ID is required',
        400,
        'CONTRIBUTION_ID_REQUIRED',
      );
    }

    if (!returnUrl) {
      throw createControllerError(
        'Return URL is required',
        400,
        'RETURN_URL_REQUIRED',
      );
    }

    /*
     * The existing payment service validates the contribution, membership,
     * currency, balance, and amount during payment creation.
     *
     * We first load the contribution through getPaymentById only after
     * creation, so the member cannot choose another user's payment.
     *
     * For the checkout amount, the service accepts an explicit amount.
     * When omitted, use the contribution's remaining balance.
     */
    const contributionResult = await require('../../config/database').pool.query(
      `
        SELECT
          c.id,
          c.community_id,
          c.membership_id,
          c.amount,
          c.currency,
          c.paid_amount,
          c.waived_amount,
          c.penalty_amount,
          cm.user_id
        FROM contributions c
        INNER JOIN community_memberships cm
          ON cm.id = c.membership_id
        WHERE c.id = $1
          AND cm.user_id = $2
        LIMIT 1
      `,
      [contributionId, userId],
    );

    if (contributionResult.rowCount === 0) {
      throw createControllerError(
        'Contribution not found',
        404,
        'CONTRIBUTION_NOT_FOUND',
      );
    }

    const contribution = contributionResult.rows[0];

    const remainingBalance =
      Number(contribution.amount) +
      Number(contribution.penalty_amount || 0) -
      Number(contribution.paid_amount || 0) -
      Number(contribution.waived_amount || 0);

    if (remainingBalance <= 0) {
      throw createControllerError(
        'This contribution has no remaining balance',
        400,
        'CONTRIBUTION_ALREADY_PAID',
      );
    }

    const paymentAmount = amount == null ? remainingBalance : amount;

    const input = validateCreatePaymentInput({
      communityId: contribution.community_id,
      userId,
      contributionId,
      provider: 'chapa',
      amount: paymentAmount,
      currency: contribution.currency,
      paymentMethod: 'mobile_money',
    });

    const created = await createPayment({
      ...input,
      actorUserId: userId,
    });

    const initialized = await initializeProviderPayment({
      communityId: contribution.community_id,
      paymentId: created.payment.id,
      providerName: 'chapa',
      returnUrl,
    });

    return res.status(201).json({
      success: true,
      data: {
        payment: initialized.payment,
        checkoutUrl: initialized.checkoutUrl,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyController(req, res, next) {
  try {
    const userId = req.user.id;
    const { paymentId } = req.params;

    validatePaymentId(paymentId);

    const paymentResult = await require('../../config/database').pool.query(
      `
        SELECT *
        FROM payment_transactions
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `,
      [paymentId, userId],
    );

    if (paymentResult.rowCount === 0) {
      throw createControllerError(
        'Payment transaction not found',
        404,
        'PAYMENT_NOT_FOUND',
      );
    }

    const payment = paymentResult.rows[0];

    if (
      payment.status === PAYMENT_STATUS.SUCCESSFUL ||
      payment.status === PAYMENT_STATUS.REFUNDED
    ) {
      return res.status(200).json({
        success: true,
        data: {
          payment,
          outcome: payment.status === PAYMENT_STATUS.SUCCESSFUL
            ? 'successful'
            : 'refunded',
        },
      });
    }

    const provider = getPaymentProvider(payment.provider || 'chapa');

    const txRef = `YEGNA-PAY-${payment.id}`;

    const providerResult = await provider.verifyPayment({
      txRef,
    });

    if (!providerResult || providerResult.status === 'unknown') {
      return res.status(200).json({
        success: true,
        data: {
          payment,
          outcome: 'pending',
        },
      });
    }

    let updatedPayment = payment;
    let outcome = 'pending';

    if (providerResult.status === 'successful') {
      updatedPayment = await updatePaymentStatus(
        payment.community_id,
        payment.id,
        PAYMENT_STATUS.SUCCESSFUL,
        userId,
      );
      outcome = 'successful';
    } else if (providerResult.status === 'failed') {
      updatedPayment = await updatePaymentStatus(
        payment.community_id,
        payment.id,
        PAYMENT_STATUS.FAILED,
        userId,
        {
          failureReason: 'Payment provider reported a failed transaction',
        },
      );
      outcome = 'failed';
    } else if (providerResult.status === 'cancelled') {
      updatedPayment = await updatePaymentStatus(
        payment.community_id,
        payment.id,
        PAYMENT_STATUS.CANCELLED,
        userId,
      );
      outcome = 'cancelled';
    }

    return res.status(200).json({
      success: true,
      data: {
        payment: updatedPayment,
        outcome,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  checkoutController,
  verifyController,
};
