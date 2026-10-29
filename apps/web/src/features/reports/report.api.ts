import { api } from '@/lib/api/client';
import type {
  CommunityOverviewReport,
  ContributionReport,
  FinancialSummaryReport,
  MembershipReport,
  PaymentReport,
  ReportPeriodParams,
} from './report.types';

function periodQuery(params: ReportPeriodParams) {
  return {
    period: params.period,
    startDate: params.period === 'custom' ? params.startDate : undefined,
    endDate: params.period === 'custom' ? params.endDate : undefined,
  };
}

export const reportApi = {
  async overview(communityId: string, signal?: AbortSignal): Promise<CommunityOverviewReport> {
    return (await api.get<CommunityOverviewReport>(`/reports/community/${communityId}`, { signal })).data;
  },

  async membership(communityId: string, signal?: AbortSignal): Promise<MembershipReport> {
    return (await api.get<MembershipReport>(`/reports/membership/${communityId}`, { signal })).data;
  },

  async contributions(
    communityId: string,
    params: ReportPeriodParams,
    signal?: AbortSignal,
  ): Promise<ContributionReport> {
    return (
      await api.get<ContributionReport>(`/reports/contributions/${communityId}`, {
        query: periodQuery(params),
        signal,
      })
    ).data;
  },

  async payments(communityId: string, params: ReportPeriodParams, signal?: AbortSignal): Promise<PaymentReport> {
    return (
      await api.get<PaymentReport>(`/reports/payments/${communityId}`, { query: periodQuery(params), signal })
    ).data;
  },

  async financialSummary(
    communityId: string,
    params: ReportPeriodParams,
    signal?: AbortSignal,
  ): Promise<FinancialSummaryReport> {
    return (
      await api.get<FinancialSummaryReport>(`/reports/financial-summary/${communityId}`, {
        query: periodQuery(params),
        signal,
      })
    ).data;
  },
};
