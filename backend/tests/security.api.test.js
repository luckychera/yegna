const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../src/config/database');
const { createFixtureContext } = require('./helpers/fixtures');
const {
  matchesVerifiedAmount,
  verifyPaymentWithProvider,
  toMemberPayment,
} = require('../src/modules/payment/payment.verification');
const { isTrustedAppUrl } = require('../src/utils/origins');

const ctx = createFixtureContext();

test.before(() => ctx.start());
test.after(() => ctx.cleanup());

test('a non-member asking for a community gets 403, never 500', async () => {
  const admin = await ctx.createUser();
  const outsider = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);

  for (const path of [
    `/communities/${community.id}`,
    `/communities/${community.id}/members`,
    `/communities/${community.id}/contributions`,
    `/communities/${community.id}/invitations`,
  ]) {
    const response = await ctx.request('GET', path, { token: outsider.token });

    assert.equal(response.status, 403, path);
    assert.equal(response.body.error.code, 'COMMUNITY_ACCESS_DENIED', path);
  }
});

test('a malformed community ID is a 400 validation error', async () => {
  const user = await ctx.createUser();
  const response = await ctx.request('GET', '/communities/not-a-uuid/members', { token: user.token });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_COMMUNITY_ID');
});

test('only the Yegna web app counts as a trusted browser origin', () => {
  assert.equal(isTrustedAppUrl('http://localhost:5173/payments/return'), true);
  assert.equal(isTrustedAppUrl('https://evil.example/phish'), false);
  assert.equal(isTrustedAppUrl('javascript:alert(1)'), false);
});

test('checkout refuses a return URL outside the Yegna web app', async () => {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  const contributionId = await ctx.createContributionRow({ communityId: community.id, userId: admin.id });

  const response = await ctx.request('POST', '/payments/checkout', {
    token: admin.token,
    body: { contributionId, returnUrl: 'https://evil.example/steal' },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_RETURN_URL');

  const created = await pool.query('SELECT COUNT(*)::INT AS n FROM payment_transactions WHERE contribution_id = $1', [
    contributionId,
  ]);

  assert.equal(created.rows[0].n, 0);
});

test('a provider success only counts for the exact amount and currency', () => {
  const payment = { amount: '250.00', currency: 'ETB' };

  assert.equal(matchesVerifiedAmount(payment, { amount: 250, currency: 'ETB' }), true);
  assert.equal(matchesVerifiedAmount(payment, { amount: '250.00', currency: 'etb' }), true);
  assert.equal(matchesVerifiedAmount(payment, { amount: 1, currency: 'ETB' }), false);
  assert.equal(matchesVerifiedAmount(payment, { amount: 250, currency: 'USD' }), false);
  assert.equal(matchesVerifiedAmount(payment, { amount: null, currency: 'ETB' }), false);
});

async function createPendingPayment(amount = '300.00') {
  const admin = await ctx.createUser();
  const community = await ctx.createTestCommunity(admin);
  const contributionId = await ctx.createContributionRow({
    communityId: community.id,
    userId: admin.id,
    amount: '300.00',
  });
  const paymentId = await ctx.createPaymentRow({
    communityId: community.id,
    userId: admin.id,
    contributionId,
    amount,
    status: 'pending',
  });
  const result = await pool.query('SELECT * FROM payment_transactions WHERE id = $1', [paymentId]);

  return { admin, contributionId, payment: result.rows[0] };
}

function fakeProvider(result) {
  return () => ({
    async verifyPayment() {
      if (result instanceof Error) throw result;
      return result;
    },
  });
}

test('a verified underpayment marks the payment failed and leaves the contribution unpaid', async () => {
  const { admin, contributionId, payment } = await createPendingPayment('300.00');

  const { outcome } = await verifyPaymentWithProvider(payment, admin.id, {
    providerFactory: fakeProvider({ status: 'successful', amount: 1, currency: 'ETB' }),
  });

  assert.equal(outcome, 'failed');

  const contribution = await pool.query('SELECT paid_amount FROM contributions WHERE id = $1', [contributionId]);

  assert.equal(contribution.rows[0].paid_amount, '0.00');
});

test('a verified matching payment settles through processing to successful', async () => {
  const { admin, contributionId, payment } = await createPendingPayment('300.00');

  const { outcome, payment: settled } = await verifyPaymentWithProvider(payment, admin.id, {
    providerFactory: fakeProvider({ status: 'successful', amount: '300.00', currency: 'ETB' }),
  });

  assert.equal(outcome, 'successful');
  assert.equal(toMemberPayment(settled).checkoutUrl, null);

  const contribution = await pool.query('SELECT status, paid_amount FROM contributions WHERE id = $1', [
    contributionId,
  ]);

  assert.equal(contribution.rows[0].status, 'paid');
  assert.equal(contribution.rows[0].paid_amount, '300.00');
});

test('"not found" from the provider means not paid yet, not a failure', async () => {
  const { admin, payment } = await createPendingPayment();
  const error = Object.assign(new Error('Transaction not found'), {
    code: 'CHAPA_API_ERROR',
    providerStatus: 404,
  });

  const { outcome, payment: unchanged } = await verifyPaymentWithProvider(payment, admin.id, {
    providerFactory: fakeProvider(error),
  });

  assert.equal(outcome, 'pending');
  assert.equal(unchanged.status, 'pending');
});
