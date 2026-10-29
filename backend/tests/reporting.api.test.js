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
    [communityId, userId, `REPORT-${crypto.randomUUID().slice(0, 8)}`],
  );

  return result.rows[0];
}

async function assignRole(client, membershipId, roleId) {
  const result = await client.query(
    `
      INSERT INTO membership_roles (
        membership_id,
        role_id
      )
      VALUES ($1, $2)
      RETURNING *;
    `,
    [membershipId, roleId],
  );

  return result.rows[0];
}

async function getRoleId(client, roleName) {
  const result = await client.query(
    `
      SELECT id
      FROM community_roles
      WHERE community_id = $1
        AND name = $2
      LIMIT 1;
    `,
    [TEST_COMMUNITY_ID, roleName],
  );

  assert.equal(result.rows.length, 1, `Expected role "${roleName}" to exist in the test community`);

  return result.rows[0].id;
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

    adminToken = generateAccessToken({
      id: ADMIN_USER_ID,
      email: 'reporting-api-admin@example.com',
      status: 'active',
    });
  } finally {
    client.release();
  }
});

test.after(async () => {
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
});

test('rejects reporting request without authentication', async () => {
  const result = await request(`/reports/community/${TEST_COMMUNITY_ID}`);

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, 'AUTHENTICATION_REQUIRED');
});

test('gets community overview report for an authorized admin', async () => {
  const result = await authenticatedRequest(`/reports/community/${TEST_COMMUNITY_ID}`, adminToken);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.community.id, TEST_COMMUNITY_ID);
  assert.ok(result.body.data.memberships);
  assert.ok(result.body.data.contributions);
  assert.ok(result.body.data.payments);
});

test('gets membership report for an authorized admin', async () => {
  const result = await authenticatedRequest(`/reports/membership/${TEST_COMMUNITY_ID}`, adminToken);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data.summary);
  assert.ok(Array.isArray(result.body.data.roles));
});

test('gets contribution report for an authorized admin', async () => {
  const result = await authenticatedRequest(
    `/reports/contributions/${TEST_COMMUNITY_ID}?period=current`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.period.type, 'current');
  assert.ok(result.body.data.summary);
});

test('gets payment report for an authorized admin', async () => {
  const result = await authenticatedRequest(
    `/reports/payments/${TEST_COMMUNITY_ID}?period=current`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.period.type, 'current');
  assert.ok(result.body.data.summary);
});

test('gets financial summary for an authorized admin', async () => {
  const result = await authenticatedRequest(
    `/reports/financial-summary/${TEST_COMMUNITY_ID}?period=current`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.ok(result.body.data.period);
  assert.ok(result.body.data.contributions);
  assert.ok(result.body.data.payments);
  assert.ok(result.body.data.ledger);
});

test('supports custom contribution reporting periods', async () => {
  const result = await authenticatedRequest(
    `/reports/contributions/${TEST_COMMUNITY_ID}?period=custom&startDate=2026-01-01&endDate=2026-12-31`,
    adminToken,
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.period.type, 'custom');
});

test('rejects an invalid reporting period', async () => {
  const result = await authenticatedRequest(
    `/reports/contributions/${TEST_COMMUNITY_ID}?period=invalid`,
    adminToken,
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test('rejects an invalid community ID', async () => {
  const result = await authenticatedRequest('/reports/community/not-a-uuid', adminToken);

  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test('rejects a non-existent community', async () => {
  const result = await authenticatedRequest(
    '/reports/community/11111111-1111-4111-8111-111111111111',
    adminToken,
  );

  assert.equal(result.status, 403);
  assert.equal(result.body.success, false);
  assert.equal(result.body.error.code, 'COMMUNITY_ACCESS_DENIED');
});

test('rejects a member without reports.view permission', async () => {
  const client = await pool.connect();

  let user;
  let membership;

  try {
    user = await createTestUser(client, 'reporting-api-no-permission');

    membership = await createActiveMembership(client, TEST_COMMUNITY_ID, user.id);

    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      status: 'active',
    });

    const result = await authenticatedRequest(`/reports/community/${TEST_COMMUNITY_ID}`, token);

    assert.equal(result.status, 403);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, 'PERMISSION_DENIED');
  } finally {
    if (membership?.id) {
      await client.query(
        `
          DELETE FROM community_memberships
          WHERE id = $1;
        `,
        [membership.id],
      );
    }

    if (user?.id) {
      await client.query(
        `
          DELETE FROM users
          WHERE id = $1;
        `,
        [user.id],
      );
    }

    client.release();
  }
});

test('rejects a user without community membership', async () => {
  const client = await pool.connect();

  let user;

  try {
    user = await createTestUser(client, 'reporting-api-no-membership');

    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      status: 'active',
    });

    const result = await authenticatedRequest(`/reports/community/${TEST_COMMUNITY_ID}`, token);

    assert.equal(result.status, 403);
    assert.equal(result.body.success, false);
    assert.equal(result.body.error.code, 'COMMUNITY_ACCESS_DENIED');
  } finally {
    if (user?.id) {
      await client.query(
        `
          DELETE FROM users
          WHERE id = $1;
        `,
        [user.id],
      );
    }

    client.release();
  }
});

test('allows a member with reports.view permission', async () => {
  const client = await pool.connect();

  let user;
  let membership;

  try {
    user = await createTestUser(client, 'reporting-api-reports-view');

    membership = await createActiveMembership(client, TEST_COMMUNITY_ID, user.id);

    const reportsRoleId = await getRoleId(client, 'admin');

    await assignRole(client, membership.id, reportsRoleId);

    const token = generateAccessToken({
      id: user.id,
      email: user.email,
      status: 'active',
    });

    const result = await authenticatedRequest(`/reports/community/${TEST_COMMUNITY_ID}`, token);

    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.community.id, TEST_COMMUNITY_ID);
  } finally {
    if (membership?.id) {
      await client.query(
        `
          DELETE FROM membership_roles
          WHERE membership_id = $1;
        `,
        [membership.id],
      );

      await client.query(
        `
          DELETE FROM community_memberships
          WHERE id = $1;
        `,
        [membership.id],
      );
    }

    if (user?.id) {
      await client.query(
        `
          DELETE FROM users
          WHERE id = $1;
        `,
        [user.id],
      );
    }

    client.release();
  }
});
