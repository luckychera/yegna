/**
 * Contract test for the real Chapa client and checkout verification.
 * A local fake server stands in for Chapa. The real API is never called.
 * The verify route ignores any success flag in the request body.
 */
const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');

const SECRET = 'contract-test-secret';

function startFakeChapa() {
  const requests = [];
  const state = {
    verify: 'unpaid',
  };

  const server = http.createServer((req, res) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const record = {
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      };

      requests.push(record);

      const send = (status, payload, rawBody = false) => {
        res.writeHead(status, { 'Content-Type': rawBody ? 'text/plain' : 'application/json' });
        res.end(rawBody ? payload : JSON.stringify(payload));
      };

      if (req.method === 'POST' && req.url === '/v1/transaction/initialize') {
        if (state.verify === 'invalid-init') {
          return send(200, 'not-json', true);
        }

        return send(200, {
          message: 'Hosted Link',
          status: 'success',
          data: {
            checkout_url: `https://checkout.chapa.co/checkout/payment/${record.body.tx_ref}`,
            tx_ref: record.body.tx_ref,
          },
        });
      }

      const verify = req.url.match(/^\/v1\/transaction\/verify\/(.+)$/);

      if (req.method === 'GET' && verify) {
        const txRef = decodeURIComponent(verify[1]);

        if (state.verify === 'invalid') {
          return send(200, '<html>nope</html>', true);
        }

        if (state.verify === 'unpaid') {
          return send(400, { message: 'Transaction not found', status: 'failed', data: null });
        }

        if (state.verify === 'failed') {
          return send(200, {
            status: 'success',
            data: { status: 'failed', amount: '200.00', currency: 'ETB', tx_ref: txRef },
          });
        }

        if (state.verify === 'wrong-amount') {
          return send(200, {
            status: 'success',
            data: { status: 'success', amount: '1.00', currency: 'ETB', tx_ref: txRef },
          });
        }

        if (state.verify === 'wrong-ref') {
          return send(200, {
            status: 'success',
            data: { status: 'success', amount: '200.00', currency: 'ETB', tx_ref: 'SOMEONE-ELSES-PAYMENT' },
          });
        }

        return send(200, {
          status: 'success',
          data: {
            status: 'success',
            amount: '200.00',
            currency: 'ETB',
            tx_ref: txRef,
            reference: 'CH-CONTRACT',
            method: 'telebirr',
          },
        });
      }

      return send(404, {});
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();

      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        state,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

let fake;
let request;
let createUser;
let createTestCommunity;
let addActiveMember;
let createContributionRow;
let cleanup;

test.before(async () => {
  fake = await startFakeChapa();
  process.env.CHAPA_BASE_URL = fake.url;
  process.env.CHAPA_SECRET_KEY = SECRET;

  const { createFixtureContext } = require('./helpers/fixtures');
  const ctx = createFixtureContext();

  await ctx.start();
  request = ctx.request;
  createUser = ctx.createUser;
  createTestCommunity = ctx.createTestCommunity;
  addActiveMember = ctx.addActiveMember;
  createContributionRow = ctx.createContributionRow;
  cleanup = () => ctx.cleanup();
});

test.after(async () => {
  if (cleanup) await cleanup();
  if (fake) await fake.close();
});

async function payableContribution() {
  const admin = await createUser();
  const member = await createUser({ firstName: 'Sara', lastName: 'Bekele' });
  const community = await createTestCommunity(admin, { requiresApproval: false });

  await addActiveMember(community.id, member, admin.id);
  const contributionId = await createContributionRow({
    communityId: community.id,
    userId: member.id,
    amount: '200.00',
  });

  return { admin, member, community, contributionId };
}

test('checkout sends the Chapa initialize contract and does not trust a success flag from the browser', async () => {
  const { member, contributionId } = await payableContribution();
  fake.state.verify = 'unpaid';

  const checkout = await request('POST', '/payments/checkout', {
    token: member.token,
    body: {
      contributionId,
      amount: '200',
      returnUrl: 'http://127.0.0.1:4178/payments/return',
      status: 'successful',
    },
  });

  assert.equal(checkout.status, 201);
  assert.equal(checkout.body.data.payment.status, 'pending');
  assert.equal(checkout.body.data.payment.amount, '200.00');
  assert.match(checkout.body.data.checkoutUrl, /^https:\/\/checkout\.chapa\.co\/checkout\/payment\/YEGNA-PAY-/);

  const sent = fake.requests.find((entry) => entry.url === '/v1/transaction/initialize');

  assert.equal(sent.authorization, `Bearer ${SECRET}`);
  assert.equal(sent.body.amount, '200.00');
  assert.equal(sent.body.currency, 'ETB');
  assert.equal(sent.body.tx_ref, `YEGNA-PAY-${checkout.body.data.payment.id}`);
  assert.equal(sent.body.email, member.email);
  assert.equal(sent.body.return_url, 'http://127.0.0.1:4178/payments/return');
  assert.equal(sent.body.first_name, 'Sara');
  assert.equal(sent.body.last_name, 'Bekele');

  const lied = await request('POST', `/payments/${checkout.body.data.payment.id}/verify`, {
    token: member.token,
    body: { status: 'successful', amount: '200.00', outcome: 'successful' },
  });

  assert.equal(lied.status, 200);
  assert.equal(lied.body.data.outcome, 'pending');
  assert.equal(lied.body.data.payment.status, 'pending');
});

test('a failed provider result, a mismatched amount, and a mismatched reference do not settle the payment', async () => {
  const { member, contributionId } = await payableContribution();

  async function start() {
    const checkout = await request('POST', '/payments/checkout', {
      token: member.token,
      body: {
        contributionId,
        amount: '200',
        returnUrl: 'http://127.0.0.1:4178/payments/return',
      },
    });

    assert.equal(checkout.status, 201);

    return checkout.body.data.payment.id;
  }

  fake.state.verify = 'failed';
  const failedId = await start();
  const failed = await request('POST', `/payments/${failedId}/verify`, { token: member.token, body: {} });

  assert.equal(failed.status, 200);
  assert.equal(failed.body.data.outcome, 'failed');
  assert.equal(failed.body.data.payment.status, 'failed');

  fake.state.verify = 'wrong-amount';
  const amountId = await start();
  const wrongAmount = await request('POST', `/payments/${amountId}/verify`, {
    token: member.token,
    body: { status: 'successful' },
  });

  assert.equal(wrongAmount.body.data.outcome, 'failed');

  fake.state.verify = 'wrong-ref';
  const refId = await start();
  const wrongRef = await request('POST', `/payments/${refId}/verify`, {
    token: member.token,
    body: { status: 'successful' },
  });

  assert.equal(wrongRef.body.data.outcome, 'failed');

  fake.state.verify = 'success';
  const okId = await start();
  const confirmed = await request('POST', `/payments/${okId}/verify`, {
    token: member.token,
    body: { status: 'failed' },
  });

  assert.equal(confirmed.body.data.outcome, 'successful');
  assert.equal(confirmed.body.data.payment.status, 'successful');

  const again = await request('POST', `/payments/${okId}/verify`, {
    token: member.token,
    body: { status: 'failed', amount: '1.00' },
  });

  assert.equal(again.body.data.outcome, 'successful');
});

test('an invalid provider body and an unavailable server are errors, not successful payments', async () => {
  const ChapaClient = require('../src/modules/payment/payment-provider/chapa/chapa.client');
  const client = new ChapaClient({ baseUrl: fake.url, secretKey: SECRET });

  fake.state.verify = 'invalid';

  await assert.rejects(
    () => client.verifyTransaction('YEGNA-PAY-invalid'),
    (error) => error.code === 'CHAPA_INVALID_RESPONSE',
  );

  await assert.rejects(
    () => client.verifyTransaction(''),
    (error) => error.code === 'CHAPA_TRANSACTION_REFERENCE_REQUIRED',
  );

  const closed = new ChapaClient({ baseUrl: 'http://127.0.0.1:1', secretKey: SECRET });

  await assert.rejects(() => closed.initializeTransaction({ tx_ref: 'x', amount: '1.00', currency: 'ETB' }));
});
