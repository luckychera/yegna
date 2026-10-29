import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/api/query-keys';
import { reportApi } from './report.api';
import type { ReportPeriodParams } from './report.types';

/** A custom range is only queried once both dates are chosen. */
function periodReady(period: ReportPeriodParams): boolean {
  return period.period !== 'custom' || Boolean(period.startDate && period.endDate);
}

export function useOverviewReport(communityId: string) {
  return useQuery({
    queryKey: queryKeys.report('overview', communityId),
    queryFn: ({ signal }) => reportApi.overview(communityId, signal),
    enabled: Boolean(communityId),
  });
}

export function useMembershipReport(communityId: string) {
  return useQuery({
    queryKey: queryKeys.report('membership', communityId),
    queryFn: ({ signal }) => reportApi.membership(communityId, signal),
    enabled: Boolean(communityId),
  });
}

export function useContributionReport(communityId: string, period: ReportPeriodParams) {
  return useQuery({
    queryKey: queryKeys.report('contributions', communityId, period),
    queryFn: ({ signal }) => reportApi.contributions(communityId, period, signal),
    enabled: Boolean(communityId) && periodReady(period),
  });
}

export function usePaymentReport(communityId: string, period: ReportPeriodParams) {
  return useQuery({
    queryKey: queryKeys.report('payments', communityId, period),
    queryFn: ({ signal }) => reportApi.payments(communityId, period, signal),
    enabled: Boolean(communityId) && periodReady(period),
  });
}

export function useFinancialReport(communityId: string, period: ReportPeriodParams) {
  return useQuery({
    queryKey: queryKeys.report('financial', communityId, period),
    queryFn: ({ signal }) => reportApi.financialSummary(communityId, period, signal),
    enabled: Boolean(communityId) && periodReady(period),
  });
}
