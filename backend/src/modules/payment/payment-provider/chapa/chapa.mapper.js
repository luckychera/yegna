function mapChapaInitializationResponse(response) {
  const data = response?.data || {};

  return {
    checkoutUrl: data.checkout_url || null,
    providerTransactionId: data.reference || data.ref_id || null,
    providerReference: data.tx_ref || null,
    status: normalizeChapaStatus(data.status),
    raw: response,
  };
}

function mapChapaVerificationResponse(response) {
  const data = response?.data || {};

  return {
    providerTransactionId: data.reference || data.ref_id || null,
    providerReference: data.tx_ref || null,
    status: normalizeChapaStatus(data.status),
    amount: data.amount != null ? Number(data.amount) : null,
    currency: data.currency || null,
    paymentMethod: data.method || data.payment_method || null,
    mode: data.mode || null,
    raw: response,
  };
}

function normalizeChapaStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'success':
    case 'successful':
      return 'successful';

    case 'failed':
      return 'failed';

    case 'pending':
      return 'pending';

    case 'cancelled':
    case 'canceled':
      return 'cancelled';

    case 'refunded':
      return 'refunded';

    default:
      return 'unknown';
  }
}

module.exports = {
  mapChapaInitializationResponse,
  mapChapaVerificationResponse,
  normalizeChapaStatus,
};
