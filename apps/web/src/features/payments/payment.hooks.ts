import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { paymentApi, type ListMyPaymentsParams } from './payment.api';

export function useMyPayments(params: ListMyPaymentsParams) {
  return useQuery({
    queryKey: queryKeys.myPayments(params),
    queryFn: ({ signal }) => paymentApi.listMine(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCommunityPayments(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.communityPayments(communityId),
    queryFn: ({ signal }) => paymentApi.listForCommunity(communityId, signal),
    enabled,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: (input: { contributionId: string; amount?: string; returnUrl: string }) =>
      paymentApi.checkout(input),
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => paymentApi.verify(paymentId),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
