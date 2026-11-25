const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');
const { createAuthSession } = require('../src/modules/auth/session.service');
const { generateAccessToken } = require('../src/modules/auth/token.service');
const { notifySafely } = require('../src/modules/notification/notification.events');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

async function signIn(user, userAgent = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0') {
  const session = await createAuthSession({ userId: user.id, ipAddress: '127.0.0.1', userAgent });

  return { ...session, token: generateAccessToken(user, session.sessionId) };
}

test('identity details say how a FIN was verified without returning any of it', async () => {
  const user = await ctx.createUser();
  const fin = '123456789012';

  await pool.query(
    `
      INSERT INTO identities (user_id, provider, provider_subject, verification_status, verified_at, metadata)
      VALUES ($1, 'fayda', $2, 'verified', NOW(), '{"identifier_type":"FIN","verification_mode":"mock"}'::JSONB);
    `,
    [user.id, fin],
  );

  const response = await ctx.request('GET', '/identity/me', { token: user.token });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.identity.identifierType, 'FIN');
  assert.equal(response.body.data.identity.verificationMode, 'mock');
  assert.ok(!response.text.includes(fin.slice(-4)), 'no FIN digits are exposed');
});

test('access tokens carry their session so the current device can be identified', async () => {
  const user = await ctx.createUser();
  const current = await signIn(user);
  const other = await signIn(user, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1');

  const response = await ctx.request('GET', '/auth/sessions', { token: current.token });

  assert.equal(response.status, 200);
  const sessions = response.body.data.sessions;
  assert.equal(sessions.length, 2);
  assert.equal(sessions.find((session) => session.current).id, current.sessionId);
  assert.ok(sessions.some((session) => session.id === other.sessionId && !session.current));
  assert.ok(!response.text.includes(current.refreshToken), 'refresh tokens are never listed');
  assert.equal(jwt.decode(current.token).sid, current.sessionId);
});

test('a refreshed access token points at the rotated session', async () => {
  const user = await ctx.createUser();
  const session = await signIn(user);

  const response = await ctx.request('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken } });

  assert.equal(response.status, 200);
  const { sid } = jwt.decode(response.body.data.accessToken);
  assert.ok(sid && sid !== session.sessionId);

  const active = await pool.query(
    'SELECT id FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL',
    [user.id],
  );
  assert.deepEqual(active.rows.map((row) => row.id), [sid]);
});

test('a member can sign out one other session, but not the current one through that route', async () => {
  const user = await ctx.createUser();
  const current = await signIn(user);
  const other = await signIn(user);

  const self = await ctx.request('POST', `/auth/sessions/${current.sessionId}/revoke`, { token: current.token });
  assert.equal(self.status, 400);
  assert.equal(self.body.error.code, 'CANNOT_REVOKE_CURRENT_SESSION');

  const revoked = await ctx.request('POST', `/auth/sessions/${other.sessionId}/revoke`, { token: current.token });
  assert.equal(revoked.status, 200);

  const refresh = await ctx.request('POST', '/auth/refresh', { body: { refreshToken: other.refreshToken } });
  assert.equal(refresh.status, 401, 'the revoked device can no longer refresh');
});

test("a member cannot revoke someone else's session", async () => {
  const owner = await ctx.createUser();
  const attacker = await ctx.createUser();
  const victim = await signIn(owner);
  const attackerSession = await signIn(attacker);

  const response = await ctx.request('POST', `/auth/sessions/${victim.sessionId}/revoke`, {
    token: attackerSession.token,
  });

  assert.equal(response.status, 404);
  const row = await pool.query('SELECT revoked_at FROM auth_sessions WHERE id = $1', [victim.sessionId]);
  assert.equal(row.rows[0].revoked_at, null);
});

test('signing out other sessions keeps only the current one', async () => {
  const user = await ctx.createUser();
  const current = await signIn(user);
  await signIn(user);
  await signIn(user);

  const response = await ctx.request('POST', '/auth/sessions/revoke-others', { token: current.token });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.revokedCount, 2);

  const active = await pool.query(
    'SELECT id FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL',
    [user.id],
  );
  assert.deepEqual(active.rows.map((row) => row.id), [current.sessionId]);
});

test('signing out other sessions requires a session-bound token', async () => {
  const user = await ctx.createUser();
  const response = await ctx.request('POST', '/auth/sessions/revoke-others', { token: user.token });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'CURRENT_SESSION_UNKNOWN');
});

test('activating a membership issues a unique membership number and a card code', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser({ firstName: 'Abebe', lastName: 'Kebede' });
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);

  const response = await ctx.request('GET', '/membership-cards/me', { token: member.token });

  assert.equal(response.status, 200);
  const [card] = response.body.data.cards;
  assert.match(card.membershipNumber, /^YG-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.match(card.verificationCode, /^[2-9A-HJKMNP-Z]{24}$/);
  assert.equal(card.community.id, community.id);
  assert.equal(card.holder.name, 'Abebe Kebede');

  const adminCards = await ctx.request('GET', '/membership-cards/me', { token: admin.token });
  assert.notEqual(adminCards.body.data.cards[0].membershipNumber, card.membershipNumber);
});

