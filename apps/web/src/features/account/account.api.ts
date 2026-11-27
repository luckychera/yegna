import { api } from '@/lib/api/client';
import type {
  AuthSession,
  CardVerification,
  IdentityDetails,
  MembershipCard,
  NotificationCategory,
  NotificationPreferences,
} from './account.types';

export const accountApi = {
  async identity(signal?: AbortSignal): Promise<IdentityDetails> {
    const { data } = await api.get<{ identity: IdentityDetails }>('/identity/me', { signal });

    return data.identity;
  },

  async sessions(signal?: AbortSignal): Promise<AuthSession[]> {
    const { data } = await api.get<{ sessions: AuthSession[] }>('/auth/sessions', { signal });

    return data.sessions;
  },

  async revokeSession(sessionId: string): Promise<void> {
    await api.post(`/auth/sessions/${sessionId}/revoke`);
  },

  async revokeOtherSessions(): Promise<number> {
    const { data } = await api.post<{ revokedCount: number }>('/auth/sessions/revoke-others');

    return data.revokedCount;
  },

  async membershipCards(signal?: AbortSignal): Promise<MembershipCard[]> {
    const { data } = await api.get<{ cards: MembershipCard[] }>('/membership-cards/me', { signal });

    return data.cards;
  },

  async regenerateCard(membershipId: string): Promise<MembershipCard> {
    const { data } = await api.post<{ card: MembershipCard }>(`/membership-cards/${membershipId}/regenerate`);

    return data.card;
  },

  async verifyCard(code: string, signal?: AbortSignal): Promise<CardVerification> {
    const { data } = await api.get<{ card: CardVerification }>(
      `/membership-cards/verify/${encodeURIComponent(code)}`,
      { signal, auth: false },
    );

    return data.card;
  },

  async notificationPreferences(signal?: AbortSignal): Promise<NotificationPreferences> {
    const { data } = await api.get<{ preferences: NotificationPreferences }>('/notifications/preferences', {
      signal,
    });

    return data.preferences;
  },

  async updateNotificationPreferences(
    inApp: Partial<Record<NotificationCategory, boolean>>,
  ): Promise<NotificationPreferences> {
    const { data } = await api.patch<{ preferences: NotificationPreferences }>('/notifications/preferences', {
      inApp,
    });

    return data.preferences;
  },
};
