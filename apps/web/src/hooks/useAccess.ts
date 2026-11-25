import { useMemo } from 'react';

import { useMyCommunities } from '@/features/communities/community.hooks';
import type { MyCommunity } from '@/features/communities/community.types';
import type { Permission } from '@/lib/permissions';

/**
 * What the signed-in user may do, straight from the backend's permission strings.
 * This only decides what to SHOW; the API still enforces every rule.
 */
export function useAccess() {
  const query = useMyCommunities({ status: 'active', limit: 100 });

  return useMemo(() => {
    const memberships: MyCommunity[] = query.data?.items ?? [];

    return {
      isLoading: query.isPending,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
      memberships,
      can: (permission: Permission, communityId: string): boolean =>
        memberships.some((item) => item.community.id === communityId && item.permissions.includes(permission)),
      hasAny: (permission: Permission): boolean => memberships.some((item) => item.permissions.includes(permission)),
      communitiesWith: (permission: Permission): MyCommunity[] =>
        memberships.filter((item) => item.permissions.includes(permission)),
    };
  }, [query.data, query.isPending, query.isError, query.error, query.refetch]);
}
