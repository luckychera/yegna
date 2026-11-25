const PaymentProvider = require('../payment-provider.interface');
const ChapaClient = require('./chapa.client');

const {
  mapChapaInitializationResponse,
  mapChapaVerificationResponse,
} = require('./chapa.mapper');

class ChapaProvider extends PaymentProvider {
  constructor(options = {}) {
    super('chapa');

    this.client = options.client || new ChapaClient(options);
  }

  async initializePayment({
    amount,
    currency,
    txRef,
    customer = {},
    callbackUrl,
    returnUrl,
    metadata = null,
  }) {
    const payload = {
      amount: String(amount),
      currency,
      tx_ref: txRef,
    };

    if (customer.email) {
      payload.email = customer.email;
    }

    if (customer.firstName) {
      payload.first_name = customer.firstName;
    }

    if (customer.lastName) {
      payload.last_name = customer.lastName;
    }

    if (customer.phone) {
      payload.phone_number = customer.phone;
    }

    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    if (returnUrl) {
      payload.return_url = returnUrl;
    }

    if (metadata) {
      payload.meta = metadata;
    }

    const response = await this.client.initializeTransaction(payload);

    return mapChapaInitializationResponse(response);
  }

  async verifyPayment({ txRef }) {
    const response = await this.client.verifyTransaction(txRef);

    return mapChapaVerificationResponse(response);
  }

  async refundPayment() {
    const error = new Error(
      'Chapa refund integration is not implemented yet',
    );

    error.statusCode = 501;
    error.code = 'CHAPA_REFUND_NOT_IMPLEMENTED';

    throw error;
  }
}

module.exports = ChapaProvider;
