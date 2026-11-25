const test = require('node:test');
const assert = require('node:assert/strict');

const { createFixtureContext } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

function listMine(user, query = '') {
  return ctx.request('GET', `/contributions/me${query}`, { token: user.token });
}

async function setup() {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);

  return { admin, member, community };
}

test('GET /contributions/me requires authentication', async () => {
  const response = await ctx.request('GET', '/contributions/me');

  assert.equal(response.status, 401);
});

test('GET /contributions/me returns an empty result for a user with no contributions', async () => {
  const user = await ctx.createUser();

  const response = await listMine(user);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.contributions, []);
  assert.deepEqual(response.body.data.summary, []);
  assert.deepEqual(response.body.pagination, { limit: 20, offset: 0, count: 0, total: 0 });
});

test('GET /contributions/me returns only the caller\'s contributions across communities', async () => {
  const { admin, member, community } = await setup();
  const otherAdmin = await ctx.createUser();
  const secondCommunity = await ctx.createTestCommunity(otherAdmin);
  await ctx.addActiveMember(secondCommunity.id, member, otherAdmin.id);

  const mine1 = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '1000.00',
    paidAmount: '250.00',
    status: 'partially_paid',
    dueInDays: 5,
    notes: 'Monthly equb',
  });
  const mine2 = await ctx.createContributionRow({
    communityId: secondCommunity.id,
    userId: member.id,
    amount: '300.00',
    dueInDays: 10,
  });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: admin.id,
    amount: '999.00',
    dueInDays: 5,
  });

  const response = await listMine(member);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.contributions.map((c) => c.id),
    [mine2, mine1],
  );
  assert.ok(!response.text.includes('999.00'));

  const first = response.body.data.contributions[1];

  assert.equal(first.community.id, community.id);
  assert.equal(first.community.name, community.name);
  assert.equal(first.currency, 'ETB');
  assert.equal(first.status, 'partially_paid');
  assert.equal(first.notes, 'Monthly equb');

  // money is returned as exact decimal strings, never floats
  assert.equal(first.amount, '1000.00');
  assert.equal(first.paidAmount, '250.00');
  assert.equal(first.outstandingAmount, '750.00');
  assert.equal(typeof first.amount, 'string');

  assert.deepEqual(response.body.pagination, { limit: 20, offset: 0, count: 2, total: 2 });
});

test('GET /contributions/me derives isOverdue from due date without altering status', async () => {
  const { member, community } = await setup();

  const pastDue = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    status: 'pending',
    dueInDays: -3,
  });
  const upcoming = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    status: 'pending',
    dueInDays: 3,
  });
  const paidLongAgo = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    status: 'paid',
    paidAmount: '1000.00',
    dueInDays: -60,
  });
  const markedOverdue = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    status: 'overdue',
    dueInDays: 1,
  });

  const response = await listMine(member);
  const byId = Object.fromEntries(response.body.data.contributions.map((c) => [c.id, c]));

  assert.equal(byId[pastDue].isOverdue, true);
  assert.equal(byId[pastDue].status, 'pending');
  assert.equal(byId[upcoming].isOverdue, false);
  assert.equal(byId[paidLongAgo].isOverdue, false);
  assert.equal(byId[markedOverdue].isOverdue, true);
});

