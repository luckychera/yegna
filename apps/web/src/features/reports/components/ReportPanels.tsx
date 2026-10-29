import { Banknote, HandCoins, Landmark, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import { StatCard } from '@/components/data-display/StatCard';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatMoney, toNumber } from '@/lib/formatting/money';
import { humanize } from '@/lib/formatting/text';
import {
  useContributionReport,
  useFinancialReport,
  useMembershipReport,
  useOverviewReport,
  usePaymentReport,
} from '../report.hooks';
import type { ContributionStats, PaymentStats, ReportPeriodParams } from '../report.types';
import { CHART_COLORS, type ChartDatum } from './chart-colors';
import { BreakdownLegend, StatusBarChart, StatusPieChart } from './Charts';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartWithLegend({ title, label, data, kind, format }: { title: string; label: string; data: ChartDatum[]; kind: 'bar' | 'pie'; format?: (value: number) => string }) {
  const hasData = data.some((item) => item.value > 0);

  return (
    <Section title={title}>
      {hasData ? (
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-center">
          {kind === 'bar' ? <StatusBarChart data={data} label={label} /> : <StatusPieChart data={data} label={label} />}
          <BreakdownLegend data={data} format={format} />
        </div>
      ) : (
        <p className="py-8 text-center text-body text-ink-secondary">Nothing to chart for this period yet.</p>
      )}
    </Section>
  );
}

function contributionData(stats: ContributionStats): ChartDatum[] {
  return [
    { name: 'Paid', value: stats.paid_contributions, color: CHART_COLORS.success },
    { name: 'Pending', value: stats.pending_contributions, color: CHART_COLORS.warning },
    { name: 'Overdue', value: stats.overdue_contributions, color: CHART_COLORS.danger },
    { name: 'Waived', value: stats.waived_contributions, color: CHART_COLORS.info },
    { name: 'Cancelled', value: stats.cancelled_contributions, color: CHART_COLORS.muted },
  ];
}

function paymentData(stats: PaymentStats): ChartDatum[] {
  return [
    { name: 'Successful', value: stats.successful_payments, color: CHART_COLORS.success },
    { name: 'Pending', value: stats.pending_payments + stats.processing_payments, color: CHART_COLORS.warning },
    { name: 'Failed', value: stats.failed_payments, color: CHART_COLORS.danger },
    { name: 'Refunded', value: stats.refunded_payments, color: CHART_COLORS.info },
    { name: 'Cancelled', value: stats.cancelled_payments, color: CHART_COLORS.muted },
  ];
}

function collectedPercent(stats: ContributionStats): number {
  const expected = toNumber(stats.total_expected);

  return expected > 0 ? Math.min(100, Math.round((toNumber(stats.total_paid) / expected) * 100)) : 0;
}

function ContributionStatCards({ stats }: { stats: ContributionStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Contributions" icon={HandCoins} value={String(stats.total_contributions)} />
      <StatCard label="Expected" icon={Landmark} tone="info" value={formatMoney(stats.total_expected)} />
      <StatCard label="Collected" icon={Banknote} tone="success" value={formatMoney(stats.total_paid)} hint={`${collectedPercent(stats)}% of expected`} />
      <StatCard label="Outstanding" icon={HandCoins} tone="warning" value={formatMoney(stats.total_outstanding)} />
    </div>
  );
}

function PaymentStatCards({ stats }: { stats: PaymentStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <StatCard label="Payments" icon={Banknote} value={String(stats.total_payments)} />
      <StatCard label="Successful amount" icon={Banknote} tone="success" value={formatMoney(stats.successful_amount)} />
      <StatCard label="Refunded amount" icon={Banknote} tone="info" value={formatMoney(stats.refunded_amount)} />
    </div>
  );
}

