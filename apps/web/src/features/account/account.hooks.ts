import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/api/query-keys';
import { accountApi } from './account.api';
import type { NotificationCategory, NotificationPreferences } from './account.types';

/** 404 means the account has no identity record, which is a normal empty state. */
export function useIdentityDetails() {
  return useQuery({
    queryKey: queryKeys.identity,
    queryFn: async ({ signal }) => {
      try {
        return await accountApi.identity(signal);
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;

        throw error;
      }
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: ({ signal }) => accountApi.sessions(signal),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => accountApi.revokeSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => accountApi.revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.sessions }),
  });
}

export function useMembershipCards() {
  return useQuery({
    queryKey: queryKeys.membershipCards,
    queryFn: ({ signal }) => accountApi.membershipCards(signal),
  });
}

export function useRegenerateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (membershipId: string) => accountApi.regenerateCard(membershipId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.membershipCards }),
  });
}

export function useCardVerification(code: string) {
  return useQuery({
    queryKey: queryKeys.cardVerification(code),
    queryFn: ({ signal }) => accountApi.verifyCard(code, signal),
    enabled: code.length > 0,
    retry: false,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: ({ signal }) => accountApi.notificationPreferences(signal),
  });
}

/** Optimistic: the switch flips at once and rolls back if the save fails. */
export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, enabled }: { category: NotificationCategory; enabled: boolean }) =>
      accountApi.updateNotificationPreferences({ [category]: enabled }),
    onMutate: async ({ category, enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notificationPreferences });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKeys.notificationPreferences);

      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(queryKeys.notificationPreferences, {
          ...previous,
          inApp: { ...previous.inApp, [category]: enabled },
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notificationPreferences, context.previous);
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(queryKeys.notificationPreferences, preferences);
    },
  });
}
