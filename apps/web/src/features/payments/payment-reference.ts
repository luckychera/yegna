/**
 * The reference shown to members. Chapa's own reference is only known after confirmation and the
 * backend does not store it, so we fall back to the transaction reference Yegna sent to Chapa
 * (the same value appears in the Chapa dashboard), which always exists.
 */
export function paymentReference(payment: { id: string; providerReference: string | null }): string {
  return payment.providerReference ?? `YEGNA-PAY-${payment.id}`;
}
