export const COMMUNITY_TYPES = [
  'equb',
  'edir',
  'mahiber',
  'association',
  'neighborhood',
  'youth_group',
  'religious',
  'social',
  'professional',
  'other',
] as const;

export type CommunityType = (typeof COMMUNITY_TYPES)[number];

export const COMMUNITY_TYPE_LABELS: Record<CommunityType, string> = {
  equb: 'Equb',
  edir: 'Edir',
  mahiber: 'Mahiber',
  association: 'Association',
  neighborhood: 'Neighborhood',
  youth_group: 'Youth group',
  religious: 'Religious',
  social: 'Social',
  professional: 'Professional',
  other: 'Other',
};

export function communityTypeLabel(type: string): string {
  return COMMUNITY_TYPE_LABELS[type as CommunityType] ?? type;
}

export type MembershipStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'left';

export interface CommunitySummary {
  id: string;
  name: string;
  description: string | null;
  communityType: string;
  status: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  createdAt: string;
}

/** An item of the browsable directory (GET /communities). */
export interface CommunityListItem extends CommunitySummary {
  myMembership: { id: string; status: MembershipStatus } | null;
}

export interface MyCommunity {
  community: CommunitySummary;
  membership: {
    id: string;
    status: MembershipStatus;
    membershipNumber: string | null;
    joinedAt: string | null;
  };
  roles: { id: string; name: string; assignedAt: string }[];
  /** Backend permission strings: the only thing the UI uses to decide what to show. */
  permissions: string[];
}

/** Full community record (GET /communities/:id), available to members with community.view. */
export interface CommunityDetails {
  id: string;
  name: string;
  description: string | null;
  communityType: string;
  status: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityInput {
  name: string;
  description?: string;
  communityType: CommunityType;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface SelfMembership {
  id: string;
  communityId: string;
  status: MembershipStatus;
  membershipNumber: string | null;
  joinedAt: string | null;
  approvedAt: string | null;
  leftAt: string | null;
  createdAt: string;
}
