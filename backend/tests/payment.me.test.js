const test = require('node:test');
const assert = require('node:assert/strict');

const { createFixtureContext, unique } = require('./helpers/fixtures');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

function listMine(user, query = '') {
  return ctx.request('GET', `/payments/me${query}`, { token: user.token });
}

async function setup() {
  const admin = await ctx.createUser();
  const member = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  await ctx.addActiveMember(community.id, member, admin.id);

  return { admin, member, community };
}

test('GET /payments/me requires authentication', async () => {
  const response = await ctx.request('GET', '/payments/me');

  assert.equal(response.status, 401);
});

test('GET /payments/me returns an empty result for a user with no payments', async () => {
  const user = await ctx.createUser();

  const response = await listMine(user);

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.payments, []);
  assert.deepEqual(response.body.data.summary, []);
  assert.deepEqual(response.body.pagination, { limit: 20, offset: 0, count: 0, total: 0 });
});

test('GET /payments/me returns only the caller\'s payments with community and contribution context', async () => {
  const { admin, member, community } = await setup();
  const reference = unique('ref');

  const contributionId = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
    dueInDays: 4,
  });
  const mine = await ctx.createPaymentRow({
    communityId: community.id,
    userId: member.id,
    contributionId,
    amount: '1250.50',
    providerReference: reference,
    completedAt: new Date().toISOString(),
  });
  await ctx.createPaymentRow({ communityId: community.id, userId: admin.id, amount: '777.77' });

  const response = await listMine(member);

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.data.payments.map((p) => p.id),
    [mine],
  );
  assert.ok(!response.text.includes('777.77'));

  const payment = response.body.data.payments[0];

  assert.equal(payment.community.name, community.name);
  assert.equal(payment.contribution.id, contributionId);
  assert.ok(payment.contribution.dueDate);
  assert.equal(payment.amount, '1250.50');
  assert.equal(typeof payment.amount, 'string');
  assert.equal(payment.currency, 'ETB');
  assert.equal(payment.status, 'successful');
  assert.equal(payment.paymentMethod, 'telebirr');
  assert.equal(payment.providerReference, reference);
  assert.ok(payment.completedAt);
});

test('GET /payments/me never exposes provider internals', async () => {
  const { member, community } = await setup();

  await ctx.createPaymentRow({
    communityId: community.id,
    userId: member.id,
    status: 'failed',
    providerReference: unique('ref'),
  });

  const response = await listMine(member);

  assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /SECRET-PROVIDER-FAILURE-TEXT|SECRET-METADATA/);
  assert.doesNotMatch(response.text, /txn-|metadata|failure_reason|failureReason|providerTransactionId/);
});

test('GET /payments/me only returns checkoutUrl while a payment can still be completed', async () => {
  const { member, community } = await setup();
  const url = 'https://checkout.example.test/pay/abc';

  const rows = {};
  for (const status of ['pending', 'processing', 'successful', 'failed', 'cancelled', 'refunded']) {
    rows[status] = await ctx.createPaymentRow({
      communityId: community.id,
      userId: member.id,
      status,
      checkoutUrl: url,
    });
  }

  const response = await listMine(member);
  const byId = Object.fromEntries(response.body.data.payments.map((p) => [p.id, p]));

  assert.equal(byId[rows.pending].checkoutUrl, url);
  assert.equal(byId[rows.processing].checkoutUrl, url);

  for (const status of ['successful', 'failed', 'cancelled', 'refunded']) {
    assert.equal(byId[rows[status]].checkoutUrl, null, `${status} must not expose checkoutUrl`);
  }
});