test('a pending membership has no card yet', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, applicant, admin.id);
  await ctx.setMembershipStatus(community.id, applicant.id, 'pending');

  const response = await ctx.request('GET', '/membership-cards/me', { token: applicant.token });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.cards, []);
});

test('the public card check confirms an active member with minimal details only', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser({ firstName: 'Hana', lastName: 'Tesfaye' });
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);
  await ctx.createIdentity(member.id, { subject: '998877665544' });

  const cards = await ctx.request('GET', '/membership-cards/me', { token: member.token });
  const { verificationCode, membershipNumber } = cards.body.data.cards[0];

  const response = await ctx.request('GET', `/membership-cards/verify/${verificationCode}`);

  assert.equal(response.status, 200);
  const card = response.body.data.card;
  assert.equal(card.valid, true);
  assert.equal(card.membershipNumber, membershipNumber);
  assert.equal(card.holderName, 'Hana T.');
  assert.equal(card.community.name, community.name);
  assert.ok(!response.text.includes(member.email), 'no email');
  assert.ok(!response.text.includes(member.id), 'no internal user id');
  assert.ok(!response.text.includes('5544'), 'no identity digits');
});

test('a suspended member card reports invalid without holder details', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);

  const cards = await ctx.request('GET', '/membership-cards/me', { token: member.token });
  const { verificationCode } = cards.body.data.cards[0];
  await ctx.setMembershipStatus(community.id, member.id, 'suspended');

  const response = await ctx.request('GET', `/membership-cards/verify/${verificationCode}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.card.valid, false);
  assert.equal(response.body.data.card.status, 'suspended');
  assert.equal(response.body.data.card.holderName, undefined);
  assert.equal(response.body.data.card.membershipNumber, undefined);
});

test('unknown or malformed card codes are not found', async () => {
  for (const code of ['ABCDEFGHJKMNPQRSTUVWXYZ2', 'short', "x' OR '1'='1"]) {
    const response = await ctx.request('GET', `/membership-cards/verify/${encodeURIComponent(code)}`);

    assert.equal(response.status, 404, code);
    assert.equal(response.body.error.code, 'CARD_NOT_FOUND');
  }
});

test('regenerating a card code invalidates the old QR code', async () => {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  const before = (await ctx.request('GET', '/membership-cards/me', { token: admin.token })).body.data.cards[0];

  const response = await ctx.request('POST', `/membership-cards/${before.membershipId}/regenerate`, {
    token: admin.token,
  });

  assert.equal(response.status, 200);
  const after = response.body.data.card;
  assert.notEqual(after.verificationCode, before.verificationCode);
  assert.equal(after.membershipNumber, before.membershipNumber, 'the membership number never changes');
  assert.equal((await ctx.request('GET', `/membership-cards/verify/${before.verificationCode}`)).status, 404);
  assert.equal((await ctx.request('GET', `/membership-cards/verify/${after.verificationCode}`)).status, 200);
  assert.ok(community.id);
});

test("a member cannot regenerate another member's card", async () => {
  const admin = await ctx.createUser();
  const other = await ctx.createUser();
  await ctx.createTestCommunity(admin);
  const card = (await ctx.request('GET', '/membership-cards/me', { token: admin.token })).body.data.cards[0];

  const response = await ctx.request('POST', `/membership-cards/${card.membershipId}/regenerate`, {
    token: other.token,
  });

  assert.equal(response.status, 404);
});

test('notification preferences default to on and persist partial updates', async () => {
  const user = await ctx.createUser();

  const initial = await ctx.request('GET', '/notifications/preferences', { token: user.token });
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.data.preferences.inApp, {
    announcements: true,
    contributions: true,
    payments: true,
    memberships: true,
    invitations: true,
  });

  await ctx.request('PATCH', '/notifications/preferences', {
    token: user.token,
    body: { inApp: { contributions: false } },
  });
  const updated = await ctx.request('PATCH', '/notifications/preferences', {
    token: user.token,
    body: { inApp: { payments: false } },
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.preferences.inApp.contributions, false);
  assert.equal(updated.body.data.preferences.inApp.payments, false);
  assert.equal(updated.body.data.preferences.inApp.announcements, true);
});

test('notification preferences reject unknown categories, channels and values', async () => {
  const user = await ctx.createUser();

  for (const body of [
    { inApp: { marketing: false } },
    { email: { payments: false } },
    { inApp: { payments: 'no' } },
    { inApp: {} },
  ]) {
    const response = await ctx.request('PATCH', '/notifications/preferences', { token: user.token, body });

    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test('a muted category is not delivered, while other categories still are', async () => {
  const user = await ctx.createUser();

  await ctx.request('PATCH', '/notifications/preferences', {
    token: user.token,
    body: { inApp: { contributions: false } },
  });

  const muted = await notifySafely({
    userId: user.id,
    type: 'contribution_created',
    title: 'New contribution',
    message: 'A contribution is due',
  });
  const delivered = await notifySafely({
    userId: user.id,
    type: 'payment_successful',
    title: 'Payment received',
    message: 'Thank you',
  });

  assert.equal(muted, null);
  assert.ok(delivered && delivered.id);

  const count = await pool.query('SELECT COUNT(*)::INT AS n FROM notifications WHERE user_id = $1', [user.id]);
  assert.equal(count.rows[0].n, 1);
});
