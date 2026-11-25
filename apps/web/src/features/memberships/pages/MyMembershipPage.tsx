import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FilterSelect } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { useLeaveCommunity, useMyCommunities } from '@/features/communities/community.hooks';
import { communityTypeLabel, type MembershipStatus, type MyCommunity } from '@/features/communities/community.types';
import { runAction } from '@/lib/api/action';
import { formatDate } from '@/lib/formatting/date';
import { humanize } from '@/lib/formatting/text';

const PAGE_SIZE = 10;
const STATUS_OPTIONS: { value: '' | MembershipStatus; label: string }[] = [
  { value: '', label: 'Current memberships' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'left', label: 'Left' },
  { value: 'rejected', label: 'Rejected' },
];

export function MyMembershipPage() {
  const [status, setStatus] = useState<'' | MembershipStatus>('');
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState<MyCommunity | null>(null);

  const query = useMyCommunities({ status: status || undefined, limit: PAGE_SIZE, offset });
  const leave = useLeaveCommunity();

  async function confirmLeave() {
    if (!leaving) return;

    const ok = await runAction(() => leave.mutateAsync(leaving.community.id), `You left ${leaving.community.name}`);

    if (ok) setLeaving(null);
  }

  const columns: Column<MyCommunity>[] = [
    {
      key: 'community',
      header: 'Community',
      primary: true,
      cell: (row) => (
        <Link to={`/communities/${row.community.id}`} className="flex items-center gap-3 hover:text-primary">
          <Avatar name={row.community.name} src={row.community.logoUrl} shape="rounded" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{row.community.name}</span>
            <span className="block text-small text-ink-secondary">{communityTypeLabel(row.community.communityType)}</span>
          </span>
        </Link>
      ),
    },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="membership" status={row.membership.status} /> },
    {
      key: 'roles',
      header: 'Role',
      cell: (row) => (row.roles.length > 0 ? row.roles.map((role) => humanize(role.name)).join(', ') : 'Member'),
    },
    { key: 'joined', header: 'Joined', cell: (row) => formatDate(row.membership.joinedAt) },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      cell: (row) =>
        ['active', 'suspended'].includes(row.membership.status) ? (
          <Button variant="ghost" size="sm" onClick={() => setLeaving(row)}>
            <LogOut className="h-4 w-4" aria-hidden />
            Leave
          </Button>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="My Membership" description="Every community you belong to and where you stand in each." />

      <FilterSelect
        label="Filter by status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value as '' | MembershipStatus);
          setOffset(0);
        }}
        className="mb-5 sm:w-56"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </FilterSelect>

      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isSuccess && query.data.items.length === 0 ? (
        <EmptyState
          title={status ? 'No memberships with this status' : 'No memberships yet'}
          description="Join or create a community to get started."
          action={
            <Link to="/communities" className={buttonVariants({})}>
              Explore Communities
            </Link>
          }
        />
      ) : null}
      {query.isSuccess && query.data.items.length > 0 ? (
        <>
          <DataTable caption="My memberships" columns={columns} rows={query.data.items} getRowKey={(row) => row.membership.id} />
          <Pagination limit={PAGE_SIZE} offset={offset} total={query.data.pagination.total ?? 0} onChange={setOffset} />
        </>
      ) : null}

      <ConfirmDialog
        open={leaving !== null}
        onOpenChange={(open) => {
          if (!open) setLeaving(null);
        }}
        title={`Leave ${leaving?.community.name ?? 'community'}?`}
        description="You will no longer be a member and will lose access to its members and contributions. You can ask to join again later."
        confirmLabel="Leave community"
        tone="danger"
        loading={leave.isPending}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
