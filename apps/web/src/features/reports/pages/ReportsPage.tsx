import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, ListSkeleton } from '@/components/feedback/states';
import { FilterSelect, TextField } from '@/components/ui/Field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAccess } from '@/hooks/useAccess';
import { PERMISSIONS } from '@/lib/permissions';
import {
  ContributionsPanel,
  FinancialPanel,
  MembershipPanel,
  NoReportableCommunity,
  OverviewPanel,
  PaymentsPanel,
} from '../components/ReportPanels';
import type { ReportPeriod, ReportPeriodParams } from '../report.types';

const TABS = [
  { value: 'overview', label: 'Overview', usesPeriod: false },
  { value: 'membership', label: 'Membership', usesPeriod: false },
  { value: 'contributions', label: 'Contributions', usesPeriod: true },
  { value: 'payments', label: 'Payments', usesPeriod: true },
  { value: 'financial', label: 'Financial Summary', usesPeriod: true },
] as const;

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'current', label: 'All time' },
  { value: 'month', label: 'Month to date' },
  { value: 'quarter', label: 'Quarter to date' },
  { value: 'year', label: 'Year to date' },
  { value: 'custom', label: 'Custom range' },
];

export function ReportsPage() {
  const access = useAccess();
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<ReportPeriod>('current');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (access.isLoading) return <ListSkeleton rows={3} />;
  if (access.isError) return <ErrorState error={access.error} onRetry={() => void access.refetch()} />;

  const reportable = access.communitiesWith(PERMISSIONS.REPORTS_VIEW);

  if (reportable.length === 0) return <NoReportableCommunity />;

  const communityId = reportable.find((item) => item.community.id === params.get('community'))?.community.id ?? reportable[0].community.id;
  const tab = TABS.find((item) => item.value === params.get('tab')) ?? TABS[0];
  const periodParams: ReportPeriodParams = { period, startDate: startDate || undefined, endDate: endDate || undefined };
  const rangeInvalid = period === 'custom' && Boolean(startDate && endDate && startDate > endDate);
  const effectivePeriod = rangeInvalid ? { period: 'custom' as const } : periodParams;

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params);

    Object.entries(next).forEach(([key, value]) => merged.set(key, value));
    setParams(merged, { replace: true });
  }

  return (
    <div>
      <PageHeader title="Reports" description="Figures for the communities you are allowed to report on." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-2xl lg:grid-cols-3">
        <FilterSelect label="Community" value={communityId} onChange={(event) => update({ community: event.target.value })}>
          {reportable.map((item) => (
            <option key={item.community.id} value={item.community.id}>
              {item.community.name}
            </option>
          ))}
        </FilterSelect>
        {tab.usesPeriod ? (
          <FilterSelect label="Period" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </FilterSelect>
        ) : null}
      </div>

      {tab.usesPeriod ? (
        <p className="mb-4 text-small text-ink-secondary">
          Contributions are counted by their due date and payments by the date they were made. Periods run up to today.
        </p>
      ) : null}

      {tab.usesPeriod && period === 'custom' ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-md">
          <TextField label="From" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <TextField
            label="To"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            error={rangeInvalid ? 'Must be on or after the start date.' : undefined}
          />
        </div>
      ) : null}

      <Tabs value={tab.value} onValueChange={(value) => update({ tab: value })}>
        <TabsList aria-label="Report type">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewPanel communityId={communityId} />
        </TabsContent>
        <TabsContent value="membership">
          <MembershipPanel communityId={communityId} />
        </TabsContent>
        <TabsContent value="contributions">
          <ContributionsPanel communityId={communityId} period={effectivePeriod} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsPanel communityId={communityId} period={effectivePeriod} />
        </TabsContent>
        <TabsContent value="financial">
          <FinancialPanel communityId={communityId} period={effectivePeriod} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
