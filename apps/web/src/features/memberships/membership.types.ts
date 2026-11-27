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
  roles: { id: string; name: string }[];
}

export interface AssignableRole {
  id: string;
  name: string;
  description: string;
}

export type MemberAction = 'approve' | 'reject' | 'suspend' | 'remove';
