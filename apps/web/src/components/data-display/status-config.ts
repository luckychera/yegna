import {
  Ban,
  BadgeCheck,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  LogOut,
  RefreshCw,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

import type { Tone } from '@/components/ui/Badge';

export interface StatusStyle {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

export type StatusKind = 'membership' | 'contribution' | 'payment' | 'invitation' | 'community';

/** Every backend status maps to one label, tone and icon, defined once. */
export const STATUS_STYLES: Record<StatusKind, Record<string, StatusStyle>> = {
  membership: {
    active: { label: 'Active', tone: 'success', icon: CircleCheck },
    pending: { label: 'Pending', tone: 'warning', icon: Clock },
    suspended: { label: 'Suspended', tone: 'danger', icon: Ban },
    rejected: { label: 'Rejected', tone: 'danger', icon: CircleX },
    left: { label: 'Left', tone: 'neutral', icon: LogOut },
  },
  contribution: {
    paid: { label: 'Paid', tone: 'success', icon: CircleCheck },
    pending: { label: 'Pending', tone: 'warning', icon: Clock },
    partially_paid: { label: 'Partially paid', tone: 'info', icon: CircleDot },
    overdue: { label: 'Overdue', tone: 'danger', icon: TriangleAlert },
    waived: { label: 'Waived', tone: 'info', icon: BadgeCheck },
    cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  },
  payment: {
    successful: { label: 'Successful', tone: 'success', icon: CircleCheck },
    pending: { label: 'Pending', tone: 'warning', icon: Clock },
    processing: { label: 'Processing', tone: 'info', icon: RefreshCw },
    failed: { label: 'Failed', tone: 'danger', icon: CircleX },
    cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
    refunded: { label: 'Refunded', tone: 'info', icon: Undo2 },
  },
  invitation: {
    pending: { label: 'Pending', tone: 'warning', icon: Clock },
    accepted: { label: 'Accepted', tone: 'success', icon: CircleCheck },
    rejected: { label: 'Rejected', tone: 'danger', icon: CircleX },
    revoked: { label: 'Revoked', tone: 'neutral', icon: Ban },
    expired: { label: 'Expired', tone: 'neutral', icon: Clock },
  },
  community: {
    active: { label: 'Active', tone: 'success', icon: CircleCheck },
    suspended: { label: 'Suspended', tone: 'danger', icon: Ban },
  },
};

export function statusStyle(kind: StatusKind, status: string): StatusStyle {
  return (
    STATUS_STYLES[kind][status] ?? {
      label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
      tone: 'neutral',
      icon: CircleDot,
    }
  );
}

/** Unpaid contributions past their due date read as "overdue" even if still stored as pending. */
export function contributionDisplayStatus(contribution: { status: string; isOverdue?: boolean }): string {
  return contribution.isOverdue && ['pending', 'partially_paid'].includes(contribution.status)
    ? 'overdue'
    : contribution.status;
}
