import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { notificationApi } from './notification.api';

export function useNotifications(params: { unreadOnly?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications(params),
    queryFn: ({ signal }) => notificationApi.list(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Polled once a minute: cheap, and well inside the API's rate limit. */
export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: ({ signal }) => notificationApi.unreadCount(signal),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
