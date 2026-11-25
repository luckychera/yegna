import { api } from '@/lib/api/client';
import type { Pagination } from '@/lib/api/types';
import type { AppNotification } from './notification.types';

interface RawNotification {
  id: string;
  community_id: string | null;
  type: string;
  title: string;
  message: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

function mapNotification(row: RawNotification): AppNotification {
  return {
    id: row.id,
    communityId: row.community_id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const notificationApi = {
  async list(
    params: { unreadOnly?: boolean; limit?: number; offset?: number },
    signal?: AbortSignal,
  ): Promise<{ items: AppNotification[]; pagination: Pagination }> {
    const { data, pagination } = await api.get<RawNotification[]>('/notifications', {
      query: { ...params },
      signal,
    });

    return { items: data.map(mapNotification), pagination: pagination! };
  },

  async unreadCount(signal?: AbortSignal): Promise<number> {
    const { data } = await api.get<{ unreadCount: number }>('/notifications/unread-count', { signal });

    return data.unreadCount;
  },

  async markRead(notificationId: string): Promise<void> {
    await api.patch(`/notifications/${notificationId}/read`);
  },

  async markAllRead(): Promise<number> {
    const { data } = await api.patch<{ updatedCount: number }>('/notifications/read-all');

    return data.updatedCount;
  },
};
