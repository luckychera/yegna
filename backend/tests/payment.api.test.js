/* global fetch */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const app = require('../src/app');
const { pool, closeDatabase } = require('../src/config/database');
const { generateAccessToken } = require('../src/modules/auth/token.service');

const TEST_COMMUNITY_ID = 'dd5e9a8f-485b-48b4-9dab-84b60aeb2812';
const ADMIN_USER_ID = 'dd073edc-85d6-4665-bce9-e64d2ae6de2f';

let server;
let baseUrl;

let adminToken;
let adminMembership;
let adminContribution;

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
      RETURNING id, email, status;
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
      RETURNING *;
    `,
    [communityId, userId, `API-${crypto.randomUUID().slice(0, 8)}`],
  );

  return result.rows[0];
}

async function createContribution(client, communityId, membershipId, amount = '1000.00') {
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
        $3,
        $4,
        $5,
        $6,
        'ETB',
        'pending'
      )
      RETURNING *;
    `,
    [communityId, membershipId, `2026-11-01`, `2026-11-30`, `2026-11-20`, amount],
  );

  return result.rows[0];
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

async function authenticatedRequest(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

test.before(async () => {
  server = app.listen(0);

  await new Promise((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const client = await pool.connect();

  try {
    const membershipResult = await client.query(
      `
        SELECT *
        FROM community_memberships
        WHERE community_id = $1
          AND user_id = $2
          AND status = 'active'
        LIMIT 1;
      `,
      [TEST_COMMUNITY_ID, ADMIN_USER_ID],
    );

    assert.equal(
      membershipResult.rows.length,
      1,
      'Expected admin user to have an active test-community membership',
    );

    adminMembership = membershipResult.rows[0];

    adminContribution = await createContribution(
      client,
      TEST_COMMUNITY_ID,
      adminMembership.id,
      '1000.00',
    );

    adminToken = generateAccessToken({
      id: ADMIN_USER_ID,
      email: 'payment-api-admin@example.com',
      status: 'active',
    });
  } finally {
    client.release();
  }
});

test.after(async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (adminContribution?.id) {
      await client.query(
        `
          DELETE FROM payment_transactions
          WHERE contribution_id = $1;
        `,
        [adminContribution.id],
      );

      await client.query(
        `
          DELETE FROM contributions
          WHERE id = $1;
        `,
        [adminContribution.id],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await closeDatabase();
  }
});

test('rejects payment API request without authentication', async () => {
  const result = await request(`/communities/${TEST_COMMUNITY_ID}/payments`);

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('lists community payments for an authorized admin', async () => {
  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(Array.isArray(result.body.data));
});

test('gets a payment by ID', async () => {
  const createResult = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        contributionId: adminContribution.id,
        provider: 'chapa',
        amount: '200.00',
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerReference: `API-${crypto.randomUUID()}`,
      }),
    },
  );

  assert.equal(createResult.status, 201);
  assert.equal(createResult.body.success, true);

  const paymentId = createResult.body.data.payment.id;

  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments/${paymentId}`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.id, paymentId);
});

test('creates a pending payment through the API', async () => {
  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        contributionId: adminContribution.id,
        provider: 'chapa',
        amount: '150.00',
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerReference: `API-${crypto.randomUUID()}`,
      }),
    },
  );

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.payment.status, 'pending');
  assert.equal(result.body.data.payment.amount, '150.00');
  assert.equal(result.body.data.payment.contribution_id, adminContribution.id);
});

test('rejects invalid payment data through the API', async () => {
  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        contributionId: adminContribution.id,
        provider: 'chapa',
        amount: '-50.00',
        currency: 'ETB',
        paymentMethod: 'telebirr',
      }),
    },
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test('processes a payment through the API', async () => {
  const createResult = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        contributionId: adminContribution.id,
        provider: 'chapa',
        amount: '100.00',
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerReference: `API-${crypto.randomUUID()}`,
      }),
    },
  );

  assert.equal(createResult.status, 201);

  const paymentId = createResult.body.data.payment.id;

  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments/${paymentId}/process`,
    adminToken,
    {
      method: 'POST',
    },
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.status, 'processing');
});

test('successful payment updates the contribution through the API', async () => {
  const createResult = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments`,
    adminToken,
    {
      method: 'POST',
      body: JSON.stringify({
        contributionId: adminContribution.id,
        provider: 'chapa',
        amount: '250.00',
        currency: 'ETB',
        paymentMethod: 'telebirr',
        providerReference: `API-${crypto.randomUUID()}`,
      }),
    },
  );

  assert.equal(createResult.status, 201);

  const paymentId = createResult.body.data.payment.id;

  const processResult = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments/${paymentId}/process`,
    adminToken,
    {
      method: 'POST',
    },
  );

  assert.equal(processResult.status, 200);

  const successResult = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments/${paymentId}/success`,
    adminToken,
    {
      method: 'POST',
    },
  );

  assert.equal(successResult.status, 200);
  assert.equal(successResult.body.success, true);
  assert.equal(successResult.body.data.status, 'successful');
});

test('rejects refund without the required refund permission', async () => {
  const client = await pool.connect();

  let user;
  let membership;
  let token;

  try {
    user = await createTestUser(client, 'payment-api-member');
    membership = await createActiveMembership(client, TEST_COMMUNITY_ID, user.id);

    token = generateAccessToken({
      id: user.id,
      email: user.email,
      status: 'active',
    });
  } finally {
    client.release();
  }

  const result = await authenticatedRequest(
    `/communities/${TEST_COMMUNITY_ID}/payments/${crypto.randomUUID()}/refund`,
    token,
    {
      method: 'POST',
    },
  );

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);

  const cleanup = await pool.connect();

  try {
    await cleanup.query(
      `
        DELETE FROM community_memberships
        WHERE id = $1;
      `,
      [membership.id],
    );

    await cleanup.query(
      `
        DELETE FROM users
        WHERE id = $1;
      `,
      [user.id],
    );
  } finally {
    cleanup.release();
  }
});
