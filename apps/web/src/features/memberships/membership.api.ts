import { api } from '@/lib/api/client';
import { fullName } from '@/lib/formatting/text';
import type { MembershipStatus } from '@/features/communities/community.types';
import type { Member, MemberAction } from './membership.types';

interface RawMember {
  id: string;
  community_id: string;
  user_id: string;
  status: MembershipStatus;
  membership_number: string | null;
  joined_at: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

function mapMember(row: RawMember): Member {
  return {
    id: row.id,
    communityId: row.community_id,
    userId: row.user_id,
    status: row.status,
    membershipNumber: row.membership_number,
    joinedAt: row.joined_at,
    createdAt: row.created_at,
    name: fullName({ displayName: row.display_name, firstName: row.first_name, lastName: row.last_name }),
    email: row.email,
    phone: row.phone,
  };
}

export const membershipApi = {
  async list(communityId: string, signal?: AbortSignal): Promise<Member[]> {
    const { data } = await api.get<{ members: RawMember[] }>(`/communities/${communityId}/members`, { signal });

    return data.members.map(mapMember);
  },

  async act(communityId: string, membershipId: string, action: MemberAction): Promise<void> {
    await api.post(`/communities/${communityId}/members/${membershipId}/${action}`);
  },
};
