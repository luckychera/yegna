const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { pool, closeDatabase } = require('../src/config/database');
const {
  createPayment,
  getPaymentById,
  listPayments,
  markPaymentProcessing,
  markPaymentSuccessful,
  markPaymentFailed,
  cancelPayment,
  refundPayment,
} = require('../src/modules/payment/payment.service');

const TEST_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';
const ADMIN_USER_ID = 'dd073edc-85d6-4665-bce9-e64d2ae6de2f';

let fixture;

function uniqueEmail(prefix) {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

async function createTestUser(client, prefix) {
  const result = await client.query(
    `
      INSERT INTO users (
        email,
        password_hash,
        status
      )
      VALUES ($1, $2, 'active')
      RETURNING id, email
    `,
    [uniqueEmail(prefix), 'test-password-hash'],
  );

  return result.rows[0];
}

async function createActiveMembership(client, communityId, userId) {
  const result = await client.query(
    `
      INSERT INTO community_memberships (
        community_id,
        user_id,
        membership_number,
        status,
        joined_at,
        approved_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'active',
        NOW(),
        NOW()
      )
      RETURNING *
    `,
    [communityId, userId, `PAY-${crypto.randomUUID().slice(0, 8)}`],
  );

  return result.rows[0];
}

async function createContribution(
  client,
  communityId,
  membershipId,
  amount = '1000.00',
  currency = 'ETB',
) {
  const result = await client.query(
    `
      INSERT INTO contributions (
        community_id,
        membership_id,
        contribution_period_start,
        contribution_period_end,
        due_date,
        amount,
        currency,
        status
      )
      VALUES (
        $1,
        $2,
        '2026-10-01',
        '2026-10-31',
        '2026-10-20',
        $3,
        $4,
        'pending'
      )
      RETURNING *
    `,
    [communityId, membershipId, amount, currency],
  );

  return result.rows[0];
}

test.before(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const user = await createTestUser(client, 'payment');
    const membership = await createActiveMembership(client, TEST_COMMUNITY_ID, user.id);

    const contribution = await createContribution(client, TEST_COMMUNITY_ID, membership.id);

    await client.query('COMMIT');

    fixture = {
      user,
      membership,
      contribution,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

test.after(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (fixture?.user?.id) {
      await client.query(
        `
          DELETE FROM audit_logs
          WHERE user_id = $1
        `,
        [fixture.user.id],
      );

      await client.query(
        `
          DELETE FROM payment_transactions
          WHERE user_id = $1
        `,
        [fixture.user.id],
      );

      await client.query(
        `
          DELETE FROM contributions
          WHERE membership_id IN (
            SELECT id
            FROM community_memberships
            WHERE user_id = $1
          )
        `,
        [fixture.user.id],
      );

      await client.query(
        `
          DELETE FROM community_memberships
          WHERE user_id = $1
        `,
        [fixture.user.id],
      );

      await client.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [fixture.user.id],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await closeDatabase();
});

test('creates a pending payment for a contribution', async () => {
  const result = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '300.00',
    currency: 'ETB',
    paymentMethod: 'telebirr',
    providerReference: `REF-${crypto.randomUUID()}`,
    actorUserId: ADMIN_USER_ID,
  });

  assert.equal(result.payment.status, 'pending');
  assert.equal(result.payment.amount, '300.00');
  assert.equal(result.payment.currency, 'ETB');
  assert.equal(result.payment.contribution_id, fixture.contribution.id);
  assert.equal(result.remainingBalance, 1000);
});

test('rejects payment for a non-member user', async () => {
  const client = await pool.connect();

  let user;

  try {
    user = await createTestUser(client, 'nonmember');
  } finally {
    client.release();
  }

  await assert.rejects(
    createPayment({
      communityId: TEST_COMMUNITY_ID,
      userId: user.id,
      contributionId: fixture.contribution.id,
      provider: 'chapa',
      amount: '100.00',
      currency: 'ETB',
      actorUserId: ADMIN_USER_ID,
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'COMMUNITY_MEMBERSHIP_REQUIRED');
      return true;
    },
  );

  const cleanup = await pool.connect();

  try {
    await cleanup.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [user.id],
    );
  } finally {
    cleanup.release();
  }
});

test('rejects payment when contribution belongs to another user', async () => {
  const client = await pool.connect();

  let otherUser;
  let otherMembership;
  let otherContribution;

  try {
    otherUser = await createTestUser(client, 'other-owner');

    otherMembership = await createActiveMembership(client, TEST_COMMUNITY_ID, otherUser.id);

    otherContribution = await createContribution(
      client,
      TEST_COMMUNITY_ID,
      otherMembership.id,
      '500.00',
    );
  } finally {
    client.release();
  }

  await assert.rejects(
    createPayment({
      communityId: TEST_COMMUNITY_ID,
      userId: fixture.user.id,
      contributionId: otherContribution.id,
      provider: 'chapa',
      amount: '100.00',
      currency: 'ETB',
      actorUserId: ADMIN_USER_ID,
    }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'CONTRIBUTION_NOT_FOUND');
      return true;
    },
  );

  const cleanup = await pool.connect();

  try {
    await cleanup.query(
      `
        DELETE FROM contributions
        WHERE id = $1
      `,
      [otherContribution.id],
    );

    await cleanup.query(
      `
        DELETE FROM community_memberships
        WHERE id = $1
      `,
      [otherMembership.id],
    );

    await cleanup.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [otherUser.id],
    );
  } finally {
    cleanup.release();
  }
});

