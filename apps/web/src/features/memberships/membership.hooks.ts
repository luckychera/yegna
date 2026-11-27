import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { membershipApi } from './membership.api';
import type { MemberAction } from './membership.types';

export function useCommunityMembers(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.members(communityId),
    queryFn: ({ signal }) => membershipApi.list(communityId, signal),
    enabled,
  });
}

export function useAssignableRoles(communityId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.assignableRoles(communityId),
    queryFn: ({ signal }) => membershipApi.assignableRoles(communityId, signal),
    enabled,
  });
}

export function useChangeMemberRole(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ membershipId, roleId }: { membershipId: string; roleId: string }) =>
      membershipApi.changeRole(communityId, membershipId, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(communityId) }),
  });
}

export function useMemberAction(communityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: MemberAction }) =>
      membershipApi.act(communityId, membershipId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communities'] }),
  });
}
