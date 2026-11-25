const crypto = require('node:crypto');

const app = require('../../src/app');
const { pool, closeDatabase } = require('../../src/config/database');
const { generateAccessToken } = require('../../src/modules/auth/token.service');
const { createCommunity } = require('../../src/modules/community/community.service');
const { createMembership } = require('../../src/modules/membership/membership.service');

// Short lowercase-hex token so test data is unique and searchable by prefix.
function unique(prefix = 't') {
  return `${prefix}${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Self-contained fixture registry: everything created through it is removed again
 * by cleanup(), so these tests do not depend on (or pollute) pre-existing rows.
 */
function createFixtureContext() {
  const userIds = [];
  const communityIds = [];
  let server = null;
  let baseUrl = null;

  async function start() {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });

    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  }

  async function request(method, path, { token, body } = {}) {
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    return {
      status: response.status,
      text,
      body: text ? JSON.parse(text) : null,
    };
  }

  async function createUser({
    firstName = 'Test',
    lastName = 'User',
    displayName = null,
    withProfile = true,
    status = 'active',
  } = {}) {
    const email = `${unique('u')}@yegna.test`;

    const result = await pool.query(
      `
        INSERT INTO users (email, status)
        VALUES ($1, $2)
        RETURNING id, email;
      `,
      [email, status],
    );

    const user = result.rows[0];
    userIds.push(user.id);

    if (withProfile) {
      await pool.query(
        `
          INSERT INTO user_profiles (user_id, first_name, last_name, display_name)
          VALUES ($1, $2, $3, $4);
        `,
        [user.id, firstName, lastName, displayName],
      );
    }

    return { ...user, token: generateAccessToken({ id: user.id }) };
  }

  async function createTestCommunity(admin, overrides = {}) {
    const { community } = await createCommunity({
      userId: admin.id,
      name: overrides.name || `${unique('c')} Community`,
      description: overrides.description || 'Automated test community',
      communityType: overrides.communityType || 'association',
      logoUrl: overrides.logoUrl || null,
    });

    communityIds.push(community.id);

    if (overrides.requiresApproval !== undefined) {
      await setMembershipApproval(community.id, overrides.requiresApproval);
    }

    return community;
  }

  async function setMembershipApproval(communityId, requiresApproval) {
    await pool.query(
      `
        INSERT INTO community_settings (community_id, membership_requires_approval)
        VALUES ($1, $2)
        ON CONFLICT (community_id)
        DO UPDATE SET membership_requires_approval = EXCLUDED.membership_requires_approval;
      `,
      [communityId, requiresApproval],
    );
  }

  async function addActiveMember(communityId, user, actorUserId) {
    return createMembership({
      communityId,
      userId: user.id,
      actorUserId: actorUserId || user.id,
      metadata: {},
      initialStatus: 'active',
    });
  }

  async function setMembershipStatus(communityId, userId, status) {
    await pool.query(
      `
        UPDATE community_memberships
        SET status = $3
        WHERE community_id = $1
          AND user_id = $2;
      `,
      [communityId, userId, status],
    );
  }

  async function getMembershipId(communityId, userId) {
    const result = await pool.query(
      'SELECT id FROM community_memberships WHERE community_id = $1 AND user_id = $2',
      [communityId, userId],
    );

    return result.rows[0].id;
  }

  // dueInDays is relative to today so tests never depend on a fixed calendar date.
  async function createContributionRow({
    communityId,
    userId,
    amount = '1000.00',
    currency = 'ETB',
    status = 'pending',
    paidAmount = '0.00',
    waivedAmount = '0.00',
    dueInDays = 7,
    notes = null,
  }) {
    const membershipId = await getMembershipId(communityId, userId);

    const result = await pool.query(
      `
        INSERT INTO contributions (
          community_id,
          membership_id,
          contribution_period_start,
          contribution_period_end,
          due_date,
          amount,
          currency,
          status,
          paid_amount,
          waived_amount,
          notes
        )
        VALUES (
          $1,
          $2,
          CURRENT_DATE + ($3::INT - 30),
          CURRENT_DATE + ($3::INT - 1),
          CURRENT_DATE + $3::INT,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING id;
      `,
      [communityId, membershipId, dueInDays, amount, currency, status, paidAmount, waivedAmount, notes],
    );

    return result.rows[0].id;
  }

  async function createPaymentRow({
    communityId,
    userId,
    contributionId = null,
    amount = '500.00',
    currency = 'ETB',
    status = 'successful',
    completedAt = null,
    checkoutUrl = null,
    providerReference = null,
    initiatedMinutesAgo = 0,
  }) {
    const result = await pool.query(
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
          initiated_at,
          completed_at,
          failure_reason,
          metadata
        )
        VALUES (
          $1, $2, $3, 'chapa', $4, $5, $6, $7, $8, 'telebirr', $9,
          NOW() - ($10::INT * INTERVAL '1 minute'),
          $11,
          'SECRET-PROVIDER-FAILURE-TEXT',
          '{"internal":"SECRET-METADATA"}'::JSONB
        )
        RETURNING id;
      `,
      [
        communityId,
        userId,
        contributionId,
        `txn-${unique('p')}`,
        providerReference,
        amount,
        currency,
        status,
        checkoutUrl,
        initiatedMinutesAgo,
        completedAt,
      ],
    );

    return result.rows[0].id;
  }

  async function createIdentity(userId, { status = 'verified', subject = null } = {}) {
    await pool.query(
      `
        INSERT INTO identities (user_id, provider, provider_subject, verification_status, verified_at)
        VALUES ($1, 'fayda', $2, $3::VARCHAR, CASE WHEN $3::VARCHAR = 'verified' THEN NOW() ELSE NULL END);
      `,
      [userId, subject || `fin-${unique('s')}`, status],
    );
  }

  async function cleanup() {
    if (communityIds.length > 0) {
      await pool.query('DELETE FROM payment_transactions WHERE community_id = ANY($1::uuid[])', [
        communityIds,
      ]);
      await pool.query('DELETE FROM contributions WHERE community_id = ANY($1::uuid[])', [
        communityIds,
      ]);
      await pool.query('DELETE FROM communities WHERE id = ANY($1::uuid[])', [communityIds]);
    }

    if (userIds.length > 0) {
      await pool.query('DELETE FROM notifications WHERE user_id = ANY($1::uuid[])', [userIds]);
      await pool.query('DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])', [userIds]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await closeDatabase();
  }

  return {
    start,
    request,
    createUser,
    createTestCommunity,
    setMembershipApproval,
    addActiveMember,
    setMembershipStatus,
    getMembershipId,
    createContributionRow,
    createPaymentRow,
    createIdentity,
    cleanup,
  };
}

module.exports = { unique, createFixtureContext };
