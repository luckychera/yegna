import type { MembershipStatus } from '@/features/communities/community.types';

export interface Member {
  id: string;
  communityId: string;
  userId: string;
  status: MembershipStatus;
  membershipNumber: string | null;
  joinedAt: string | null;
  createdAt: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export type MemberAction = 'approve' | 'reject' | 'suspend' | 'remove';
