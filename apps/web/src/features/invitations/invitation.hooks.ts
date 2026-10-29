import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { invitationApi } from './invitation.api';
import type { InvitationStatus } from './invitation.types';

export function useMyInvitations(params: { status?: InvitationStatus; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.myInvitations(params),
    queryFn: ({ signal }) => invitationApi.listMine(params, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePendingInvitationCount() {
  const query = useMyInvitations({ status: 'pending', limit: 1 });

  return query.data?.pagination.total ?? 0;
}

export function useRespondToInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'accept' | 'reject' }) =>
      response === 'accept' ? invitationApi.accept(id) : invitationApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useCommunityInvitations(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.communityInvitations(communityId),
    queryFn: ({ signal }) => invitationApi.listForCommunity(communityId, signal),
    enabled,
  });
}

export function useRevokeInvitation(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => invitationApi.revoke(communityId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.communityInvitations(communityId) }),
  });
}
