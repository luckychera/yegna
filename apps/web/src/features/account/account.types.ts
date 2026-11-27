import type { CommunityType } from '@/features/communities/community.types';
import type { FaydaVerificationStatus } from '@/features/auth/auth.types';

/** GET /identity/me. Never contains any part of the Fayda number. */
export interface IdentityDetails {
  id: string;
  provider: string;
  verificationStatus: FaydaVerificationStatus;
  verifiedAt: string | null;
  identifierType: 'FIN' | 'FAN' | null;
  /** 'mock' = checked against the development provider, not the government service. */
  verificationMode: 'mock' | 'live' | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}

export interface MembershipCard {
  membershipId: string;
  membershipNumber: string | null;
  status: 'active';
  joinedAt: string | null;
  issuedAt: string | null;
  /** Private: anyone holding it can confirm this membership. */
  verificationCode: string | null;
  roles: string[];
  community: {
    id: string;
    name: string;
    communityType: CommunityType;
    logoUrl: string | null;
  };
  holder: {
    name: string;
    avatarUrl: string | null;
  };
}

/** GET /membership-cards/verify/:code (public). */
export interface CardVerification {
  valid: boolean;
  status: string;
  community: {
    name: string;
    communityType: CommunityType;
    logoUrl: string | null;
  };
  membershipNumber?: string | null;
  holderName?: string;
  holderAvatarUrl?: string | null;
  memberSince?: string | null;
  checkedAt: string;
}

export const NOTIFICATION_CATEGORIES = [
  'announcements',
  'contributions',
  'payments',
  'memberships',
  'invitations',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationPreferences {
  inApp: Record<NotificationCategory, boolean>;
  updatedAt: string | null;
}
