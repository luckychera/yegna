import { api } from '@/lib/api/client';
import type { Paged } from '@/lib/api/types';
import type { CommunityInvitation, InvitationStatus, MyInvitation } from './invitation.types';

interface RawInvitation {
  id: string;
  status: InvitationStatus;
  invited_user_id: string;
  expires_at: string;
  created_at: string;
}

export const invitationApi = {
  async listMine(
    params: { status?: InvitationStatus; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<Paged<MyInvitation>> {
    const { data, pagination } = await api.get<{ invitations: MyInvitation[] }>('/invitations/me', {
      query: { ...params },
      signal,
    });

    return { items: data.invitations, pagination: pagination! };
  },

  async accept(invitationId: string): Promise<void> {
    await api.post(`/invitations/${invitationId}/accept`);
  },

  async reject(invitationId: string): Promise<void> {
    await api.post(`/invitations/${invitationId}/reject`);
  },

  async listForCommunity(communityId: string, signal?: AbortSignal): Promise<CommunityInvitation[]> {
    const { data } = await api.get<RawInvitation[]>(`/communities/${communityId}/invitations`, { signal });

    return data.map((row) => ({
      id: row.id,
      status: row.status,
      invitedUserId: row.invited_user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  },

  async revoke(communityId: string, invitationId: string): Promise<void> {
    await api.post(`/communities/${communityId}/invitations/${invitationId}/revoke`);
  },
};
