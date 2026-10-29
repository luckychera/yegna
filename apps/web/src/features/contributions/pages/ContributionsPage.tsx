import { HandCoins, Plus } from 'lucide-react';
import { useState } from 'react';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatCard } from '@/components/data-display/StatCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { contributionDisplayStatus } from '@/components/data-display/status-config';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { FilterSelect, TextField } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useAccess } from '@/hooks/useAccess';
import { formatDateOnly, formatDueLabel } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { pickSummary } from '@/lib/formatting/summary';
import { PERMISSIONS } from '@/lib/permissions';
import { CreateContributionDialog } from '../components/CreateContributionDialog';
import { PayDialog } from '../components/PayDialog';
import { useMyContributions } from '../contribution.hooks';
import { isPayable, type ContributionStatus, type MyContribution } from '../contribution.types';

const PAGE_SIZE = 10;
const STATUSES: { value: ContributionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waived', label: 'Waived' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function ContributionsPage() {
  const access = useAccess();
  const [status, setStatus] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [paying, setPaying] = useState<MyContribution | null>(null);
  const [creating, setCreating] = useState(false);

  const rangeInvalid = Boolean(dueFrom && dueTo && dueFrom > dueTo);
  const query = useMyContributions({
    status: (status || undefined) as ContributionStatus | undefined,
    communityId: communityId || undefined,
    dueFrom: dueFrom && !rangeInvalid ? dueFrom : undefined,
    dueTo: dueTo && !rangeInvalid ? dueTo : undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const summary = pickSummary(query.data?.summary);
  const currency = summary?.currency ?? 'ETB';
  const filtering = Boolean(status || communityId || dueFrom || dueTo);

  // Creating contributions is an administrator action: only offered where the backend allows it.
  const creatable = access.communitiesWith(PERMISSIONS.CONTRIBUTIONS_CREATE).map((item) => ({
    id: item.community.id,
    name: item.community.name,
    canViewMembers: item.permissions.includes(PERMISSIONS.MEMBERS_VIEW),
  }));

  function reset(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setOffset(0);
    };
  }

  const columns: Column<MyContribution>[] = [
    {
      key: 'due',
      header: 'Due date',
      primary: true,
      cell: (row) => (
        <span>
          <span className="block font-medium">{formatDateOnly(row.dueDate)}</span>
          {isPayable(row) ? <span className="block text-small text-ink-secondary">{formatDueLabel(row.dueDate)}</span> : null}
        </span>
      ),
    },
    { key: 'community', header: 'Community', cell: (row) => row.community.name },
    { key: 'period', header: 'Period', hideOnMobile: true, cell: (row) => `${formatDateOnly(row.periodStart)} – ${formatDateOnly(row.periodEnd)}` },
    { key: 'amount', header: 'Amount', cell: (row) => <span className="font-semibold">{formatMoney(row.amount, row.currency)}</span> },
    { key: 'outstanding', header: 'Still due', cell: (row) => formatMoney(row.outstandingAmount, row.currency) },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="contribution" status={contributionDisplayStatus(row)} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      className: 'text-right',
      cell: (row) =>
        isPayable(row) ? (
          <Button size="sm" onClick={() => setPaying(row)} aria-label={`Pay ${row.community.name} contribution due ${formatDateOnly(row.dueDate)}`}>
            Pay
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contributions"
        description="What you owe and what you've paid across your communities."
        actions={
          creatable.length > 0 ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              New Contribution
            </Button>
          ) : null
        }
      />

      <section aria-label="Contribution summary" className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Paid" icon={HandCoins} tone="success" value={formatMoney(summary?.paidAmount ?? 0, currency)} loading={query.isPending} />
        <StatCard label="Still due" icon={HandCoins} tone="warning" value={formatMoney(summary?.outstandingAmount ?? 0, currency)} hint={`${summary?.pendingCount ?? 0} pending`} loading={query.isPending} />
        <StatCard label="Overdue" icon={HandCoins} tone="danger" value={String(summary?.overdueCount ?? 0)} hint="Contributions past due" loading={query.isPending} />
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Filter by status" value={status} onChange={(event) => reset(setStatus)(event.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filter by community" value={communityId} onChange={(event) => reset(setCommunityId)(event.target.value)}>
          <option value="">All communities</option>
          {access.memberships.map((item) => (
            <option key={item.community.id} value={item.community.id}>
              {item.community.name}
            </option>
          ))}
        </FilterSelect>
        <TextField label="Due from" type="date" value={dueFrom} onChange={(event) => reset(setDueFrom)(event.target.value)} />
        <TextField
          label="Due to"
          type="date"
          value={dueTo}
          onChange={(event) => reset(setDueTo)(event.target.value)}
          error={rangeInvalid ? 'Must be after the start date.' : undefined}
        />
      </div>

      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.items.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-6 w-6" aria-hidden />}
          title={filtering ? 'No contributions match your filters' : 'No contributions yet'}
          description={
            filtering
              ? 'Try a different status, community or date range.'
              : 'When a community administrator creates a contribution for you, it will appear here.'
          }
          action={
            filtering ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('');
                  setCommunityId('');
                  setDueFrom('');
                  setDueTo('');
                  setOffset(0);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {query.isSuccess && query.data.items.length > 0 ? (
        <>
          <DataTable caption="My contributions" columns={columns} rows={query.data.items} getRowKey={(row) => row.id} />
          <Pagination limit={PAGE_SIZE} offset={offset} total={query.data.pagination.total ?? 0} onChange={setOffset} />
        </>
      ) : null}

      <PayDialog contribution={paying} onOpenChange={(open) => !open && setPaying(null)} />
      <CreateContributionDialog open={creating} onOpenChange={setCreating} communities={creatable} />
    </div>
  );
}
