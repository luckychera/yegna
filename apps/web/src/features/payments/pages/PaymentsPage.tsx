import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatCard } from '@/components/data-display/StatCard';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { FilterSelect } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useAccess } from '@/hooks/useAccess';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDateOnly, formatDateTime } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { pickSummary } from '@/lib/formatting/summary';
import { humanize } from '@/lib/formatting/text';
import { redirectTo } from '@/lib/navigation';
import { paymentReference } from '../payment-reference';
import { useMyPayments, useVerifyPayment } from '../payment.hooks';
import type { MyPayment, PaymentStatus } from '../payment.types';

const PAGE_SIZE = 10;
const STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'successful', label: 'Successful' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

export function PaymentsPage() {
  const access = useAccess();
  const verify = useVerifyPayment();
  const [status, setStatus] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [offset, setOffset] = useState(0);
  const [checking, setChecking] = useState<string | null>(null);

  const query = useMyPayments({
    status: (status || undefined) as PaymentStatus | undefined,
    communityId: communityId || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const summary = pickSummary(query.data?.summary);
  const currency = summary?.currency ?? 'ETB';
  const filtering = Boolean(status || communityId);

  async function checkStatus(payment: MyPayment) {
    setChecking(payment.id);

    try {
      const { outcome } = await verify.mutateAsync(payment.id);

      if (outcome === 'successful') toast.success('Payment confirmed');
      else if (outcome === 'failed' || outcome === 'cancelled') toast.error('This payment did not go through');
      else toast.info('Still waiting for confirmation from the payment provider');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setChecking(null);
    }
  }

  const columns: Column<MyPayment>[] = [
    { key: 'date', header: 'Date', primary: true, cell: (row) => <span className="font-medium">{formatDateTime(row.initiatedAt)}</span> },
    { key: 'community', header: 'Community', cell: (row) => row.community.name },
    {
      key: 'contribution',
      header: 'Contribution',
      hideOnMobile: true,
      cell: (row) =>
        row.contribution ? `${formatDateOnly(row.contribution.periodStart)} – ${formatDateOnly(row.contribution.periodEnd)}` : '—',
    },
    { key: 'amount', header: 'Amount', cell: (row) => <span className="font-semibold">{formatMoney(row.amount, row.currency)}</span> },
    { key: 'method', header: 'Method', hideOnMobile: true, cell: (row) => (row.paymentMethod ? humanize(row.paymentMethod) : '—') },
    { key: 'reference', header: 'Reference', cell: (row) => <span className="font-mono text-small break-all">{paymentReference(row)}</span> },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="payment" status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      className: 'text-right',
      cell: (row) =>
        row.status === 'pending' || row.status === 'processing' ? (
          <span className="flex flex-wrap justify-end gap-2">
            {row.checkoutUrl ? (
              <Button size="sm" onClick={() => redirectTo(row.checkoutUrl!)} aria-label={`Complete payment of ${formatMoney(row.amount, row.currency)}`}>
                Complete payment
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              loading={checking === row.id}
              onClick={() => void checkStatus(row)}
              aria-label={`Check status of payment ${paymentReference(row)}`}
            >
              Check status
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Your payment history across communities."
        actions={
          <Link to="/contributions" className={buttonVariants({})}>
            Make a payment
          </Link>
        }
      />

      <section aria-label="Payment summary" className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Paid" icon={CreditCard} tone="success" value={formatMoney(summary?.totalPaid ?? 0, currency)} loading={query.isPending} />
        <StatCard label="This Month" icon={CreditCard} tone="info" value={formatMoney(summary?.paidThisMonth ?? 0, currency)} loading={query.isPending} />
        <StatCard label="Pending" icon={CreditCard} tone="warning" value={formatMoney(summary?.pendingAmount ?? 0, currency)} hint="Awaiting confirmation" loading={query.isPending} />
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filter by community"
          value={communityId}
          onChange={(event) => {
            setCommunityId(event.target.value);
            setOffset(0);
          }}
        >
          <option value="">All communities</option>
          {access.memberships.map((item) => (
            <option key={item.community.id} value={item.community.id}>
              {item.community.name}
            </option>
          ))}
        </FilterSelect>
      </div>

      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.items.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" aria-hidden />}
          title={filtering ? 'No payments match your filters' : 'No payments yet'}
          description={filtering ? 'Try a different status or community.' : 'Pay a contribution and it will show up here with its receipt reference.'}
          action={
            filtering ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('');
                  setCommunityId('');
                  setOffset(0);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Link to="/contributions" className={buttonVariants({})}>
                View contributions
              </Link>
            )
          }
        />
      ) : null}
      {query.isSuccess && query.data.items.length > 0 ? (
        <>
          <DataTable caption="My payments" columns={columns} rows={query.data.items} getRowKey={(row) => row.id} />
          <Pagination limit={PAGE_SIZE} offset={offset} total={query.data.pagination.total ?? 0} onChange={setOffset} />
        </>
      ) : null}
    </div>
  );
}
