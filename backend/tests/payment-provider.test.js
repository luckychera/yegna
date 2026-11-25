const test = require('node:test');
const assert = require('node:assert/strict');

const PaymentProvider = require('../src/modules/payment/payment-provider/payment-provider.interface');

const {
  getPaymentProvider,
} = require('../src/modules/payment/payment-provider/payment-provider.factory');

const ChapaProvider = require('../src/modules/payment/payment-provider/chapa/chapa.provider');

function createMockClient() {
  return {
    initializeTransactionCalls: [],
    verifyTransactionCalls: [],

    async initializeTransaction(payload) {
      this.initializeTransactionCalls.push(payload);

      return {
        status: 'success',
        message: 'Hosted Link',
        data: {
          checkout_url: 'https://checkout.chapa.co/test-checkout',
          tx_ref: payload.tx_ref,
          reference: 'AP_TEST_REFERENCE',
          status: 'pending',
        },
      };
    },

    async verifyTransaction(txRef) {
      this.verifyTransactionCalls.push(txRef);

      return {
        status: 'success',
        data: {
          first_name: 'Abebe',
          last_name: 'Kebede',
          currency: 'ETB',
          amount: 100,
          method: 'test',
          status: 'success',
          reference: 'AP_TEST_REFERENCE',
          tx_ref: txRef,
          mode: 'test',
        },
      };
    },
  };
}

test('PaymentProvider cannot be instantiated directly', () => {
  assert.throws(() => new PaymentProvider('test'), /PaymentProvider is an abstract class/);
});

test('PaymentProvider requires initializePayment implementation', async () => {
  class TestProvider extends PaymentProvider {
    constructor() {
      super('test');
    }
  }

  const provider = new TestProvider();

  await assert.rejects(
    () => provider.initializePayment(),
    /initializePayment\(\) must be implemented by the provider/,
  );
});

test('PaymentProvider requires verifyPayment implementation', async () => {
  class TestProvider extends PaymentProvider {
    constructor() {
      super('test');
    }
  }

  const provider = new TestProvider();

  await assert.rejects(
    () => provider.verifyPayment(),
    /verifyPayment\(\) must be implemented by the provider/,
  );
});

test('PaymentProvider requires refundPayment implementation', async () => {
  class TestProvider extends PaymentProvider {
    constructor() {
      super('test');
    }
  }

  const provider = new TestProvider();

  await assert.rejects(
    () => provider.refundPayment(),
    /refundPayment\(\) must be implemented by the provider/,
  );
});

test('factory rejects unsupported providers', () => {
  assert.throws(
    () => getPaymentProvider('unsupported'),
    (error) => {
      assert.equal(error.code, 'UNSUPPORTED_PAYMENT_PROVIDER');
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test('factory returns Chapa provider', () => {
  const provider = getPaymentProvider('chapa');

  assert.ok(provider instanceof ChapaProvider);
  assert.equal(provider.name, 'chapa');
});

test('Chapa provider initializes a payment', async () => {
  const client = createMockClient();
  const provider = new ChapaProvider({ client });

  const result = await provider.initializePayment({
    amount: 100,
    currency: 'ETB',
    txRef: 'YEGNA-PAY-TEST-001',
    customer: {
      email: 'abebe@example.com',
      firstName: 'Abebe',
      lastName: 'Kebede',
      phone: '0912345678',
    },
    callbackUrl: 'https://example.com/callback',
    returnUrl: 'https://example.com/payment-result',
    metadata: {
      communityId: 'community-test',
    },
  });

  assert.equal(result.checkoutUrl, 'https://checkout.chapa.co/test-checkout');

  assert.equal(result.providerTransactionId, 'AP_TEST_REFERENCE');

  assert.equal(result.providerReference, 'YEGNA-PAY-TEST-001');

  assert.equal(result.status, 'pending');

  assert.equal(client.initializeTransactionCalls.length, 1);

  assert.deepEqual(client.initializeTransactionCalls[0], {
    amount: '100',
    currency: 'ETB',
    tx_ref: 'YEGNA-PAY-TEST-001',
    email: 'abebe@example.com',
    first_name: 'Abebe',
    last_name: 'Kebede',
    phone_number: '0912345678',
    callback_url: 'https://example.com/callback',
    return_url: 'https://example.com/payment-result',
    meta: {
      communityId: 'community-test',
    },
  });
});

test('Chapa provider verifies a payment', async () => {
  const client = createMockClient();
  const provider = new ChapaProvider({ client });

  const result = await provider.verifyPayment({
    txRef: 'YEGNA-PAY-TEST-001',
  });

  assert.equal(result.providerTransactionId, 'AP_TEST_REFERENCE');
  assert.equal(result.providerReference, 'YEGNA-PAY-TEST-001');
  assert.equal(result.status, 'successful');
  assert.equal(result.amount, 100);
  assert.equal(result.currency, 'ETB');
  assert.equal(result.paymentMethod, 'test');
  assert.equal(result.mode, 'test');

  assert.deepEqual(client.verifyTransactionCalls, ['YEGNA-PAY-TEST-001']);
});

test('Chapa provider does not claim refund support yet', async () => {
  const provider = new ChapaProvider({
    client: createMockClient(),
  });

  await assert.rejects(
    () => provider.refundPayment(),
    (error) => {
      assert.equal(error.code, 'CHAPA_REFUND_NOT_IMPLEMENTED');
      assert.equal(error.statusCode, 501);
      return true;
    },
  );
});