export function OverviewPanel({ communityId }: { communityId: string }) {
  const query = useOverviewReport(communityId);

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { memberships, contributions, payments } = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" icon={Users} value={String(memberships.total_memberships)} hint={`${memberships.active_memberships} active`} />
        <StatCard label="Expected" icon={Landmark} tone="info" value={formatMoney(contributions.total_expected)} />
        <StatCard label="Collected" icon={Banknote} tone="success" value={formatMoney(contributions.total_paid)} />
        <StatCard label="Successful payments" icon={Banknote} tone="success" value={formatMoney(payments.successful_payment_amount)} hint={`${payments.total_payments} payments`} />
      </div>
      <ChartWithLegend
        title="Members by status"
        label="Bar chart of members by status"
        kind="bar"
        data={[
          { name: 'Active', value: memberships.active_memberships, color: CHART_COLORS.success },
          { name: 'Pending', value: memberships.pending_memberships, color: CHART_COLORS.warning },
          { name: 'Suspended', value: memberships.suspended_memberships, color: CHART_COLORS.danger },
          { name: 'Left', value: memberships.left_memberships, color: CHART_COLORS.muted },
        ]}
      />
    </div>
  );
}

export function MembershipPanel({ communityId }: { communityId: string }) {
  const query = useMembershipReport(communityId);

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { summary, roles } = query.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" icon={Users} value={String(summary.total_members)} />
        <StatCard label="Active" icon={Users} tone="success" value={String(summary.active_members)} />
        <StatCard label="Pending" icon={Users} tone="warning" value={String(summary.pending_members)} />
        <StatCard label="Suspended" icon={Users} tone="danger" value={String(summary.suspended_members)} />
      </div>
      <ChartWithLegend
        title="Members by status"
        label="Bar chart of members by status"
        kind="bar"
        data={[
          { name: 'Active', value: summary.active_members, color: CHART_COLORS.success },
          { name: 'Pending', value: summary.pending_members, color: CHART_COLORS.warning },
          { name: 'Suspended', value: summary.suspended_members, color: CHART_COLORS.danger },
          { name: 'Left', value: summary.left_members, color: CHART_COLORS.muted },
        ]}
      />
      <Section title="Members by role">
        {roles.length === 0 ? (
          <p className="text-body text-ink-secondary">No roles have been assigned yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {roles.map((role) => (
              <li key={role.role_id} className="flex justify-between py-2 text-body">
                <span className="text-ink-secondary">{humanize(role.role_name)}</span>
                <span className="font-semibold text-ink">{role.member_count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function ContributionsPanel({ communityId, period }: { communityId: string; period: ReportPeriodParams }) {
  const query = useContributionReport(communityId, period);

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      <ContributionStatCards stats={query.data.summary} />
      <ChartWithLegend title="Contributions by status" label="Chart of contributions by status" kind="pie" data={contributionData(query.data.summary)} />
    </div>
  );
}

export function PaymentsPanel({ communityId, period }: { communityId: string; period: ReportPeriodParams }) {
  const query = usePaymentReport(communityId, period);

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="space-y-4">
      <PaymentStatCards stats={query.data.summary} />
      <ChartWithLegend title="Payments by status" label="Bar chart of payments by status" kind="bar" data={paymentData(query.data.summary)} />
    </div>
  );
}

export function FinancialPanel({ communityId, period }: { communityId: string; period: ReportPeriodParams }) {
  const query = useFinancialReport(communityId, period);

  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const { contributions, payments, ledger } = query.data;
  const expected = toNumber(contributions.total_expected);
  const paid = toNumber(contributions.total_paid);
  const outstanding = toNumber(contributions.total_outstanding);

  return (
    <div className="space-y-4">
      <ContributionStatCards stats={contributions} />
      <PaymentStatCards stats={payments} />
      <ChartWithLegend
        title="Expected, collected and outstanding"
        label="Bar chart comparing expected, collected and outstanding amounts"
        kind="bar"
        format={(value) => formatMoney(value)}
        data={[
          { name: 'Expected', value: expected, color: CHART_COLORS.info },
          { name: 'Collected', value: paid, color: CHART_COLORS.success },
          { name: 'Outstanding', value: outstanding, color: CHART_COLORS.warning },
        ]}
      />
      <Section title="Ledger">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-small text-ink-secondary">Entries</dt>
            <dd className="text-h3 font-bold text-ink">{ledger.total_ledger_entries}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-secondary">Total credits</dt>
            <dd className="text-h3 font-bold text-ink">{formatMoney(ledger.total_credits)}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-secondary">Total debits</dt>
            <dd className="text-h3 font-bold text-ink">{formatMoney(ledger.total_debits)}</dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}

export function NoReportableCommunity() {
  return <EmptyState title="No reports available" description="Reports are available to community members with permission to view them." />;
}
