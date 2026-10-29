import { api } from '@/lib/api/client';
import type { Paged } from '@/lib/api/types';
import type {
  CommunityDetails,
  CommunityInput,
  CommunityListItem,
  MembershipStatus,
  MyCommunity,
  SelfMembership,
} from './community.types';

interface RawCommunity {
  id: string;
  name: string;
  description: string | null;
  community_type: string;
  status: string;
  logo_url: string | null;
  banner_url: string | null;
  created_at: string;
  updated_at: string;
}

function mapCommunity(row: RawCommunity): CommunityDetails {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    communityType: row.community_type,
    status: row.status,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListCommunitiesParams {
  q?: string;
  type?: string;
  sort?: 'newest' | 'popular' | 'name';
  limit?: number;
  offset?: number;
}

export const communityApi = {
  async list(params: ListCommunitiesParams, signal?: AbortSignal): Promise<Paged<CommunityListItem>> {
    const { data, pagination } = await api.get<{ communities: CommunityListItem[] }>('/communities', {
      query: { ...params },
      signal,
    });

    return { items: data.communities, pagination: pagination! };
  },

  async listMine(
    params: { status?: MembershipStatus; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<Paged<MyCommunity>> {
    const { data, pagination } = await api.get<{ memberships: MyCommunity[] }>('/communities/me', {
      query: { ...params },
      signal,
    });

    return { items: data.memberships, pagination: pagination! };
  },

  async create(input: CommunityInput): Promise<CommunityDetails> {
    const { data } = await api.post<{ community: RawCommunity }>('/communities', input);

    return mapCommunity(data.community);
  },

  async update(communityId: string, input: Partial<CommunityInput>): Promise<CommunityDetails> {
    const { data } = await api.patch<{ community: RawCommunity }>(`/communities/${communityId}`, input);

    return mapCommunity(data.community);
  },

  async join(communityId: string): Promise<{ membership: SelfMembership; message: string }> {
    const { data, message } = await api.post<{ membership: SelfMembership }>(`/communities/${communityId}/join`);

    return { membership: data.membership, message: message ?? 'Request submitted' };
  },

  async leave(communityId: string): Promise<SelfMembership> {
    const { data } = await api.post<{ membership: SelfMembership }>(`/communities/${communityId}/leave`);

    return data.membership;
  },
};
