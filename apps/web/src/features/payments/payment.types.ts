export type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled' | 'refunded';

export interface MyPayment {
  id: string;
  communityId: string;
  contributionId: string | null;
  community: { id: string; name: string; logoUrl: string | null };
  contribution: { id: string; dueDate: string; periodStart: string; periodEnd: string } | null;
  provider: string;
  providerReference: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  /** Only present while the payment can still be completed. */
  checkoutUrl: string | null;
  initiatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface PaymentSummary {
  currency: string;
  count: number;
  totalPaid: string;
  paidThisMonth: string;
  pendingAmount: string;
  refundedAmount: string;
}

/** Response of POST /payments/checkout and POST /payments/:id/verify. */
export interface CheckoutPayment {
  id: string;
  communityId: string;
  contributionId: string | null;
  provider: string;
  providerReference: string | null;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  checkoutUrl: string | null;
  initiatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
}

export type VerifyOutcome = PaymentStatus;

export interface AdminPayment {
  id: string;
  memberUserId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  providerReference: string | null;
  initiatedAt: string;
  completedAt: string | null;
}
