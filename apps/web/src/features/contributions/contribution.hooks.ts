import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { contributionApi, type ListMyContributionsParams } from './contribution.api';

export function useMyContributions(params: ListMyContributionsParams) {
  return useQuery({
    queryKey: queryKeys.myContributions(params),
    queryFn: ({ signal }) => contributionApi.listMine(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCommunityContributions(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.communityContributions(communityId),
    queryFn: ({ signal }) => contributionApi.listForCommunity(communityId, signal),
    enabled,
  });
}

export function useContributionAction(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contributionId, action }: { contributionId: string; action: 'waive' | 'cancel' }) =>
      action === 'waive'
        ? contributionApi.waive(communityId, contributionId)
        : contributionApi.cancel(communityId, contributionId),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
