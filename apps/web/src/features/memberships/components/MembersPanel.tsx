import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuth } from '@/app/providers/useAuth';
import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { FilterSelect, SearchInput } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import type { MembershipStatus } from '@/features/communities/community.types';
import { runAction } from '@/lib/api/action';
import { formatDate } from '@/lib/formatting/date';
import { useCommunityMembers, useMemberAction } from '../membership.hooks';
import type { Member, MemberAction } from '../membership.types';

const PAGE_SIZE = 10;
const STATUSES: MembershipStatus[] = ['active', 'pending', 'suspended', 'rejected', 'left'];

interface ActionMeta {
  label: string;
  title: (name: string) => string;
  description: string;
  confirm: string;
  tone: 'primary' | 'danger';
  toast: string;
  action: MemberAction;
}

const META: Record<string, ActionMeta> = {
  approve: {
    label: 'Approve',
    title: (name) => `Approve ${name}?`,
    description: 'They will become an active member and can take part in this community.',
    confirm: 'Approve Member',
    tone: 'primary',
    toast: 'Membership approved',
    action: 'approve',
  },
  reactivate: {
    label: 'Reactivate',
    title: (name) => `Reactivate ${name}?`,
    description: 'They will be able to take part in this community again.',
    confirm: 'Reactivate Member',
    tone: 'primary',
    toast: 'Membership reactivated',
    action: 'approve',
  },
  reject: {
    label: 'Reject',
    title: () => 'Reject request?',
    description: "This person's request to join will be declined and they will be notified.",
    confirm: 'Reject Request',
    tone: 'danger',
    toast: 'Request rejected',
    action: 'reject',
  },
  suspend: {
    label: 'Suspend',
    title: () => 'Suspend membership?',
    description: 'This member will no longer be able to participate normally.',
    confirm: 'Suspend Membership',
    tone: 'danger',
    toast: 'Membership suspended',
    action: 'suspend',
  },
  remove: {
    label: 'Remove',
    title: () => 'Remove member?',
    description: 'This action affects their membership in this community.',
    confirm: 'Remove Member',
    tone: 'danger',
    toast: 'Member removed',
    action: 'remove',
  },
};

/** Which actions apply to a member, given the backend permissions the user actually has. */
function availableActions(member: Member, canUpdate: boolean, canRemove: boolean): string[] {
  switch (member.status) {
    case 'pending':
      return canUpdate ? ['approve', 'reject'] : [];
    case 'active':
      return canRemove ? ['suspend', 'remove'] : [];
    case 'suspended':
      return [...(canUpdate ? ['reactivate'] : []), ...(canRemove ? ['remove'] : [])];
    default:
      return [];
  }
}

interface MembersPanelProps {
  communityId: string;
  canUpdate: boolean;
  canRemove: boolean;
}

export function MembersPanel({ communityId, canUpdate, canRemove }: MembersPanelProps) {
  const { profile } = useAuth();
  const members = useCommunityMembers(communityId, true);
  const act = useMemberAction(communityId);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState<{ member: Member; key: string } | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return (members.data ?? []).filter(
      (member) =>
        (!status || member.status === status) &&
        (!needle || [member.name, member.email ?? '', member.phone ?? ''].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [members.data, search, status]);

  async function confirm() {
    if (!pending) return;

    const meta = META[pending.key];
    const ok = await runAction(
      () => act.mutateAsync({ membershipId: pending.member.id, action: meta.action }),
      meta.toast,
    );

    if (ok) setPending(null);
  }

  const columns: Column<Member>[] = [
    {
      key: 'member',
      header: 'Member',
      primary: true,
      cell: (member) => (
        <span className="flex items-center gap-3">
          <Avatar name={member.name} size="md" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{member.name}</span>
            <span className="block truncate text-small text-ink-secondary">{member.email ?? member.phone ?? '—'}</span>
          </span>
        </span>
      ),
    },
    { key: 'joined', header: 'Joined', cell: (member) => formatDate(member.joinedAt) },
    { key: 'status', header: 'Status', cell: (member) => <StatusBadge kind="membership" status={member.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      className: 'text-right',
      cell: (member) => {
        // Nobody manages their own membership from this screen.
        if (member.userId === profile?.user.id) {
          return <span className="text-small text-ink-muted">You</span>;
        }

        return (
          <span className="flex flex-wrap justify-end gap-2">
            {availableActions(member, canUpdate, canRemove).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={META[key].tone === 'danger' ? 'secondary' : 'outline'}
                onClick={() => setPending({ member, key })}
                aria-label={`${META[key].label} ${member.name}`}
              >
                {META[key].label}
              </Button>
            ))}
          </span>
        );
      },
    },
  ];

  if (members.isPending) return <ListSkeleton />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;

  const page = filtered.slice(offset, offset + PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          label="Search members"
          placeholder="Search members…"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setOffset(0);
          }}
          className="flex-1"
        />
        <FilterSelect
          label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setOffset(0);
          }}
          className="sm:w-48"
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </option>
          ))}
        </FilterSelect>
      </div>

      <p className="mb-3 text-small text-ink-secondary">
        {members.data.length} {members.data.length === 1 ? 'member' : 'members'}
      </p>

      {page.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" aria-hidden />}
          title={members.data.length === 0 ? 'No members yet' : 'No members match your search'}
          description={members.data.length === 0 ? 'Members will appear here once they join.' : 'Try a different search or status.'}
        />
      ) : (
        <>
          <DataTable caption="Community members" columns={columns} rows={page} getRowKey={(member) => member.id} />
          <Pagination limit={PAGE_SIZE} offset={offset} total={filtered.length} onChange={setOffset} />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending ? META[pending.key].title(pending.member.name) : ''}
        description={pending ? META[pending.key].description : ''}
        confirmLabel={pending ? META[pending.key].confirm : 'Confirm'}
        tone={pending ? META[pending.key].tone : 'primary'}
        loading={act.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
