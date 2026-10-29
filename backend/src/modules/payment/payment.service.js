const { pool } = require('../../config/database');
const { notifySafely } = require('../notification/notification.events');
const { PAYMENT_STATUS, PAYMENT_STATUS_TRANSITIONS } = require('./payment.constants');
const {
  validateAmount,
  validateCurrency,
  validatePaymentId,
  validatePaymentStatus,
} = require('./payment.validation');

const { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } = require('../audit/audit.constants');
const { createAuditLog } = require('../audit/audit.service');
const { getPaymentProvider } = require('./payment-provider/payment-provider.factory');

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function ensureCommunityExists(communityId, client = pool) {
  const result = await client.query(
    `
      SELECT id
      FROM communities
      WHERE id = $1
      LIMIT 1
    `,
    [communityId],
  );

  if (result.rowCount === 0) {
    throw createServiceError('Community not found', 404, 'COMMUNITY_NOT_FOUND');
  }

  return result.rows[0];
}

async function ensureUserExists(userId, client = pool) {
  const result = await client.query(
    `
      SELECT id
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [userId],
  );

  if (result.rowCount === 0) {
    throw createServiceError('User not found', 404, 'USER_NOT_FOUND');
  }

  return result.rows[0];
}

async function ensureCommunityMembership(communityId, userId, client = pool) {
  const result = await client.query(
    `
      SELECT id, community_id, user_id, status
      FROM community_memberships
      WHERE community_id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [communityId, userId],
  );

  if (result.rowCount === 0) {
    throw createServiceError(
      'User is not a member of this community',
      403,
      'COMMUNITY_MEMBERSHIP_REQUIRED',
    );
  }

  if (result.rows[0].status !== 'active') {
    throw createServiceError(
      'User does not have an active membership in this community',
      403,
      'ACTIVE_MEMBERSHIP_REQUIRED',
    );
  }

  return result.rows[0];
}

async function getContributionForPayment(communityId, contributionId, userId, client = pool) {
  const result = await client.query(
    `
      SELECT
        c.id,
        c.community_id,
        c.membership_id,
        c.amount,
        c.currency,
        c.status,
        c.paid_amount,
        c.waived_amount,
        c.penalty_amount,
        cm.user_id,
        cm.status AS membership_status
      FROM contributions c
      INNER JOIN community_memberships cm
        ON cm.id = c.membership_id
      WHERE c.id = $1
        AND c.community_id = $2
        AND cm.user_id = $3
      FOR UPDATE OF c
    `,
    [contributionId, communityId, userId],
  );

  if (result.rowCount === 0) {
    throw createServiceError(
      'Contribution not found for this user and community',
      404,
      'CONTRIBUTION_NOT_FOUND',
    );
  }

  return result.rows[0];
}

function calculateContributionBalance(contribution) {
  const amount = Number(contribution.amount);
  const paidAmount = Number(contribution.paid_amount);
  const waivedAmount = Number(contribution.waived_amount);

  return Math.max(amount - paidAmount - waivedAmount, 0);
}

function ensureContributionIsPayable(contribution) {
  const finalStatuses = [PAYMENT_STATUS.REFUNDED, 'waived', 'cancelled'];

  if (finalStatuses.includes(contribution.status)) {
    throw createServiceError(
      'This contribution cannot receive a payment',
      400,
      'CONTRIBUTION_NOT_PAYABLE',
    );
  }

  const balance = calculateContributionBalance(contribution);

  if (balance <= 0) {
    throw createServiceError(
      'This contribution has no remaining balance',
      400,
      'CONTRIBUTION_ALREADY_SETTLED',
    );
  }

  return balance;
}

async function getPaymentById(communityId, paymentId, client = pool) {
  validatePaymentId(paymentId);

  const result = await client.query(
    `
      SELECT
        pt.*,
        c.membership_id,
        c.contribution_period_start,
        c.contribution_period_end,
        c.due_date,
        c.status AS contribution_status
      FROM payment_transactions pt
      LEFT JOIN contributions c
        ON c.id = pt.contribution_id
      WHERE pt.id = $1
        AND pt.community_id = $2
      LIMIT 1
    `,
    [paymentId, communityId],
  );

  if (result.rowCount === 0) {
    throw createServiceError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
  }

  return result.rows[0];
}

