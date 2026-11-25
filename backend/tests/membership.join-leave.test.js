const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

const UNKNOWN_COMMUNITY_ID = '00000000-0000-4000-8000-000000000000';

function join(user, communityId) {
  return ctx.request('POST', `/communities/${communityId}/join`, { token: user.token });
}

function leave(user, communityId) {
  return ctx.request('POST', `/communities/${communityId}/leave`, { token: user.token });
}

test('join requires authentication', async () => {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const response = await ctx.request('POST', `/communities/${community.id}/join`);

  assert.equal(response.status, 401);
});

test('join creates a pending membership when the community requires approval', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const response = await join(applicant, community.id);

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Your request to join has been submitted');
  assert.equal(response.body.data.membership.status, 'pending');
  assert.equal(response.body.data.membership.communityId, community.id);
  assert.doesNotMatch(response.text, /user_id|userId|metadata/);

  const stored = await pool.query(
    'SELECT user_id, status, metadata FROM community_memberships WHERE id = $1',
    [response.body.data.membership.id],
  );

  assert.equal(stored.rows[0].user_id, applicant.id);
  assert.equal(stored.rows[0].metadata.source, 'self_join');
});

test('join activates immediately when the community does not require approval', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin, { requiresApproval: false });

  const response = await join(applicant, community.id);

  assert.equal(response.status, 201);
  assert.equal(response.body.message, 'You have joined the community');
  assert.equal(response.body.data.membership.status, 'active');
  assert.ok(response.body.data.membership.joinedAt);
});

test('join returns 409 when the user already has a pending or active membership', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const first = await join(applicant, community.id);
  const duplicatePending = await join(applicant, community.id);
  const creatorAlreadyActive = await join(admin, community.id);

  assert.equal(first.status, 201);
  assert.equal(duplicatePending.status, 409);
  assert.equal(creatorAlreadyActive.status, 409);
  assert.equal(creatorAlreadyActive.body.success, false);
});

test('join returns 409 COMMUNITY_NOT_JOINABLE for a non-active community', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await pool.query("UPDATE communities SET status = 'suspended' WHERE id = $1", [community.id]);

  const response = await join(applicant, community.id);

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'COMMUNITY_NOT_JOINABLE');

  const stored = await pool.query(
    'SELECT 1 FROM community_memberships WHERE community_id = $1 AND user_id = $2',
    [community.id, applicant.id],
  );

  assert.equal(stored.rowCount, 0);
});

test('join returns 404 for an unknown community and 400 for a malformed ID', async () => {
  const applicant = await ctx.createUser();

  const unknown = await join(applicant, UNKNOWN_COMMUNITY_ID);
  const malformed = await join(applicant, 'not-a-uuid');

  assert.equal(unknown.status, 404);
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'INVALID_COMMUNITY_ID');
});

test('concurrent join requests produce one membership and never a server error', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const responses = await Promise.all([join(applicant, community.id), join(applicant, community.id)]);

  assert.deepEqual(
    responses.map((r) => r.status).sort(),
    [201, 409],
  );

  const stored = await pool.query(
    'SELECT COUNT(*)::INT AS count FROM community_memberships WHERE community_id = $1 AND user_id = $2',
    [community.id, applicant.id],
  );

  assert.equal(stored.rows[0].count, 1);
});

test('a user who left can request to join again using the existing rejoin rule', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);

  const left = await leave(member, community.id);
  const rejoined = await join(member, community.id);

  assert.equal(left.status, 200);
  assert.equal(rejoined.status, 201);
  assert.equal(rejoined.body.data.membership.status, 'pending');
});

test('leave moves an active membership to left', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);

  const response = await leave(member, community.id);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'You have left the community');
  assert.equal(response.body.data.membership.status, 'left');
  assert.ok(response.body.data.membership.leftAt);

  const mine = await ctx.request('GET', '/communities/me', { token: member.token });

  assert.deepEqual(mine.body.data.memberships, []);
});

test('leave is allowed for a suspended member', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);
  await ctx.setMembershipStatus(community.id, member.id, 'suspended');

  const response = await leave(member, community.id);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.membership.status, 'left');
});

test('leave follows existing transitions: pending and already-left cannot leave', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await join(applicant, community.id);
  await ctx.addActiveMember(community.id, member, admin.id);
  await leave(member, community.id);

  const pending = await leave(applicant, community.id);
  const again = await leave(member, community.id);

  assert.equal(pending.status, 400);
  assert.equal(pending.body.error.code, 'INVALID_MEMBERSHIP_STATUS_TRANSITION');
  assert.equal(again.status, 400);
  assert.equal(again.body.error.code, 'INVALID_MEMBERSHIP_STATUS_TRANSITION');
});

test('leave returns 404 for a non-member, 400 for a malformed ID, 401 without a token', async () => {
  const admin = await ctx.createUser();
  const outsider = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  const notMember = await leave(outsider, community.id);
  const malformed = await leave(outsider, 'nope');
  const anonymous = await ctx.request('POST', `/communities/${community.id}/leave`);

  assert.equal(notMember.status, 404);
  assert.equal(notMember.body.error.code, 'MEMBERSHIP_NOT_FOUND');
  assert.equal(malformed.status, 400);
  assert.equal(anonymous.status, 401);
});

test('leave only ever affects the caller, never another member', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const bystander = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);
  await ctx.addActiveMember(community.id, bystander, admin.id);

  await leave(member, community.id);

  const stored = await pool.query(
    'SELECT user_id, status FROM community_memberships WHERE community_id = $1',
    [community.id],
  );
  const statusByUser = Object.fromEntries(stored.rows.map((row) => [row.user_id, row.status]));

  assert.equal(statusByUser[member.id], 'left');
  assert.equal(statusByUser[bystander.id], 'active');
  assert.equal(statusByUser[admin.id], 'active');
});
