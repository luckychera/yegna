import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { announcementApi } from './announcement.api';
import type { AnnouncementInput } from './announcement.types';

export function useCommunityAnnouncements(communityId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.communityAnnouncements(communityId),
    queryFn: ({ signal }) => announcementApi.list(communityId, signal),
    enabled: enabled && Boolean(communityId),
  });
}

export function useAnnouncement(communityId: string, announcementId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.communityAnnouncements(communityId), announcementId],
    queryFn: ({ signal }) => announcementApi.get(communityId, announcementId as string, signal),
    enabled: Boolean(communityId && announcementId),
    retry: false,
  });
}

export function useMyAnnouncements(limit = 4) {
  return useQuery({
    queryKey: queryKeys.myAnnouncements(limit),
    queryFn: ({ signal }) => announcementApi.mine(limit, signal),
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['announcements'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
}

export function useCreateAnnouncement(communityId: string) {
  const invalidate = useInvalidateAnnouncements();

  return useMutation({
    mutationFn: (input: AnnouncementInput) => announcementApi.create(communityId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateAnnouncement(communityId: string) {
  const invalidate = useInvalidateAnnouncements();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AnnouncementInput> }) =>
      announcementApi.update(communityId, id, input),
    onSuccess: invalidate,
  });
}

export function useRemoveAnnouncement(communityId: string) {
  const invalidate = useInvalidateAnnouncements();

  return useMutation({
    mutationFn: (id: string) => announcementApi.remove(communityId, id),
    onSuccess: invalidate,
  });
}

export function useMarkAnnouncementRead() {
  const invalidate = useInvalidateAnnouncements();

  return useMutation({
    mutationFn: ({ communityId, id }: { communityId: string; id: string }) =>
      announcementApi.markRead(communityId, id),
    onSuccess: invalidate,
  });
}
