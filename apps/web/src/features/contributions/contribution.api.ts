import { api } from '@/lib/api/client';
import type { Paged } from '@/lib/api/types';
import { fullName } from '@/lib/formatting/text';
import type {
  CommunityContribution,
  ContributionStatus,
  ContributionSummary,
  CreateContributionInput,
  MyContribution,
} from './contribution.types';

interface RawContribution {
  id: string;
  community_id: string;
  membership_id: string;
  contribution_period_start: string;
  contribution_period_end: string;
  due_date: string;
  amount: string;
  currency: string;
  status: ContributionStatus;
  paid_amount: string;
  waived_amount: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

export interface ListMyContributionsParams {
  status?: ContributionStatus;
  communityId?: string;
  dueFrom?: string;
  dueTo?: string;
  limit?: number;
  offset?: number;
}

export const contributionApi = {
  async listMine(
    params: ListMyContributionsParams,
    signal?: AbortSignal,
  ): Promise<Paged<MyContribution> & { summary: ContributionSummary[] }> {
    const { data, pagination } = await api.get<{
      contributions: MyContribution[];
      summary: ContributionSummary[];
    }>('/contributions/me', { query: { ...params }, signal });

    return { items: data.contributions, summary: data.summary, pagination: pagination! };
  },

  async listForCommunity(communityId: string, signal?: AbortSignal): Promise<CommunityContribution[]> {
    const { data } = await api.get<{ contributions: RawContribution[] }>(
      `/communities/${communityId}/contributions`,
      { signal },
    );

    return data.contributions.map((row) => ({
      id: row.id,
      communityId: row.community_id,
      membershipId: row.membership_id,
      memberName: fullName({ displayName: row.display_name, firstName: row.first_name, lastName: row.last_name }),
      periodStart: row.contribution_period_start,
      periodEnd: row.contribution_period_end,
      dueDate: row.due_date,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      paidAmount: row.paid_amount,
      waivedAmount: row.waived_amount,
    }));
  },

  async create(communityId: string, input: CreateContributionInput): Promise<void> {
    await api.post(`/communities/${communityId}/contributions`, input);
  },

  async waive(communityId: string, contributionId: string): Promise<void> {
    await api.post(`/communities/${communityId}/contributions/${contributionId}/waive`);
  },

  async cancel(communityId: string, contributionId: string): Promise<void> {
    await api.post(`/communities/${communityId}/contributions/${contributionId}/cancel`);
  },
};
