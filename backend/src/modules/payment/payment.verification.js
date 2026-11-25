const { pool } = require('../../config/database');
const { PAYMENT_STATUS } = require('./payment.constants');
const { updatePaymentStatus } = require('./payment.service');
const { getPaymentProvider } = require('./payment-provider/payment-provider.factory');

const SETTLED_STATUSES = new Set([
  PAYMENT_STATUS.SUCCESSFUL,
  PAYMENT_STATUS.REFUNDED,
  PAYMENT_STATUS.FAILED,
  PAYMENT_STATUS.CANCELLED,
]);

function providerReferenceFor(paymentId) {
  return `YEGNA-PAY-${paymentId}`;
}

/**
 * Member-facing view of a payment. Provider internals (metadata, provider
 * transaction ID, raw failure text) are never exposed, and the checkout URL is
 * only returned while the payment can still be completed.
 */
function toMemberPayment(row) {
  const open = row.status === PAYMENT_STATUS.PENDING || row.status === PAYMENT_STATUS.PROCESSING;

  return {
    id: row.id,
    communityId: row.community_id,
    contributionId: row.contribution_id,
    provider: row.provider,
    providerReference: row.provider_reference,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    checkoutUrl: open ? row.checkout_url : null,
    initiatedAt: row.initiated_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
  };
}

// A provider "success" only settles the payment when it is for the amount and
// currency Yegna asked for; anything else is treated as a failed payment.
function matchesVerifiedAmount(payment, providerResult) {
  if (providerResult.amount == null || !providerResult.currency) {
    return false;
  }

  const expected = Math.round(Number(payment.amount) * 100);
  const verified = Math.round(Number(providerResult.amount) * 100);

  return (
    verified === expected &&
    String(providerResult.currency).toUpperCase() === String(payment.currency).toUpperCase()
  );
}

async function loadPayment(paymentId) {
  const result = await pool.query('SELECT * FROM payment_transactions WHERE id = $1', [paymentId]);

  return result.rows[0] || null;
}

// Status changes can race (two browser tabs, or a webhook and a return page).
// A transition the payment has already made is not an error for the caller.
async function transition(payment, nextStatus, actorUserId, options) {
  try {
    return await updatePaymentStatus(
      payment.community_id,
      payment.id,
      nextStatus,
      actorUserId,
      options,
    );
  } catch (error) {
    if (
      error.code === 'PAYMENT_STATUS_UNCHANGED' ||
      error.code === 'INVALID_PAYMENT_STATUS_TRANSITION'
    ) {
      return loadPayment(payment.id);
    }

    throw error;
  }
}

/**
 * Asks the payment provider for the authoritative state of a payment and applies
 * it. The browser (or webhook body) is never trusted: only the provider's verify
 * API can move a payment to successful.
 *
 * Returns { payment, outcome } where outcome is the resulting payment status, or
 * 'pending' when the provider has not confirmed anything yet.
 */
async function verifyPaymentWithProvider(payment, actorUserId, { providerFactory = getPaymentProvider } = {}) {
  if (SETTLED_STATUSES.has(payment.status)) {
    return { payment, outcome: payment.status };
  }

  const provider = providerFactory(payment.provider || 'chapa');

  let providerResult;

  try {
    providerResult = await provider.verifyPayment({ txRef: providerReferenceFor(payment.id) });
  } catch (error) {
    // Chapa answers "not found" until the customer completes checkout. That is
    // not a failure of the payment, only "not confirmed yet".
    if (error.code === 'CHAPA_API_ERROR' && error.providerStatus >= 400 && error.providerStatus < 500 && error.providerStatus !== 401) {
      return { payment, outcome: 'pending' };
    }

    throw error;
  }

  if (!providerResult || !['successful', 'failed', 'cancelled'].includes(providerResult.status)) {
    return { payment, outcome: 'pending' };
  }

  if (providerResult.status === 'successful') {
    if (!matchesVerifiedAmount(payment, providerResult)) {
      const failed = await transition(payment, PAYMENT_STATUS.FAILED, actorUserId, {
        failureReason: 'Verified amount or currency did not match the payment',
      });

      return { payment: failed, outcome: failed.status };
    }

    let current = payment;

    if (current.status === PAYMENT_STATUS.PENDING) {
      current = await transition(current, PAYMENT_STATUS.PROCESSING, actorUserId);
    }

    if (current.status === PAYMENT_STATUS.PROCESSING) {
      current = await transition(current, PAYMENT_STATUS.SUCCESSFUL, actorUserId);
    }

    return { payment: current, outcome: current.status };
  }

  const nextStatus =
    providerResult.status === 'failed' ? PAYMENT_STATUS.FAILED : PAYMENT_STATUS.CANCELLED;

  const updated = await transition(
    payment,
    nextStatus,
    actorUserId,
    nextStatus === PAYMENT_STATUS.FAILED
      ? { failureReason: 'Payment provider reported a failed transaction' }
      : undefined,
  );

  return { payment: updated, outcome: updated.status };
}

module.exports = {
  providerReferenceFor,
  toMemberPayment,
  matchesVerifiedAmount,
  verifyPaymentWithProvider,
};