test('rejects payment with mismatched currency', async () => {
  await assert.rejects(
    createPayment({
      communityId: TEST_COMMUNITY_ID,
      userId: fixture.user.id,
      contributionId: fixture.contribution.id,
      provider: 'chapa',
      amount: '100.00',
      currency: 'USD',
      actorUserId: ADMIN_USER_ID,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'CURRENCY_MISMATCH');
      return true;
    },
  );
});

test('rejects payment that exceeds the remaining balance', async () => {
  await assert.rejects(
    createPayment({
      communityId: TEST_COMMUNITY_ID,
      userId: fixture.user.id,
      contributionId: fixture.contribution.id,
      provider: 'chapa',
      amount: '1000.01',
      currency: 'ETB',
      actorUserId: ADMIN_USER_ID,
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'PAYMENT_EXCEEDS_BALANCE');
      return true;
    },
  );
});

test('rejects duplicate provider transaction IDs', async () => {
  const providerTransactionId = `TX-${crypto.randomUUID()}`;

  await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '50.00',
    currency: 'ETB',
    providerTransactionId,
    actorUserId: ADMIN_USER_ID,
  });

  await assert.rejects(
    createPayment({
      communityId: TEST_COMMUNITY_ID,
      userId: fixture.user.id,
      contributionId: fixture.contribution.id,
      provider: 'chapa',
      amount: '50.00',
      currency: 'ETB',
      providerTransactionId,
      actorUserId: ADMIN_USER_ID,
    }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'DUPLICATE_PROVIDER_TRANSACTION');
      return true;
    },
  );
});

test('gets a payment by ID', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '75.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  const payment = await getPaymentById(TEST_COMMUNITY_ID, created.payment.id);

  assert.equal(payment.id, created.payment.id);
  assert.equal(payment.contribution_id, fixture.contribution.id);
});

test('lists payments for a community', async () => {
  const payments = await listPayments(TEST_COMMUNITY_ID);

  assert.ok(Array.isArray(payments));
  assert.ok(payments.length >= 1);
});

test('moves a payment from pending to processing', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '100.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  const updated = await markPaymentProcessing(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  assert.equal(updated.status, 'processing');
});

test('successful payment updates contribution paid amount', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '200.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  await markPaymentProcessing(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  const successful = await markPaymentSuccessful(
    TEST_COMMUNITY_ID,
    created.payment.id,
    ADMIN_USER_ID,
  );

  assert.equal(successful.status, 'successful');

  const result = await pool.query(
    `
      SELECT paid_amount, status
      FROM contributions
      WHERE id = $1
    `,
    [fixture.contribution.id],
  );

  assert.equal(result.rows[0].paid_amount, '200.00');
  assert.equal(result.rows[0].status, 'partially_paid');
});

test('successful payment can fully settle a contribution', async () => {
  const client = await pool.connect();

  let contribution;

  try {
    contribution = await createContribution(
      client,
      TEST_COMMUNITY_ID,
      fixture.membership.id,
      '250.00',
    );
  } finally {
    client.release();
  }

  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: contribution.id,
    provider: 'chapa',
    amount: '250.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  await markPaymentProcessing(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  await markPaymentSuccessful(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  const result = await pool.query(
    `
      SELECT paid_amount, status
      FROM contributions
      WHERE id = $1
    `,
    [contribution.id],
  );

  assert.equal(result.rows[0].paid_amount, '250.00');
  assert.equal(result.rows[0].status, 'paid');
});

test('rejects an invalid payment status transition', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '25.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  await assert.rejects(
    markPaymentSuccessful(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'INVALID_PAYMENT_STATUS_TRANSITION');
      return true;
    },
  );
});

test('failed payment records a failure reason', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '30.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  const failed = await markPaymentFailed(
    TEST_COMMUNITY_ID,
    created.payment.id,
    ADMIN_USER_ID,
    'Provider rejected the transaction',
  );

  assert.equal(failed.status, 'failed');
  assert.equal(failed.failure_reason, 'Provider rejected the transaction');
});

test('cancelled payment cannot transition to successful', async () => {
  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: fixture.contribution.id,
    provider: 'chapa',
    amount: '35.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  await cancelPayment(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  await assert.rejects(
    markPaymentSuccessful(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'INVALID_PAYMENT_STATUS_TRANSITION');
      return true;
    },
  );
});

test('refund reverses a successful payment contribution amount', async () => {
  const client = await pool.connect();

  let contribution;

  try {
    contribution = await createContribution(
      client,
      TEST_COMMUNITY_ID,
      fixture.membership.id,
      '400.00',
    );
  } finally {
    client.release();
  }

  const created = await createPayment({
    communityId: TEST_COMMUNITY_ID,
    userId: fixture.user.id,
    contributionId: contribution.id,
    provider: 'chapa',
    amount: '150.00',
    currency: 'ETB',
    actorUserId: ADMIN_USER_ID,
  });

  await markPaymentProcessing(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  await markPaymentSuccessful(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  const refunded = await refundPayment(TEST_COMMUNITY_ID, created.payment.id, ADMIN_USER_ID);

  assert.equal(refunded.status, 'refunded');

  const result = await pool.query(
    `
      SELECT paid_amount, status
      FROM contributions
      WHERE id = $1
    `,
    [contribution.id],
  );

  assert.equal(result.rows[0].paid_amount, '0.00');
  assert.equal(result.rows[0].status, 'pending');
});
