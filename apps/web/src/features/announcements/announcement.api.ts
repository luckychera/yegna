import { api } from '@/lib/api/client';
import type { Announcement, AnnouncementInput } from './announcement.types';

export const announcementApi = {
  async list(
    communityId: string,
    signal?: AbortSignal,
  ): Promise<{ announcements: Announcement[]; unreadCount: number }> {
    const { data } = await api.get<{ announcements: Announcement[]; unreadCount: number }>(
      `/communities/${communityId}/announcements`,
      { query: { limit: 50 }, signal },
    );

    return data;
  },

  async get(communityId: string, announcementId: string, signal?: AbortSignal): Promise<Announcement> {
    const { data } = await api.get<{ announcement: Announcement }>(
      `/communities/${communityId}/announcements/${announcementId}`,
      { signal },
    );

    return data.announcement;
  },

  async mine(limit: number, signal?: AbortSignal): Promise<Announcement[]> {
    const { data } = await api.get<{ announcements: Announcement[] }>('/announcements/me', {
      query: { limit },
      signal,
    });

    return data.announcements;
  },

  async create(
    communityId: string,
    input: AnnouncementInput,
  ): Promise<{ announcement: Announcement; notifiedMembers: number }> {
    const { data } = await api.post<{ announcement: Announcement; notifiedMembers: number }>(
      `/communities/${communityId}/announcements`,
      input,
    );

    return data;
  },

  async update(communityId: string, announcementId: string, input: Partial<AnnouncementInput>): Promise<Announcement> {
    const { data } = await api.patch<{ announcement: Announcement }>(
      `/communities/${communityId}/announcements/${announcementId}`,
      input,
    );

    return data.announcement;
  },

  async remove(communityId: string, announcementId: string): Promise<void> {
    await api.delete(`/communities/${communityId}/announcements/${announcementId}`);
  },

  async markRead(communityId: string, announcementId: string): Promise<void> {
    await api.post(`/communities/${communityId}/announcements/${announcementId}/read`);
  },
};
