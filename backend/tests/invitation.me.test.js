const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { pool } = require('../src/config/database');
const { createInvitation } = require('../src/modules/invitation/invitation.service');
const { createFixtureContext, unique } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

async function setup({ inviterName = ['Eyob', 'Tesfaye'] } = {}) {
  const inviter = await ctx.createUser({ firstName: inviterName[0], lastName: inviterName[1] });
  const invitee = await ctx.createUser();
  const community = await ctx.createTestCommunity(inviter, { name: `${unique('inv')} Community` });

  return { inviter, invitee, community };
}

function invite({ inviter, invitee, community }) {
  return createInvitation({
    communityId: community.id,
    inviterUserId: inviter.id,
    invitedUserId: invitee.id,
    metadata: { source: 'automated-test' },
  });
}

function listMine(user, query = '') {
  return ctx.request('GET', `/invitations/me${query}`, { token: user.token });
}

function acceptById(user, invitationId) {
  return ctx.request('POST', `/invitations/${invitationId}/accept`, { token: user.token });
}

/* ---------- route mounting fix ---------- */

test('invitation routes are exposed at their intended paths', async () => {
  const fixture = await setup();

  // admin create + list under /communities/:communityId/invitations
  const created = await ctx.request('POST', `/communities/${fixture.community.id}/invitations`, {
    token: fixture.inviter.token,
    body: { invitedUserId: fixture.invitee.id },
  });

  assert.equal(created.status, 201);
  assert.ok(created.body.data.token);

  const listed = await ctx.request('GET', `/communities/${fixture.community.id}/invitations`, {
    token: fixture.inviter.token,
  });

  assert.equal(listed.status, 200);

  // token accept under /invitations/accept
  const accepted = await ctx.request('POST', '/invitations/accept', {
    token: fixture.invitee.token,
    body: { invitationToken: created.body.data.token },
  });

  assert.equal(accepted.status, 200);
});

test('reject is exposed at /invitations/:invitationId/reject', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);

  const response = await ctx.request('POST', `/invitations/${invitation.id}/reject`, {
    token: fixture.invitee.token,
  });

  assert.equal(response.status, 200);
});

test('the accidental doubled /communities/communities/... paths no longer exist', async () => {
  const fixture = await setup();

  const doubledList = await ctx.request(
    'GET',
    `/communities/communities/${fixture.community.id}/invitations`,
    { token: fixture.inviter.token },
  );
  const doubledAccept = await ctx.request('POST', '/communities/invitations/accept', {
    token: fixture.invitee.token,
    body: { invitationToken: 'whatever' },
  });

  assert.equal(doubledList.status, 404);
  assert.equal(doubledAccept.status, 404);
});