test('GET /contributions/me summary is computed over the full filter set, per currency', async () => {
  const { member, community } = await setup();

  await ctx.createContributionRow({ communityId: community.id, userId: member.id, amount: '1000.00', dueInDays: 5 });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '500.00',
    paidAmount: '200.00',
    status: 'partially_paid',
    dueInDays: 6,
  });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '300.00',
    paidAmount: '300.00',
    status: 'paid',
    dueInDays: 7,
  });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '200.00',
    waivedAmount: '200.00',
    status: 'waived',
    dueInDays: 8,
  });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '50.00',
    currency: 'USD',
    dueInDays: 9,
  });
  await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '400.00',
    dueInDays: -2,
  });

  // limit=1 must not change the summary
  const response = await listMine(member, '?limit=1');

  assert.equal(response.body.data.contributions.length, 1);
  assert.equal(response.body.pagination.total, 6);

  const etb = response.body.data.summary.find((s) => s.currency === 'ETB');
  const usd = response.body.data.summary.find((s) => s.currency === 'USD');

  assert.equal(etb.count, 5);
  assert.equal(etb.totalAmount, '2400.00');
  assert.equal(etb.paidAmount, '500.00');
  // pending 1000 + partial 300 outstanding + past-due pending 400; paid and waived add nothing
  assert.equal(etb.outstandingAmount, '1700.00');
  assert.equal(etb.pendingCount, 2);
  assert.equal(etb.overdueCount, 1);

  assert.equal(usd.count, 1);
  assert.equal(usd.totalAmount, '50.00');
});

test('GET /contributions/me filters by status, community and due date range', async () => {
  const { member, community } = await setup();
  const otherAdmin = await ctx.createUser();
  const secondCommunity = await ctx.createTestCommunity(otherAdmin);
  await ctx.addActiveMember(secondCommunity.id, member, otherAdmin.id);

  const pendingSoon = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    dueInDays: 2,
  });
  const paidLater = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    status: 'paid',
    paidAmount: '1000.00',
    dueInDays: 40,
  });
  const otherCommunityRow = await ctx.createContributionRow({
    communityId: secondCommunity.id,
    userId: member.id,
    dueInDays: 3,
  });

  const idsOf = (response) => response.body.data.contributions.map((c) => c.id).sort();

  const byStatus = await listMine(member, '?status=paid');
  const byCommunity = await listMine(member, `?communityId=${secondCommunity.id}`);

  const today = new Date();
  const iso = (days) => new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
  const byRange = await listMine(member, `?dueFrom=${iso(-1)}&dueTo=${iso(10)}`);

  assert.deepEqual(idsOf(byStatus), [paidLater]);
  assert.deepEqual(idsOf(byCommunity), [otherCommunityRow]);
  assert.deepEqual(idsOf(byRange), [pendingSoon, otherCommunityRow].sort());
});

test('GET /contributions/me rejects invalid filters', async () => {
  const user = await ctx.createUser();

  const invalid = [
    '?status=bogus',
    '?communityId=not-a-uuid',
    '?dueFrom=2026-02-30',
    '?dueFrom=yesterday',
    '?dueFrom=2026-05-01&dueTo=2026-04-01',
    '?limit=0',
    '?limit=101',
    '?offset=-5',
    '?status=paid&status=pending',
  ];

  for (const query of invalid) {
    const response = await listMine(user, query);

    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('GET /contributions/me paginates newest due date first', async () => {
  const { member, community } = await setup();

  const ids = [];
  for (const days of [1, 2, 3]) {
    ids.push(
      await ctx.createContributionRow({ communityId: community.id, userId: member.id, dueInDays: days }),
    );
  }

  const first = await listMine(member, '?limit=2');
  const second = await listMine(member, '?limit=2&offset=2');

  assert.deepEqual(
    first.body.data.contributions.map((c) => c.id),
    [ids[2], ids[1]],
  );
  assert.deepEqual(first.body.pagination, { limit: 2, offset: 0, count: 2, total: 3 });
  assert.deepEqual(
    second.body.data.contributions.map((c) => c.id),
    [ids[0]],
  );
});

test('GET /contributions/me keeps history visible after the member leaves', async () => {
  const { member, community } = await setup();

  const id = await ctx.createContributionRow({ communityId: community.id, userId: member.id });
  await ctx.setMembershipStatus(community.id, member.id, 'left');

  const response = await listMine(member);

  assert.deepEqual(
    response.body.data.contributions.map((c) => c.id),
    [id],
  );
});
