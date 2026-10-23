const test = require('node:test');
const assert = require('node:assert/strict');
const { URLSearchParams } = require('node:url');

const { pool } = require('../src/config/database');
const { unique, createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

const SUMMARY_KEYS = [
  'communityType',
  'createdAt',
  'description',
  'id',
  'logoUrl',
  'memberCount',
  'myMembership',
  'name',
  'status',
];

async function listCommunities(user, query) {
  return ctx.request('GET', `/communities?${new URLSearchParams(query)}`, {
    token: user.token,
  });
}

test('GET /communities requires authentication', async () => {
  const response = await ctx.request('GET', '/communities');

  assert.equal(response.status, 401);
});

test('GET /communities returns a public summary with member count and own membership', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const outsider = await ctx.createUser();
  const prefix = unique('sum');

  const community = await ctx.createTestCommunity(admin, {
    name: `${prefix} Savings`,
    description: 'Monthly savings group',
    communityType: 'equb',
  });
  await ctx.addActiveMember(community.id, member, admin.id);

  const asMember = await listCommunities(member, { q: prefix });

  assert.equal(asMember.status, 200);
  assert.equal(asMember.body.success, true);
  assert.equal(asMember.body.data.communities.length, 1);

  const item = asMember.body.data.communities[0];

  assert.deepEqual(Object.keys(item).sort(), SUMMARY_KEYS);
  assert.equal(item.id, community.id);
  assert.equal(item.name, `${prefix} Savings`);
  assert.equal(item.communityType, 'equb');
  assert.equal(item.status, 'active');
  assert.equal(item.memberCount, 2);
  assert.equal(item.myMembership.status, 'active');
  assert.ok(item.myMembership.id);

  assert.deepEqual(asMember.body.pagination, { limit: 20, offset: 0, count: 1, total: 1 });

  const asOutsider = await listCommunities(outsider, { q: prefix });

  assert.equal(asOutsider.body.data.communities[0].myMembership, null);
});

test('GET /communities does not leak settings, creator or metadata', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('leak');

  await ctx.createTestCommunity(admin, { name: `${prefix} Group` });

  const response = await listCommunities(admin, { q: prefix });

  assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /created_by|createdBy|settings|metadata|archived/i);
});

test('GET /communities search is case-insensitive and matches the description', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('srch');

  await ctx.createTestCommunity(admin, {
    name: `${prefix} Bole Neighbours`,
    description: 'Helping each other in Addis',
  });

  const byName = await listCommunities(admin, { q: prefix.toUpperCase() });
  const byDescription = await listCommunities(admin, { q: 'helping each other in addis' });

  assert.equal(byName.body.pagination.total, 1);
  assert.ok(byDescription.body.data.communities.some((c) => c.name.startsWith(prefix)));
});

test('GET /communities treats % and _ in search as literal characters', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('wild');

  await ctx.createTestCommunity(admin, { name: `${prefix} Plain` });
  await ctx.createTestCommunity(admin, { name: `${prefix} 100% Club` });

  const literalPercent = await listCommunities(admin, { q: `${prefix} 100%` });
  const wildcardAttempt = await listCommunities(admin, { q: `${prefix} %` });

  assert.equal(literalPercent.body.pagination.total, 1);
  assert.equal(wildcardAttempt.body.pagination.total, 0);
});

test('GET /communities paginates and reports totals', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('page');

  for (const suffix of ['A', 'B', 'C']) {
    await ctx.createTestCommunity(admin, { name: `${prefix} ${suffix}` });
  }

  const first = await listCommunities(admin, { q: prefix, sort: 'name', limit: '2' });
  const second = await listCommunities(admin, { q: prefix, sort: 'name', limit: '2', offset: '2' });
  const beyond = await listCommunities(admin, { q: prefix, sort: 'name', limit: '2', offset: '10' });

  assert.deepEqual(
    first.body.data.communities.map((c) => c.name),
    [`${prefix} A`, `${prefix} B`],
  );
  assert.deepEqual(first.body.pagination, { limit: 2, offset: 0, count: 2, total: 3 });

  assert.deepEqual(
    second.body.data.communities.map((c) => c.name),
    [`${prefix} C`],
  );
  assert.deepEqual(second.body.pagination, { limit: 2, offset: 2, count: 1, total: 3 });

  assert.deepEqual(beyond.body.data.communities, []);
  assert.deepEqual(beyond.body.pagination, { limit: 2, offset: 10, count: 0, total: 3 });
});

test('GET /communities sort=popular orders by active member count', async () => {
  const admin = await ctx.createUser();
  const extra = await ctx.createUser();
  const prefix = unique('pop');

  await ctx.createTestCommunity(admin, { name: `${prefix} Small` });
  const big = await ctx.createTestCommunity(admin, { name: `${prefix} Big` });
  await ctx.addActiveMember(big.id, extra, admin.id);

  const response = await listCommunities(admin, { q: prefix, sort: 'popular' });

  assert.deepEqual(
    response.body.data.communities.map((c) => c.name),
    [`${prefix} Big`, `${prefix} Small`],
  );
});

