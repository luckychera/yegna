import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Pagination } from '@/components/ui/Pagination';
import { useCommunityMembers } from '@/features/memberships/membership.hooks';
import { formatDateTime } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { humanize } from '@/lib/formatting/text';
import { useState } from 'react';
import { paymentReference } from '../payment-reference';
import { useCommunityPayments } from '../payment.hooks';
import type { AdminPayment } from '../payment.types';

const PAGE_SIZE = 10;

/** Read-only payment ledger for people the backend allows to view community payments. */
export function CommunityPaymentsPanel({ communityId, canViewMembers }: { communityId: string; canViewMembers: boolean }) {
  const payments = useCommunityPayments(communityId, true);
  const members = useCommunityMembers(communityId, canViewMembers);
  const [offset, setOffset] = useState(0);

  const nameByUser = new Map((members.data ?? []).map((member) => [member.userId, member.name]));

  const columns: Column<AdminPayment>[] = [
    { key: 'date', header: 'Date', primary: true, cell: (row) => formatDateTime(row.initiatedAt) },
    { key: 'member', header: 'Member', cell: (row) => nameByUser.get(row.memberUserId) ?? 'Member' },
    { key: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount, row.currency) },
    { key: 'method', header: 'Method', cell: (row) => (row.paymentMethod ? humanize(row.paymentMethod) : '—') },
    { key: 'reference', header: 'Reference', cell: (row) => <span className="break-all font-mono text-small">{paymentReference(row)}</span> },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="payment" status={row.status} /> },
  ];

  if (payments.isPending) return <ListSkeleton />;
  if (payments.isError) return <ErrorState error={payments.error} onRetry={() => void payments.refetch()} />;
  if (payments.data.length === 0) {
    return <EmptyState title="No payments yet" description="Payments made by members will appear here." />;
  }

  return (
    <>
      <DataTable
        caption="Community payments"
        columns={columns}
        rows={payments.data.slice(offset, offset + PAGE_SIZE)}
        getRowKey={(row) => row.id}
      />
      <Pagination limit={PAGE_SIZE} offset={offset} total={payments.data.length} onChange={setOffset} />
    </>
  );
}
