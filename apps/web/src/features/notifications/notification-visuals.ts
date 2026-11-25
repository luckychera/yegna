import {
  Bell,
  BadgeCheck,
  Ban,
  CircleCheck,
  CircleX,
  HandCoins,
  Mail,
  Megaphone,
  TriangleAlert,
  Undo2,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';

import type { Tone } from '@/components/ui/Badge';

export interface NotificationVisual {
  icon: LucideIcon;
  tone: Tone;
}

const VISUALS: Record<string, NotificationVisual> = {
  invitation_received: { icon: Mail, tone: 'info' },
  invitation_accepted: { icon: CircleCheck, tone: 'success' },
  invitation_rejected: { icon: CircleX, tone: 'danger' },
  membership_approved: { icon: BadgeCheck, tone: 'success' },
  membership_suspended: { icon: Ban, tone: 'danger' },
  membership_removed: { icon: UserMinus, tone: 'danger' },
  contribution_created: { icon: HandCoins, tone: 'info' },
  contribution_due: { icon: HandCoins, tone: 'warning' },
  contribution_overdue: { icon: TriangleAlert, tone: 'danger' },
  payment_successful: { icon: CircleCheck, tone: 'success' },
  payment_failed: { icon: CircleX, tone: 'danger' },
  payment_refunded: { icon: Undo2, tone: 'info' },
  community_announcement: { icon: Megaphone, tone: 'info' },
  system: { icon: Bell, tone: 'neutral' },
};

export function notificationVisual(type: string): NotificationVisual {
  return VISUALS[type] ?? { icon: Bell, tone: 'neutral' };
}

/** Where tapping a notification should lead, derived from its type. */
export function notificationTarget(type: string, communityId: string | null): string | null {
  if (type.startsWith('invitation')) return '/invitations';
  if (type.startsWith('membership')) return '/memberships';
  if (type.startsWith('contribution')) return '/contributions';
  if (type.startsWith('payment')) return '/payments';
  if (type === 'community_announcement' && communityId) return `/communities/${communityId}`;

  return null;
}
