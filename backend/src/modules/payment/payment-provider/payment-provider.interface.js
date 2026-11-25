class PaymentProvider {
  constructor(name) {
    if (new.target === PaymentProvider) {
      throw new Error('PaymentProvider is an abstract class');
    }

    this.name = name;
  }

  async initializePayment() {
    throw new Error(
      `${this.name}: initializePayment() must be implemented by the provider`,
    );
  }

  async verifyPayment() {
    throw new Error(
      `${this.name}: verifyPayment() must be implemented by the provider`,
    );
  }

  async refundPayment() {
    throw new Error(
      `${this.name}: refundPayment() must be implemented by the provider`,
    );
  }
}

module.exports = PaymentProvider;