test('GET /payments/me summary covers the full filter set, per currency', async () => {
  const { member, community } = await setup();
  const now = new Date().toISOString();
  const longAgo = new Date(Date.now() - 60 * 86400000).toISOString();

  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '1000.00', completedAt: now });
  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '400.00', completedAt: longAgo });
  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '250.00', status: 'pending' });
  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '100.00', status: 'processing' });
  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '80.00', status: 'refunded' });
  await ctx.createPaymentRow({ communityId: community.id, userId: member.id, amount: '999.00', status: 'failed' });
  await ctx.createPaymentRow({
    communityId: community.id,
    userId: member.id,
    amount: '20.00',
    currency: 'USD',
    completedAt: now,
  });

  // limit=1 must not change the summary
  const response = await listMine(member, '?limit=1');

  assert.equal(response.body.data.payments.length, 1);
  assert.equal(response.body.pagination.total, 7);

  const etb = response.body.data.summary.find((s) => s.currency === 'ETB');
  const usd = response.body.data.summary.find((s) => s.currency === 'USD');

  assert.equal(etb.count, 6);
  assert.equal(etb.totalPaid, '1400.00');
  assert.equal(etb.paidThisMonth, '1000.00');
  assert.equal(etb.pendingAmount, '350.00');
  assert.equal(etb.refundedAmount, '80.00');
  // failed payments never count as paid or pending
  assert.ok(!Object.values(etb).includes('999.00'));

  assert.equal(usd.totalPaid, '20.00');
});

test('GET /payments/me filters by status, community and contribution', async () => {
  const { member, community } = await setup();
  const otherAdmin = await ctx.createUser();
  const secondCommunity = await ctx.createTestCommunity(otherAdmin);
  await ctx.addActiveMember(secondCommunity.id, member, otherAdmin.id);

  const contributionId = await ctx.createContributionRow({
    communityId: community.id,
    userId: member.id,
  });
  const linked = await ctx.createPaymentRow({
    communityId: community.id,
    userId: member.id,
    contributionId,
    status: 'successful',
  });
  const failed = await ctx.createPaymentRow({ communityId: community.id, userId: member.id, status: 'failed' });
  const elsewhere = await ctx.createPaymentRow({ communityId: secondCommunity.id, userId: member.id });

  const idsOf = (response) => response.body.data.payments.map((p) => p.id);

  assert.deepEqual(idsOf(await listMine(member, '?status=failed')), [failed]);
  assert.deepEqual(idsOf(await listMine(member, `?communityId=${secondCommunity.id}`)), [elsewhere]);
  assert.deepEqual(idsOf(await listMine(member, `?contributionId=${contributionId}`)), [linked]);
});

test('GET /payments/me rejects invalid filters', async () => {
  const user = await ctx.createUser();

  const invalid = [
    '?status=bogus',
    '?communityId=nope',
    '?contributionId=nope',
    '?limit=0',
    '?limit=101',
    '?offset=-1',
    '?status=failed&status=successful',
  ];

  for (const query of invalid) {
    const response = await listMine(user, query);

    assert.equal(response.status, 400, `expected 400 for ${query}`);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  }
});

test('GET /payments/me paginates newest first', async () => {
  const { member, community } = await setup();

  const ids = [];
  for (const minutesAgo of [30, 20, 10]) {
    ids.push(
      await ctx.createPaymentRow({
        communityId: community.id,
        userId: member.id,
        initiatedMinutesAgo: minutesAgo,
      }),
    );
  }

  const first = await listMine(member, '?limit=2');
  const second = await listMine(member, '?limit=2&offset=2');

  assert.deepEqual(
    first.body.data.payments.map((p) => p.id),
    [ids[2], ids[1]],
  );
  assert.deepEqual(first.body.pagination, { limit: 2, offset: 0, count: 2, total: 3 });
  assert.deepEqual(
    second.body.data.payments.map((p) => p.id),
    [ids[0]],
  );
});

test('payment lifecycle operations are not exposed under /payments', async () => {
  const { member, community } = await setup();
  const paymentId = await ctx.createPaymentRow({
    communityId: community.id,
    userId: member.id,
    status: 'pending',
  });

  for (const action of ['process', 'success', 'fail', 'cancel', 'refund']) {
    const response = await ctx.request('POST', `/payments/${paymentId}/${action}`, {
      token: member.token,
    });

    assert.equal(response.status, 404, `${action} must not be routable here`);
  }
});
