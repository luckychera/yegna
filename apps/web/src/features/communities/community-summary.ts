import { useCommunityDirectory, useMyCommunities } from './community.hooks';
import type { CommunitySummary, MembershipStatus, MyCommunity } from './community.types';

export interface CommunityInfo {
  community: CommunitySummary | null;
  membership: { id: string; status: MembershipStatus } | null;
  /** Backend permission strings for this community (empty unless the membership is active). */
  permissions: string[];
  roles: MyCommunity['roles'];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
}

/**
 * Resolves what the signed-in user can see about one community, using only endpoints open to
 * every member. GET /communities/:id needs a permission that ordinary members do not have,
 * so the summary comes from "my communities", then the public directory, then a hint passed
 * through router state from the card the user clicked.
 */
export function useCommunityInfo(communityId: string, hint?: CommunitySummary | null): CommunityInfo {
  const mine = useMyCommunities({ limit: 100 });
  const mineItem = mine.data?.items.find((item) => item.community.id === communityId);
  const needDirectory = mine.isSuccess && !mineItem && !hint;
  const directory = useCommunityDirectory({ limit: 100, sort: 'name' }, needDirectory);
  const directoryItem = directory.data?.items.find((item) => item.id === communityId);

  const community = mineItem?.community ?? directoryItem ?? hint ?? null;
  const membership = mineItem
    ? { id: mineItem.membership.id, status: mineItem.membership.status }
    : (directoryItem?.myMembership ?? null);

  const isPending = !community && (mine.isPending || (needDirectory && directory.isPending));
  const failed = mine.isError || (needDirectory && directory.isError);

  return {
    community,
    membership,
    permissions: mineItem?.permissions ?? [],
    roles: mineItem?.roles ?? [],
    isPending,
    isError: !community && failed,
    error: mine.error ?? directory.error,
    retry: () => {
      void mine.refetch();
      if (needDirectory) void directory.refetch();
    },
  };
}
