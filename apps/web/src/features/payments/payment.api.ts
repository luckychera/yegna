import { api } from '@/lib/api/client';
import type { Paged } from '@/lib/api/types';
import type {
  AdminPayment,
  CheckoutPayment,
  MyPayment,
  PaymentStatus,
  PaymentSummary,
  VerifyOutcome,
} from './payment.types';

interface RawAdminPayment {
  id: string;
  user_id: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  payment_method: string | null;
  provider_reference: string | null;
  initiated_at: string;
  completed_at: string | null;
}

export interface ListMyPaymentsParams {
  status?: PaymentStatus;
  communityId?: string;
  contributionId?: string;
  limit?: number;
  offset?: number;
}

export const paymentApi = {
  async listMine(
    params: ListMyPaymentsParams,
    signal?: AbortSignal,
  ): Promise<Paged<MyPayment> & { summary: PaymentSummary[] }> {
    const { data, pagination } = await api.get<{ payments: MyPayment[]; summary: PaymentSummary[] }>(
      '/payments/me',
      { query: { ...params }, signal },
    );

    return { items: data.payments, summary: data.summary, pagination: pagination! };
  },

  /** Starts a real provider checkout for the member's own contribution. */
  async checkout(input: {
    contributionId: string;
    amount?: string;
    returnUrl: string;
  }): Promise<{ payment: CheckoutPayment; checkoutUrl: string }> {
    const { data } = await api.post<{ payment: CheckoutPayment; checkoutUrl: string }>('/payments/checkout', input);

    return data;
  },

  /** Asks the backend to confirm the payment with the provider (never trusts the browser). */
  async verify(paymentId: string): Promise<{ payment: CheckoutPayment; outcome: VerifyOutcome | 'pending' }> {
    const { data } = await api.post<{ payment: CheckoutPayment; outcome: VerifyOutcome | 'pending' }>(
      `/payments/${paymentId}/verify`,
    );

    return data;
  },

  async listForCommunity(communityId: string, signal?: AbortSignal): Promise<AdminPayment[]> {
    const { data } = await api.get<RawAdminPayment[]>(`/communities/${communityId}/payments`, { signal });

    return data.map((row) => ({
      id: row.id,
      memberUserId: row.user_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      providerReference: row.provider_reference,
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at,
    }));
  },
};
