const {
  PAYMENT_PROVIDER,
} = require('../payment.constants');

const ChapaProvider = require('./chapa/chapa.provider');

function getPaymentProvider(provider) {
  switch (provider) {
    case PAYMENT_PROVIDER.CHAPA:
      return new ChapaProvider();

    default: {
      const error = new Error(`Unsupported payment provider: ${provider}`);
      error.statusCode = 400;
      error.code = 'UNSUPPORTED_PAYMENT_PROVIDER';

      throw error;
    }
  }
}

module.exports = {
  getPaymentProvider,
};
