/** Central place for TanStack Query keys, so invalidation is predictable. */
export const queryKeys = {
  me: ['me'] as const,
  myCommunities: (params?: object) => ['communities', 'mine', params ?? {}] as const,
  communities: (params?: object) => ['communities', 'list', params ?? {}] as const,
  members: (communityId: string) => ['communities', communityId, 'members'] as const,
  communityContributions: (communityId: string) => ['communities', communityId, 'contributions'] as const,
  communityPayments: (communityId: string) => ['communities', communityId, 'payments'] as const,
  communityInvitations: (communityId: string) => ['communities', communityId, 'invitations'] as const,
  myInvitations: (params?: object) => ['invitations', 'mine', params ?? {}] as const,
  myContributions: (params?: object) => ['contributions', 'mine', params ?? {}] as const,
  myPayments: (params?: object) => ['payments', 'mine', params ?? {}] as const,
  notifications: (params?: object) => ['notifications', 'list', params ?? {}] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  report: (type: string, communityId: string, params?: object) =>
    ['reports', type, communityId, params ?? {}] as const,
};