test('token accept without a token returns 400 instead of a server error', async () => {
  const user = await ctx.createUser();

  const response = await ctx.request('POST', '/invitations/accept', {
    token: user.token,
    body: {},
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

/* ---------- GET /invitations/me ---------- */

test('GET /invitations/me requires authentication', async () => {
  const response = await ctx.request('GET', '/invitations/me');

  assert.equal(response.status, 401);
});

test('GET /invitations/me lists only the caller\'s invitations with community and inviter', async () => {
  const fixture = await setup();
  const otherInvitee = await ctx.createUser();

  const mine = await invite(fixture);
  await invite({ ...fixture, invitee: otherInvitee });

  const response = await listMine(fixture.invitee);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.invitations.length, 1);

  const item = response.body.data.invitations[0];

  assert.equal(item.id, mine.id);
  assert.equal(item.status, 'pending');
  assert.equal(item.community.id, fixture.community.id);
  assert.equal(item.community.name, fixture.community.name);
  assert.equal(item.inviter.name, 'Eyob Tesfaye');
  assert.ok(item.expiresAt);
  assert.deepEqual(response.body.pagination, { limit: 20, offset: 0, count: 1, total: 1 });
});

test('GET /invitations/me never exposes the token, its hash, or internal fields', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);
  const tokenHash = crypto.createHash('sha256').update(invitation.token).digest('hex');

  const response = await listMine(fixture.invitee);

  assert.equal(response.status, 200);
  assert.ok(!response.text.includes(invitation.token));
  assert.ok(!response.text.includes(tokenHash));
  assert.doesNotMatch(response.text, /token|inviter_user_id|invited_user_id|metadata/i);
});

test('GET /invitations/me filters by status and reports expired invitations as expired', async () => {
  const fixture = await setup();
  const accepted = await invite(fixture);
  const secondCommunity = await ctx.createTestCommunity(fixture.inviter);
  const expired = await createInvitation({
    communityId: secondCommunity.id,
    inviterUserId: fixture.inviter.id,
    invitedUserId: fixture.invitee.id,
    metadata: {},
  });

  await pool.query("UPDATE community_invitations SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1", [
    expired.id,
  ]);
  assert.equal((await acceptById(fixture.invitee, accepted.id)).status, 200);

  const pending = await listMine(fixture.invitee, '?status=pending');
  const acceptedList = await listMine(fixture.invitee, '?status=accepted');
  const expiredList = await listMine(fixture.invitee, '?status=expired');

  assert.equal(pending.body.pagination.total, 0);
  assert.deepEqual(
    acceptedList.body.data.invitations.map((i) => i.id),
    [accepted.id],
  );
  assert.deepEqual(
    expiredList.body.data.invitations.map((i) => i.id),
    [expired.id],
  );
  assert.equal(expiredList.body.data.invitations[0].status, 'expired');
});

test('GET /invitations/me paginates and validates query parameters', async () => {
  const fixture = await setup();
  const secondCommunity = await ctx.createTestCommunity(fixture.inviter);

  await invite(fixture);
  await createInvitation({
    communityId: secondCommunity.id,
    inviterUserId: fixture.inviter.id,
    invitedUserId: fixture.invitee.id,
    metadata: {},
  });

  const page = await listMine(fixture.invitee, '?limit=1');
  const badStatus = await listMine(fixture.invitee, '?status=bogus');
  const badLimit = await listMine(fixture.invitee, '?limit=0');

  assert.equal(page.body.data.invitations.length, 1);
  assert.deepEqual(page.body.pagination, { limit: 1, offset: 0, count: 1, total: 2 });
  assert.equal(badStatus.status, 400);
  assert.equal(badLimit.status, 400);
});

/* ---------- POST /invitations/:invitationId/accept ---------- */

test('accept-by-ID activates membership for the intended recipient', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);

  const response = await acceptById(fixture.invitee, invitation.id);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const membership = await pool.query(
    'SELECT status FROM community_memberships WHERE community_id = $1 AND user_id = $2',
    [fixture.community.id, fixture.invitee.id],
  );
  const stored = await pool.query('SELECT status, accepted_at FROM community_invitations WHERE id = $1', [
    invitation.id,
  ]);

  assert.equal(membership.rows[0].status, 'active');
  assert.equal(stored.rows[0].status, 'accepted');
  assert.ok(stored.rows[0].accepted_at);
});

test('accept-by-ID requires authentication', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);

  const response = await ctx.request('POST', `/invitations/${invitation.id}/accept`);

  assert.equal(response.status, 401);
});

test('accept-by-ID rejects a user who is not the intended recipient', async () => {
  const fixture = await setup();
  const intruder = await ctx.createUser();
  const invitation = await invite(fixture);

  const response = await acceptById(intruder, invitation.id);

  assert.equal(response.status, 403);

  const stored = await pool.query('SELECT status FROM community_invitations WHERE id = $1', [invitation.id]);
  const membership = await pool.query(
    'SELECT 1 FROM community_memberships WHERE community_id = $1 AND user_id = $2',
    [fixture.community.id, intruder.id],
  );

  assert.equal(stored.rows[0].status, 'pending');
  assert.equal(membership.rowCount, 0);
});

test('accept-by-ID returns 404 for an unknown invitation and 400 for a malformed ID', async () => {
  const user = await ctx.createUser();

  const unknown = await acceptById(user, UNKNOWN_ID);
  const malformed = await acceptById(user, 'not-a-uuid');

  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'INVITATION_NOT_FOUND');
  assert.equal(malformed.status, 400);
});

test('accept-by-ID cannot be repeated, nor used after reject, revoke, or expiry', async () => {
  const fixture = await setup();

  const twice = await invite(fixture);
  assert.equal((await acceptById(fixture.invitee, twice.id)).status, 200);
  assert.equal((await acceptById(fixture.invitee, twice.id)).status, 409);

  const secondInvitee = await ctx.createUser();
  const rejected = await invite({ ...fixture, invitee: secondInvitee });
  await ctx.request('POST', `/invitations/${rejected.id}/reject`, { token: secondInvitee.token });
  assert.equal((await acceptById(secondInvitee, rejected.id)).status, 409);

  const thirdInvitee = await ctx.createUser();
  const revoked = await invite({ ...fixture, invitee: thirdInvitee });
  await ctx.request(
    'POST',
    `/communities/${fixture.community.id}/invitations/${revoked.id}/revoke`,
    { token: fixture.inviter.token },
  );
  assert.equal((await acceptById(thirdInvitee, revoked.id)).status, 409);

  const fourthInvitee = await ctx.createUser();
  const expired = await invite({ ...fixture, invitee: fourthInvitee });
  await pool.query("UPDATE community_invitations SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [
    expired.id,
  ]);
  const expiredResponse = await acceptById(fourthInvitee, expired.id);
  assert.equal(expiredResponse.status, 409);
  assert.equal(expiredResponse.body.error.code, 'INVITATION_EXPIRED');
});

