const { pool } = require('../../config/database');
const { validatePaymentId, validateCreatePaymentInput } = require('./payment.validation');
const {
  createPayment,
  initializeProviderPayment,
  ensureContributionIsPayable,
} = require('./payment.service');
const { toMemberPayment, verifyPaymentWithProvider } = require('./payment.verification');
const { isTrustedAppUrl } = require('../../utils/origins');

function createControllerError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function checkoutController(req, res, next) {
  try {
    const userId = req.user.id;
    const { contributionId, amount, returnUrl } = req.body || {};

    if (!contributionId) {
      throw createControllerError('Contribution ID is required', 400, 'CONTRIBUTION_ID_REQUIRED');
    }

    if (!returnUrl) {
      throw createControllerError('Return URL is required', 400, 'RETURN_URL_REQUIRED');
    }

    // The provider redirects the member's browser here, so only Yegna's own web
    // app is acceptable (prevents using checkout as an open redirect).
    if (typeof returnUrl !== 'string' || !isTrustedAppUrl(returnUrl)) {
      throw createControllerError(
        'Return URL must point to the Yegna web app',
        400,
        'INVALID_RETURN_URL',
      );
    }

    // Scoped to the caller's own memberships, so another member's contribution
    // is indistinguishable from one that does not exist.
    const contributionResult = await pool.query(
      `
        SELECT c.*
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
      throw createControllerError('Contribution not found', 404, 'CONTRIBUTION_NOT_FOUND');
    }

    const contribution = contributionResult.rows[0];
    const remainingBalance = ensureContributionIsPayable(contribution);

    const input = validateCreatePaymentInput({
      communityId: contribution.community_id,
      userId,
      contributionId,
      provider: 'chapa',
      amount: amount == null ? remainingBalance : amount,
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
        payment: toMemberPayment(initialized.payment),
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

    const paymentResult = await pool.query(
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
      throw createControllerError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
    }

    const { payment, outcome } = await verifyPaymentWithProvider(paymentResult.rows[0], userId);

    return res.status(200).json({
      success: true,
      data: {
        payment: toMemberPayment(payment),
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