test('GET /communities filters by community type', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('type');

  await ctx.createTestCommunity(admin, { name: `${prefix} Equb`, communityType: 'equb' });
  await ctx.createTestCommunity(admin, { name: `${prefix} Edir`, communityType: 'edir' });

  const response = await listCommunities(admin, { q: prefix, type: 'edir' });

  assert.deepEqual(
    response.body.data.communities.map((c) => c.name),
    [`${prefix} Edir`],
  );
});

test('GET /communities hides suspended and archived communities', async () => {
  const admin = await ctx.createUser();
  const prefix = unique('hide');

  await ctx.createTestCommunity(admin, { name: `${prefix} Visible` });
  const suspended = await ctx.createTestCommunity(admin, { name: `${prefix} Suspended` });
  const archived = await ctx.createTestCommunity(admin, { name: `${prefix} Archived` });

  await pool.query("UPDATE communities SET status = 'suspended' WHERE id = $1", [suspended.id]);
  await pool.query('UPDATE communities SET archived_at = NOW() WHERE id = $1', [archived.id]);

  const response = await listCommunities(admin, { q: prefix });

  assert.deepEqual(
    response.body.data.communities.map((c) => c.name),
    [`${prefix} Visible`],
  );
});

test('GET /communities rejects invalid query parameters', async () => {
  const user = await ctx.createUser();

  const invalidQueries = [
    '?limit=0',
    '?limit=101',
    '?limit=abc',
    '?offset=-1',
    '?sort=bogus',
    '?type=bogus',
    `?q=${'x'.repeat(101)}`,
    '?q=a&q=b',
  ];

  for (const query of invalidQueries) {
    const response = await ctx.request('GET', `/communities${query}`, { token: user.token });

    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('GET /communities/me requires authentication', async () => {
  const response = await ctx.request('GET', '/communities/me');

  assert.equal(response.status, 401);
});

test('GET /communities/me is not treated as a community ID and handles no memberships', async () => {
  const user = await ctx.createUser();

  const response = await ctx.request('GET', '/communities/me', { token: user.token });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.memberships, []);
  assert.deepEqual(response.body.pagination, { limit: 20, offset: 0, count: 0, total: 0 });
});

test('GET /communities/me returns memberships with roles and permissions', async () => {
  const admin = await ctx.createUser();
  const applicant = await ctx.createUser();
  const prefix = unique('mine');

  const owned = await ctx.createTestCommunity(admin, { name: `${prefix} Owned` });
  const other = await ctx.createTestCommunity(applicant, { name: `${prefix} Own` });

  // applicant has a pending request in admin's community (approval required by default)
  const join = await ctx.request('POST', `/communities/${owned.id}/join`, {
    token: applicant.token,
  });
  assert.equal(join.status, 201);

  const adminResponse = await ctx.request('GET', '/communities/me', { token: admin.token });

  assert.equal(adminResponse.status, 200);

  const adminItem = adminResponse.body.data.memberships.find((m) => m.community.id === owned.id);

  assert.equal(adminItem.community.name, `${prefix} Owned`);
  assert.equal(adminItem.membership.status, 'active');
  assert.ok(adminItem.roles.some((role) => role.name === 'admin'));
  assert.ok(adminItem.permissions.includes('members.view'));

  const applicantResponse = await ctx.request('GET', '/communities/me', {
    token: applicant.token,
  });
  const ids = applicantResponse.body.data.memberships.map((m) => m.community.id);

  assert.ok(ids.includes(owned.id));
  assert.ok(ids.includes(other.id));

  const pendingItem = applicantResponse.body.data.memberships.find(
    (m) => m.community.id === owned.id,
  );

  assert.equal(pendingItem.membership.status, 'pending');
  assert.deepEqual(pendingItem.roles, []);
  assert.deepEqual(pendingItem.permissions, []);
});

test('GET /communities/me filters by status and excludes left/rejected by default', async () => {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();

  const community = await ctx.createTestCommunity(admin);
  await ctx.addActiveMember(community.id, member, admin.id);
  await ctx.setMembershipStatus(community.id, member.id, 'left');

  const byDefault = await ctx.request('GET', '/communities/me', { token: member.token });
  const left = await ctx.request('GET', '/communities/me?status=left', { token: member.token });

  assert.deepEqual(byDefault.body.data.memberships, []);
  assert.equal(left.body.data.memberships.length, 1);
  assert.equal(left.body.data.memberships[0].membership.status, 'left');
});

test('GET /communities/me paginates and validates status', async () => {
  const admin = await ctx.createUser();

  await ctx.createTestCommunity(admin);
  await ctx.createTestCommunity(admin);

  const page = await ctx.request('GET', '/communities/me?limit=1', { token: admin.token });
  const invalid = await ctx.request('GET', '/communities/me?status=bogus', { token: admin.token });

  assert.equal(page.body.data.memberships.length, 1);
  assert.deepEqual(page.body.pagination, { limit: 1, offset: 0, count: 1, total: 2 });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
});

test('GET /communities/me excludes archived communities', async () => {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await pool.query('UPDATE communities SET archived_at = NOW() WHERE id = $1', [community.id]);

  const response = await ctx.request('GET', '/communities/me', { token: admin.token });

  assert.deepEqual(response.body.data.memberships, []);
});