test('accept-by-ID does not return or reveal the invitation token', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);

  const response = await acceptById(fixture.invitee, invitation.id);

  assert.ok(!response.text.includes(invitation.token));
  assert.doesNotMatch(response.text, /token_hash|tokenHash/);
});

/* ---------- admin invitation endpoints (previously 500/404 over HTTP) ---------- */

test('admin can list community invitations and filter by status', async () => {
  const fixture = await setup();
  const pending = await invite(fixture);
  const secondInvitee = await ctx.createUser();
  const revoked = await invite({ ...fixture, invitee: secondInvitee });

  await ctx.request('POST', `/communities/${fixture.community.id}/invitations/${revoked.id}/revoke`, {
    token: fixture.inviter.token,
  });

  const all = await ctx.request('GET', `/communities/${fixture.community.id}/invitations`, {
    token: fixture.inviter.token,
  });
  const onlyPending = await ctx.request(
    'GET',
    `/communities/${fixture.community.id}/invitations?status=pending`,
    { token: fixture.inviter.token },
  );

  assert.equal(all.status, 200);
  assert.equal(all.body.data.length, 2);
  assert.deepEqual(
    onlyPending.body.data.map((i) => i.id),
    [pending.id],
  );
});

test('admin can fetch a single invitation, scoped to its own community', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);
  const otherAdmin = await ctx.createUser();
  const otherCommunity = await ctx.createTestCommunity(otherAdmin);

  const found = await ctx.request(
    'GET',
    `/communities/${fixture.community.id}/invitations/${invitation.id}`,
    { token: fixture.inviter.token },
  );
  const wrongCommunity = await ctx.request(
    'GET',
    `/communities/${otherCommunity.id}/invitations/${invitation.id}`,
    { token: otherAdmin.token },
  );
  const malformed = await ctx.request(
    'GET',
    `/communities/${fixture.community.id}/invitations/not-a-uuid`,
    { token: fixture.inviter.token },
  );

  assert.equal(found.status, 200);
  assert.equal(found.body.data.id, invitation.id);
  assert.equal(wrongCommunity.status, 404);
  assert.equal(malformed.status, 400);
});

test('an admin cannot revoke another community\'s invitation through their own community URL', async () => {
  const fixture = await setup();
  const invitation = await invite(fixture);
  const otherAdmin = await ctx.createUser();
  const otherCommunity = await ctx.createTestCommunity(otherAdmin);

  const response = await ctx.request(
    'POST',
    `/communities/${otherCommunity.id}/invitations/${invitation.id}/revoke`,
    { token: otherAdmin.token },
  );

  assert.equal(response.status, 404);

  const stored = await pool.query('SELECT status FROM community_invitations WHERE id = $1', [invitation.id]);

  assert.equal(stored.rows[0].status, 'pending');
});

test('a member with no roles cannot list or revoke invitations', async () => {
  const fixture = await setup();
  const plainMember = await ctx.createUser();
  const invitation = await invite(fixture);

  await ctx.addActiveMember(fixture.community.id, plainMember, fixture.inviter.id);

  const list = await ctx.request('GET', `/communities/${fixture.community.id}/invitations`, {
    token: plainMember.token,
  });
  const revoke = await ctx.request(
    'POST',
    `/communities/${fixture.community.id}/invitations/${invitation.id}/revoke`,
    { token: plainMember.token },
  );

  assert.equal(list.status, 403);
  assert.equal(revoke.status, 403);

  const stored = await pool.query('SELECT status FROM community_invitations WHERE id = $1', [invitation.id]);

  assert.equal(stored.rows[0].status, 'pending');
});

test('reject with a malformed invitation ID returns 400', async () => {
  const user = await ctx.createUser();

  const response = await ctx.request('POST', '/invitations/not-a-uuid/reject', { token: user.token });

  assert.equal(response.status, 400);
});
