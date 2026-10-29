import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { runAction } from '@/lib/api/action';
import { formatDateOnly } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { useCommunityContributions, useContributionAction } from '../contribution.hooks';
import type { CommunityContribution } from '../contribution.types';
import { CreateContributionDialog } from './CreateContributionDialog';

const PAGE_SIZE = 10;

interface Props {
  communityId: string;
  communityName: string;
  canCreate: boolean;
  canUpdate: boolean;
  canViewMembers: boolean;
}

const ACTIONS = {
  waive: {
    label: 'Waive',
    title: 'Waive this contribution?',
    description: 'The member will no longer owe the remaining balance. This is recorded in the community audit trail.',
    confirm: 'Waive Contribution',
    toast: 'Contribution waived',
  },
  cancel: {
    label: 'Cancel',
    title: 'Cancel this contribution?',
    description: 'The contribution will be closed and the member will no longer be asked to pay it.',
    confirm: 'Cancel Contribution',
    toast: 'Contribution cancelled',
  },
} as const;

export function CommunityContributionsPanel({ communityId, communityName, canCreate, canUpdate, canViewMembers }: Props) {
  const contributions = useCommunityContributions(communityId, true);
  const act = useContributionAction(communityId);
  const [creating, setCreating] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState<{ item: CommunityContribution; action: 'waive' | 'cancel' } | null>(null);

  async function confirm() {
    if (!pending) return;

    const ok = await runAction(
      () => act.mutateAsync({ contributionId: pending.item.id, action: pending.action }),
      ACTIONS[pending.action].toast,
    );

    if (ok) setPending(null);
  }

  const columns: Column<CommunityContribution>[] = [
    { key: 'member', header: 'Member', primary: true, cell: (row) => <span className="font-medium">{row.memberName}</span> },
    { key: 'due', header: 'Due date', cell: (row) => formatDateOnly(row.dueDate) },
    { key: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount, row.currency) },
    { key: 'paid', header: 'Paid', cell: (row) => formatMoney(row.paidAmount, row.currency) },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="contribution" status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      className: 'text-right',
      cell: (row) =>
        canUpdate && ['pending', 'partially_paid', 'overdue'].includes(row.status) ? (
          <span className="flex flex-wrap justify-end gap-2">
            {(['waive', 'cancel'] as const).map((action) => (
              <Button
                key={action}
                size="sm"
                variant="secondary"
                onClick={() => setPending({ item: row, action })}
                aria-label={`${ACTIONS[action].label} contribution for ${row.memberName}`}
              >
                {ACTIONS[action].label}
              </Button>
            ))}
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      {canCreate ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            New Contribution
          </Button>
        </div>
      ) : null}

      {contributions.isPending ? <ListSkeleton /> : null}
      {contributions.isError ? <ErrorState error={contributions.error} onRetry={() => void contributions.refetch()} /> : null}
      {contributions.isSuccess && contributions.data.length === 0 ? (
        <EmptyState
          title="No contributions yet"
          description={canCreate ? 'Create the first contribution for a member.' : 'Contributions created for members will appear here.'}
        />
      ) : null}
      {contributions.isSuccess && contributions.data.length > 0 ? (
        <>
          <DataTable
            caption="Community contributions"
            columns={columns}
            rows={contributions.data.slice(offset, offset + PAGE_SIZE)}
            getRowKey={(row) => row.id}
          />
          <Pagination limit={PAGE_SIZE} offset={offset} total={contributions.data.length} onChange={setOffset} />
        </>
      ) : null}

      <CreateContributionDialog
        open={creating}
        onOpenChange={setCreating}
        communities={[{ id: communityId, name: communityName, canViewMembers }]}
        defaultCommunityId={communityId}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? ACTIONS[pending.action].title : ''}
        description={pending ? ACTIONS[pending.action].description : ''}
        confirmLabel={pending ? ACTIONS[pending.action].confirm : 'Confirm'}
        tone="danger"
        loading={act.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
