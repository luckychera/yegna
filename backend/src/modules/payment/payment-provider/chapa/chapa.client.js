/* global fetch */

const env = require('../../../../config/env');

class ChapaClient {
  constructor({
    baseUrl = env.chapaBaseUrl,
    secretKey = env.chapaSecretKey,
    fetchImpl = fetch,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.secretKey = secretKey;
    this.fetchImpl = fetchImpl;
  }

  async request(path, options = {}) {
    if (!this.secretKey) {
      const error = new Error('Chapa secret key is not configured');
      error.statusCode = 500;
      error.code = 'CHAPA_SECRET_KEY_NOT_CONFIGURED';
      throw error;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    let body;

    try {
      body = await response.json();
    } catch {
      const error = new Error('Chapa returned an invalid response');
      error.statusCode = 502;
      error.code = 'CHAPA_INVALID_RESPONSE';
      throw error;
    }

    if (!response.ok) {
      const error = new Error(body?.message || 'Chapa payment request failed');

      error.statusCode = response.status >= 500 ? 502 : response.status;
      error.code = 'CHAPA_API_ERROR';
      error.providerResponse = body;

      throw error;
    }

    return body;
  }

  async initializeTransaction(payload) {
    return this.request('/v1/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async verifyTransaction(txRef) {
    if (!txRef) {
      const error = new Error('Transaction reference is required');
      error.statusCode = 400;
      error.code = 'CHAPA_TRANSACTION_REFERENCE_REQUIRED';
      throw error;
    }

    return this.request(`/v1/transaction/verify/${encodeURIComponent(txRef)}`, {
      method: 'GET',
    });
  }
}

module.exports = ChapaClient;
