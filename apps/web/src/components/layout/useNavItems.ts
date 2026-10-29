import { useMemo } from 'react';

import { usePendingInvitationCount } from '@/features/invitations/invitation.hooks';
import { useUnreadCount } from '@/features/notifications/notification.hooks';
import { useAccess } from '@/hooks/useAccess';
import { PERMISSIONS } from '@/lib/permissions';
import { NAV_ITEMS, type NavItem } from './nav-items';

export interface ResolvedNavItem extends NavItem {
  badgeCount: number;
}

export function useNavItems(): ResolvedNavItem[] {
  const access = useAccess();
  const unread = useUnreadCount().data ?? 0;
  const pendingInvitations = usePendingInvitationCount();
  const canSeeReports = access.hasAny(PERMISSIONS.REPORTS_VIEW);

  return useMemo(
    () =>
      NAV_ITEMS.filter((item) => item.gate !== 'reports' || canSeeReports).map((item) => ({
        ...item,
        badgeCount: item.badge === 'notifications' ? unread : item.badge === 'invitations' ? pendingInvitations : 0,
      })),
    [canSeeReports, unread, pendingInvitations],
  );
}
