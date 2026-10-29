const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { pool, closeDatabase } = require('../src/config/database');

const { initializeProviderPayment } = require('../src/modules/payment/payment.service');

const TEST_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';

let testUser;
let testMembership;
let testContribution;
let testPayment;

function uniqueEmail() {
  return `payment-service-${crypto.randomUUID()}@example.com`;
}

async function createTestUser(client) {
  const email = uniqueEmail();

  const result = await client.query(
    `
      INSERT INTO users (
        email,
        phone,
        password_hash,
        status
      )
      VALUES ($1, $2, $3, 'active')
      RETURNING id, email, phone
    `,
    [
      email,
      `+2519${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      'test-password-hash',
    ],
  );

  return result.rows[0];
}

async function createTestMembership(client, userId) {
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
    [TEST_COMMUNITY_ID, userId, `PAY-SVC-${crypto.randomUUID().slice(0, 8)}`],
  );

  return result.rows[0];
}

async function createTestContribution(client, membershipId) {
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
        500.00,
        'ETB',
        'pending'
      )
      RETURNING *
    `,
    [TEST_COMMUNITY_ID, membershipId],
  );

  return result.rows[0];
}

async function createTestPayment(client, userId, contributionId) {
  const result = await client.query(
    `
      INSERT INTO payment_transactions (
        community_id,
        user_id,
        contribution_id,
        provider,
        amount,
        currency,
        status,
        payment_method,
        initiated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        'chapa',
        500.00,
        'ETB',
        'pending',
        'telebirr',
        NOW()
      )
      RETURNING *
    `,
    [TEST_COMMUNITY_ID, userId, contributionId],
  );

  return result.rows[0];
}

test.before(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    testUser = await createTestUser(client);
    testMembership = await createTestMembership(client, testUser.id);
    testContribution = await createTestContribution(client, testMembership.id);
    testPayment = await createTestPayment(client, testUser.id, testContribution.id);

    await client.query('COMMIT');
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

    if (testPayment?.id) {
      await client.query(
        `
          DELETE FROM payment_transactions
          WHERE id = $1
        `,
        [testPayment.id],
      );
    }

    if (testContribution?.id) {
      await client.query(
        `
          DELETE FROM contributions
          WHERE id = $1
        `,
        [testContribution.id],
      );
    }

    if (testMembership?.id) {
      await client.query(
        `
          DELETE FROM community_memberships
          WHERE id = $1
        `,
        [testMembership.id],
      );
    }

    if (testUser?.id) {
      await client.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [testUser.id],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
});

test('initializeProviderPayment initializes a payment using an injected provider', async () => {
  let receivedPayload = null;

  const mockProvider = {
    async initializePayment(payload) {
      receivedPayload = payload;

      return {
        checkoutUrl: 'https://example.com/checkout/yegna-test',
        providerTransactionId: 'CHAPA-TEST-123',
        providerReference: 'YEGNA-PAYMENT-REFERENCE',
        status: 'pending',
      };
    },
  };

  const result = await initializeProviderPayment({
    communityId: TEST_COMMUNITY_ID,
    paymentId: testPayment.id,
    providerName: 'chapa',
    callbackUrl: 'https://example.com/api/payment/callback',
    returnUrl: 'https://example.com/payment/success',
    providerFactory: () => mockProvider,
  });

  assert.equal(result.provider, 'chapa');
  assert.equal(result.checkoutUrl, 'https://example.com/checkout/yegna-test');

  assert.ok(result.payment);
  assert.equal(result.payment.id, testPayment.id);
  assert.equal(result.payment.status, 'pending');
  assert.equal(result.payment.provider, 'chapa');
  assert.equal(result.payment.provider_transaction_id, 'CHAPA-TEST-123');
  assert.equal(result.payment.provider_reference, 'YEGNA-PAYMENT-REFERENCE');
  assert.equal(result.payment.checkout_url, 'https://example.com/checkout/yegna-test');

  assert.ok(receivedPayload);

  assert.equal(receivedPayload.amount, '500.00');
  assert.equal(receivedPayload.currency, 'ETB');
  assert.equal(receivedPayload.txRef, `YEGNA-PAY-${testPayment.id}`);

  assert.equal(receivedPayload.customer.email, testUser.email);
  assert.equal(receivedPayload.customer.phone, testUser.phone);
  assert.equal(receivedPayload.customer.firstName, null);
  assert.equal(receivedPayload.customer.lastName, null);

  assert.equal(receivedPayload.callbackUrl, 'https://example.com/api/payment/callback');

  assert.equal(receivedPayload.returnUrl, 'https://example.com/payment/success');

  assert.deepEqual(receivedPayload.metadata, {
    yegnaPaymentId: testPayment.id,
    communityId: TEST_COMMUNITY_ID,
    contributionId: testContribution.id,
  });
});

test('initializeProviderPayment rejects a non-pending payment', async () => {
  const client = await pool.connect();

  try {
    await client.query(
      `
        UPDATE payment_transactions
        SET status = 'successful'
        WHERE id = $1
      `,
      [testPayment.id],
    );
  } finally {
    client.release();
  }

  await assert.rejects(
    () =>
      initializeProviderPayment({
        communityId: TEST_COMMUNITY_ID,
        paymentId: testPayment.id,
        providerFactory: () => {
          throw new Error('Provider should not be called');
        },
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'PAYMENT_NOT_INITIALIZABLE');
      return true;
    },
  );

  const resetClient = await pool.connect();

  try {
    await resetClient.query(
      `
        UPDATE payment_transactions
        SET status = 'pending'
        WHERE id = $1
      `,
      [testPayment.id],
    );
  } finally {
    resetClient.release();
  }
});

test('initializeProviderPayment rejects an unknown payment', async () => {
  const missingPaymentId = crypto.randomUUID();

  await assert.rejects(
    () =>
      initializeProviderPayment({
        communityId: TEST_COMMUNITY_ID,
        paymentId: missingPaymentId,
        providerFactory: () => {
          throw new Error('Provider should not be called');
        },
      }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'PAYMENT_NOT_FOUND');
      return true;
    },
  );
});

test('initializeProviderPayment rejects a provider without a checkout URL', async () => {
  const mockProvider = {
    async initializePayment() {
      return {
        providerTransactionId: 'CHAPA-TEST-456',
        providerReference: 'YEGNA-PAYMENT-REFERENCE',
        status: 'pending',
      };
    },
  };

  await assert.rejects(
    () =>
      initializeProviderPayment({
        communityId: TEST_COMMUNITY_ID,
        paymentId: testPayment.id,
        providerFactory: () => mockProvider,
      }),
    (error) => {
      assert.equal(error.statusCode, 502);
      assert.equal(error.code, 'PAYMENT_CHECKOUT_URL_MISSING');
      return true;
    },
  );
});
