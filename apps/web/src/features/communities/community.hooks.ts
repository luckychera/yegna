import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { communityApi, type ListCommunitiesParams } from './community.api';
import type { CommunityInput, MembershipStatus } from './community.types';

export function useCommunityDirectory(params: ListCommunitiesParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.communities(params),
    queryFn: ({ signal }) => communityApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMyCommunities(params: { status?: MembershipStatus; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.myCommunities(params),
    queryFn: ({ signal }) => communityApi.listMine(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommunityInput) => communityApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communities'] }),
  });
}

export function useUpdateCommunity(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<CommunityInput>) => communityApi.update(communityId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communities'] }),
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (communityId: string) => communityApi.join(communityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communities'] }),
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (communityId: string) => communityApi.leave(communityId),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