async function listPayments(communityId, client = pool) {
  const result = await client.query(
    `
      SELECT
        pt.*,
        c.membership_id,
        c.contribution_period_start,
        c.contribution_period_end,
        c.due_date,
        c.status AS contribution_status
      FROM payment_transactions pt
      LEFT JOIN contributions c
        ON c.id = pt.contribution_id
      WHERE pt.community_id = $1
      ORDER BY pt.created_at DESC
    `,
    [communityId],
  );

  return result.rows;
}

async function createPayment({
  communityId,
  userId,
  contributionId = null,
  provider,
  amount,
  currency = 'ETB',
  paymentMethod = null,
  providerTransactionId = null,
  providerReference = null,
  checkoutUrl = null,
  metadata = {},
  actorUserId,
}) {
  const normalizedAmount = validateAmount(amount);
  const normalizedCurrency = validateCurrency(currency);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await ensureCommunityExists(communityId, client);
    await ensureUserExists(userId, client);
    await ensureCommunityMembership(communityId, userId, client);

    let contribution = null;
    let remainingBalance = null;

    if (contributionId) {
      contribution = await getContributionForPayment(communityId, contributionId, userId, client);

      if (contribution.membership_status !== 'active') {
        throw createServiceError(
          'The contribution owner does not have an active membership',
          400,
          'ACTIVE_MEMBERSHIP_REQUIRED',
        );
      }

      remainingBalance = ensureContributionIsPayable(contribution);

      if (contribution.currency !== normalizedCurrency) {
        throw createServiceError(
          'Payment currency does not match the contribution currency',
          400,
          'CURRENCY_MISMATCH',
        );
      }

      if (Number(normalizedAmount) > remainingBalance) {
        throw createServiceError(
          `Payment amount exceeds the remaining contribution balance of ${contribution.currency} ${remainingBalance.toFixed(2)}`,
          400,
          'PAYMENT_EXCEEDS_BALANCE',
        );
      }
    }

    if (providerTransactionId) {
      const duplicate = await client.query(
        `
          SELECT id
          FROM payment_transactions
          WHERE provider = $1
            AND provider_transaction_id = $2
          LIMIT 1
        `,
        [provider, providerTransactionId],
      );

      if (duplicate.rowCount > 0) {
        throw createServiceError(
          'A payment with this provider transaction ID already exists',
          409,
          'DUPLICATE_PROVIDER_TRANSACTION',
        );
      }
    }

    const result = await client.query(
      `
        INSERT INTO payment_transactions (
          community_id,
          user_id,
          contribution_id,
          provider,
          provider_transaction_id,
          provider_reference,
          amount,
          currency,
          status,
          payment_method,
          checkout_url,
          metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        RETURNING *
      `,
      [
        communityId,
        userId,
        contributionId,
        provider,
        providerTransactionId,
        providerReference,
        normalizedAmount,
        normalizedCurrency,
        PAYMENT_STATUS.PENDING,
        paymentMethod,
        checkoutUrl,
        metadata,
      ],
    );

    const payment = result.rows[0];

    await createAuditLog({
      userId: actorUserId || userId,
      communityId,
      action: AUDIT_ACTIONS.PAYMENT_CREATED,
      entityType: AUDIT_ENTITY_TYPES.PAYMENT,
      entityId: payment.id,
      newValues: payment,
      metadata: {
        contributionId,
        provider,
        amount: normalizedAmount,
        currency: normalizedCurrency,
      },
      client,
    });

    await client.query('COMMIT');

    return {
      payment,
      remainingBalance,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function initializeProviderPayment({
  communityId,
  paymentId,
  providerName = 'chapa',
  callbackUrl = null,
  returnUrl = null,
  providerFactory = getPaymentProvider,
}) {
  validatePaymentId(paymentId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `
        SELECT
          pt.*,
          u.email,
          u.phone,
          up.first_name,
          up.last_name
        FROM payment_transactions pt
        INNER JOIN users u
          ON u.id = pt.user_id
        LEFT JOIN user_profiles up
          ON up.user_id = u.id
        WHERE pt.id = $1
          AND pt.community_id = $2
        FOR UPDATE OF pt
      `,
      [paymentId, communityId],
    );

    if (paymentResult.rowCount === 0) {
      throw createServiceError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw createServiceError(
        `Only pending payments can be initialized`,
        400,
        'PAYMENT_NOT_INITIALIZABLE',
      );
    }

    const provider = providerFactory(providerName);

    const txRef = `YEGNA-PAY-${payment.id}`;

    const providerResult = await provider.initializePayment({
      amount: payment.amount,
      currency: payment.currency,
      txRef,
      customer: {
        email: payment.email,
        phone: payment.phone,
        firstName: payment.first_name,
        lastName: payment.last_name,
      },
      callbackUrl,
      returnUrl,
      metadata: {
        yegnaPaymentId: payment.id,
        communityId,
        contributionId: payment.contribution_id,
      },
    });

    if (!providerResult || !providerResult.checkoutUrl) {
      throw createServiceError(
        'Payment provider did not return a checkout URL',
        502,
        'PAYMENT_CHECKOUT_URL_MISSING',
      );
    }

    const updatedResult = await client.query(
      `
        UPDATE payment_transactions
        SET
          provider = $1,
          provider_transaction_id = $2,
          provider_reference = $3,
          checkout_url = $4,
          updated_at = NOW()
        WHERE id = $5
          AND community_id = $6
        RETURNING *
      `,
      [
        providerName,
        providerResult.providerTransactionId,
        providerResult.providerReference,
        providerResult.checkoutUrl,
        paymentId,
        communityId,
      ],
    );

    const updatedPayment = updatedResult.rows[0];

    await client.query('COMMIT');

    return {
      payment: updatedPayment,
      checkoutUrl: providerResult.checkoutUrl,
      provider: providerName,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updatePaymentStatus(communityId, paymentId, nextStatus, actorUserId, options = {}) {
  validatePaymentId(paymentId);
  validatePaymentStatus(nextStatus);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `
        SELECT *
        FROM payment_transactions
        WHERE id = $1
          AND community_id = $2
        FOR UPDATE
      `,
      [paymentId, communityId],
    );

    if (paymentResult.rowCount === 0) {
      throw createServiceError('Payment transaction not found', 404, 'PAYMENT_NOT_FOUND');
    }

    const payment = paymentResult.rows[0];
    const currentStatus = payment.status;

    if (currentStatus === nextStatus) {
      throw createServiceError(`Payment is already ${nextStatus}`, 409, 'PAYMENT_STATUS_UNCHANGED');
    }

    const allowedTransitions = PAYMENT_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(nextStatus)) {
      throw createServiceError(
        `Payment cannot transition from ${currentStatus} to ${nextStatus}`,
        400,
        'INVALID_PAYMENT_STATUS_TRANSITION',
      );
    }

    let contribution = null;

    if (nextStatus === PAYMENT_STATUS.SUCCESSFUL || nextStatus === PAYMENT_STATUS.REFUNDED) {
      if (!payment.contribution_id) {
        throw createServiceError(
          'This payment is not associated with a contribution',
          400,
          'CONTRIBUTION_REQUIRED',
        );
      }

      const contributionResult = await client.query(
        `
          SELECT *
          FROM contributions
          WHERE id = $1
            AND community_id = $2
          FOR UPDATE
        `,
        [payment.contribution_id, communityId],
      );

      if (contributionResult.rowCount === 0) {
        throw createServiceError(
          'Contribution associated with this payment was not found',
          404,
          'CONTRIBUTION_NOT_FOUND',
        );
      }

      contribution = contributionResult.rows[0];
    }

    if (nextStatus === PAYMENT_STATUS.SUCCESSFUL) {
      const paymentAmount = Number(payment.amount);
      const currentPaid = Number(contribution.paid_amount);
      const remainingBeforePayment = calculateContributionBalance(contribution);

      if (paymentAmount > remainingBeforePayment) {
        throw createServiceError(
          'Payment amount exceeds the remaining contribution balance',
          400,
          'PAYMENT_EXCEEDS_BALANCE',
        );
      }

      const newPaidAmount = currentPaid + paymentAmount;
      const totalAmount = Number(contribution.amount);
      const waivedAmount = Number(contribution.waived_amount);

      let contributionStatus = 'partially_paid';

      if (newPaidAmount + waivedAmount >= totalAmount) {
        contributionStatus = 'paid';
      }

      await client.query(
        `
          UPDATE contributions
          SET
            paid_amount = $1,
            status = $2,
            updated_at = NOW()
          WHERE id = $3
            AND community_id = $4
        `,
        [newPaidAmount.toFixed(2), contributionStatus, contribution.id, communityId],
      );
    }

    if (nextStatus === PAYMENT_STATUS.REFUNDED) {
      const paymentAmount = Number(payment.amount);
      const currentPaid = Number(contribution.paid_amount);
      const newPaidAmount = Math.max(currentPaid - paymentAmount, 0);
      const totalAmount = Number(contribution.amount);
      const waivedAmount = Number(contribution.waived_amount);

      let contributionStatus = 'pending';

      if (newPaidAmount > 0 && newPaidAmount + waivedAmount < totalAmount) {
        contributionStatus = 'partially_paid';
      }

      if (newPaidAmount + waivedAmount >= totalAmount) {
        contributionStatus = 'paid';
      }

      await client.query(
        `
          UPDATE contributions
          SET
            paid_amount = $1,
            status = $2,
            updated_at = NOW()
          WHERE id = $3
            AND community_id = $4
        `,
        [newPaidAmount.toFixed(2), contributionStatus, contribution.id, communityId],
      );
    }

    const timestampField =
      nextStatus === PAYMENT_STATUS.SUCCESSFUL
        ? 'completed_at'
        : nextStatus === PAYMENT_STATUS.FAILED
          ? 'failed_at'
          : null;

    let updateQuery = `
      UPDATE payment_transactions
      SET
        status = $1,
        updated_at = NOW()
    `;

    const params = [nextStatus];

    if (timestampField) {
      params.push(new Date());
      updateQuery += `, ${timestampField} = $${params.length}`;
    }

    if (nextStatus === PAYMENT_STATUS.FAILED && options.failureReason) {
      params.push(options.failureReason);
      updateQuery += `, failure_reason = $${params.length}`;
    }

    params.push(paymentId, communityId);

    updateQuery += `
      WHERE id = $${params.length - 1}
        AND community_id = $${params.length}
      RETURNING *
    `;

    const updatedResult = await client.query(updateQuery, params);
    const updatedPayment = updatedResult.rows[0];

    let auditAction = AUDIT_ACTIONS.PAYMENT_STATUS_UPDATED;

    if (nextStatus === PAYMENT_STATUS.SUCCESSFUL) {
      auditAction = AUDIT_ACTIONS.PAYMENT_SUCCESSFUL;
    } else if (nextStatus === PAYMENT_STATUS.REFUNDED) {
      auditAction = AUDIT_ACTIONS.PAYMENT_REFUNDED;
    }

    await createAuditLog({
      userId: actorUserId || payment.user_id,
      communityId,
      action: auditAction,
      entityType: AUDIT_ENTITY_TYPES.PAYMENT,
      entityId: payment.id,
      oldValues: {
        status: currentStatus,
      },
      newValues: {
        status: nextStatus,
      },
      metadata: {
        contributionId: payment.contribution_id,
        amount: payment.amount,
        currency: payment.currency,
      },
      client,
    });

    await client.query('COMMIT');

    const paymentNotifications = {
      successful: {
        type: 'payment_successful',
        title: 'Payment successful',
        message: `Your payment of ${updatedPayment.currency} ${updatedPayment.amount} was successful.`,
      },
      failed: {
        type: 'payment_failed',
        title: 'Payment failed',
        message: `Your payment of ${updatedPayment.currency} ${updatedPayment.amount} failed. Please review the payment and try again if appropriate.`,
      },
      refunded: {
        type: 'payment_refunded',
        title: 'Payment refunded',
        message: `Your payment of ${updatedPayment.currency} ${updatedPayment.amount} has been refunded.`,
      },
    };

    const paymentNotification = paymentNotifications[nextStatus];

    if (paymentNotification) {
      await notifySafely({
        userId: updatedPayment.user_id,
        communityId,
        ...paymentNotification,
        entityType: 'payment',
        entityId: updatedPayment.id,
        metadata: {
          paymentId: updatedPayment.id,
          contributionId: updatedPayment.contribution_id,
          amount: updatedPayment.amount,
          currency: updatedPayment.currency,
          status: updatedPayment.status,
        },
      });
    }

    return updatedPayment;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markPaymentProcessing(communityId, paymentId, actorUserId) {
  return updatePaymentStatus(communityId, paymentId, PAYMENT_STATUS.PROCESSING, actorUserId);
}

async function markPaymentSuccessful(communityId, paymentId, actorUserId) {
  return updatePaymentStatus(communityId, paymentId, PAYMENT_STATUS.SUCCESSFUL, actorUserId);
}

async function markPaymentFailed(communityId, paymentId, actorUserId, failureReason = null) {
  return updatePaymentStatus(communityId, paymentId, PAYMENT_STATUS.FAILED, actorUserId, {
    failureReason,
  });
}

async function cancelPayment(communityId, paymentId, actorUserId) {
  return updatePaymentStatus(communityId, paymentId, PAYMENT_STATUS.CANCELLED, actorUserId);
}

async function refundPayment(communityId, paymentId, actorUserId) {
  return updatePaymentStatus(communityId, paymentId, PAYMENT_STATUS.REFUNDED, actorUserId);
}

// Payments are grouped into "this month" on the Ethiopian calendar day regardless
// of the database session time zone.
const PAYMENT_MONTH_START_SQL =
  "DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa'";

// The caller's own payments across communities. Provider internals (metadata,
// provider transaction ID, raw failure text) are intentionally never selected, and
// the checkout URL is only returned while a payment can still be completed.
async function listMyPayments({ userId, status, communityId, contributionId, limit, offset }) {
  const params = [userId];
  const filters = ['pt.user_id = $1'];

  if (status) {
    params.push(status);
    filters.push(`pt.status = $${params.length}`);
  }

  if (communityId) {
    params.push(communityId);
    filters.push(`pt.community_id = $${params.length}`);
  }

  if (contributionId) {
    params.push(contributionId);
    filters.push(`pt.contribution_id = $${params.length}`);
  }

  const where = filters.join(' AND ');

  const summaryResult = await pool.query(
    `
      SELECT
        pt.currency,
        COUNT(*)::INT AS count,
        COALESCE(SUM(pt.amount) FILTER (WHERE pt.status = 'successful'), 0) AS total_paid,
        COALESCE(
          SUM(pt.amount) FILTER (
            WHERE pt.status = 'successful'
              AND pt.completed_at >= ${PAYMENT_MONTH_START_SQL}
          ),
          0
        ) AS paid_this_month,
        COALESCE(
          SUM(pt.amount) FILTER (WHERE pt.status IN ('pending', 'processing')),
          0
        ) AS pending_amount,
        COALESCE(SUM(pt.amount) FILTER (WHERE pt.status = 'refunded'), 0) AS refunded_amount
      FROM payment_transactions pt
      WHERE ${where}
      GROUP BY pt.currency
      ORDER BY pt.currency;
    `,
    params,
  );

  const total = summaryResult.rows.reduce((sum, row) => sum + row.count, 0);

  params.push(limit, offset);

  const result = await pool.query(
    `
      SELECT
        pt.id,
        pt.community_id,
        pt.contribution_id,
        pt.provider,
        pt.provider_reference,
        pt.amount,
        pt.currency,
        pt.status,
        pt.payment_method,
        CASE
          WHEN pt.status IN ('pending', 'processing') THEN pt.checkout_url
          ELSE NULL
        END AS checkout_url,
        pt.initiated_at,
        pt.completed_at,
        pt.failed_at,
        pt.created_at,
        co.name AS community_name,
        co.logo_url AS community_logo_url,
        c.due_date AS contribution_due_date,
        c.contribution_period_start,
        c.contribution_period_end
      FROM payment_transactions pt
      JOIN communities co
        ON co.id = pt.community_id
      LEFT JOIN contributions c
        ON c.id = pt.contribution_id
      WHERE ${where}
      ORDER BY pt.initiated_at DESC, pt.id
      LIMIT $${params.length - 1}
      OFFSET $${params.length};
    `,
    params,
  );

  return {
    payments: result.rows.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      contributionId: row.contribution_id,
      community: {
        id: row.community_id,
        name: row.community_name,
        logoUrl: row.community_logo_url,
      },
      contribution: row.contribution_id
        ? {
            id: row.contribution_id,
            dueDate: row.contribution_due_date,
            periodStart: row.contribution_period_start,
            periodEnd: row.contribution_period_end,
          }
        : null,
      provider: row.provider,
      providerReference: row.provider_reference,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      checkoutUrl: row.checkout_url,
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at,
      failedAt: row.failed_at,
      createdAt: row.created_at,
    })),
    summary: summaryResult.rows.map((row) => ({
      currency: row.currency,
      count: row.count,
      totalPaid: row.total_paid,
      paidThisMonth: row.paid_this_month,
      pendingAmount: row.pending_amount,
      refundedAmount: row.refunded_amount,
    })),
    total,
  };
}

module.exports = {
  listMyPayments,

  ensureCommunityExists,
  ensureUserExists,
  ensureCommunityMembership,
  getContributionForPayment,
  calculateContributionBalance,
  ensureContributionIsPayable,
  getPaymentById,
  listPayments,
  createPayment,
  initializeProviderPayment,
  updatePaymentStatus,
  markPaymentProcessing,
  markPaymentSuccessful,
  markPaymentFailed,
  cancelPayment,
  refundPayment,
};
