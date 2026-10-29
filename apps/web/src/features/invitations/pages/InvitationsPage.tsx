import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Pagination } from '@/components/ui/Pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { runAction } from '@/lib/api/action';
import { formatDate, formatRelative } from '@/lib/formatting/date';
import { useMyInvitations, useRespondToInvitation } from '../invitation.hooks';
import type { InvitationStatus, MyInvitation } from '../invitation.types';

const PAGE_SIZE = 10;
const TABS: { value: InvitationStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

const EMPTY_COPY: Record<InvitationStatus, string> = {
  pending: "You don't have any pending invitations.",
  accepted: "You haven't accepted any invitations yet.",
  rejected: "You haven't rejected any invitations.",
  revoked: 'No revoked invitations.',
  expired: 'No invitations have expired.',
};

export function InvitationsPage() {
  const [status, setStatus] = useState<InvitationStatus>('pending');
  const [offset, setOffset] = useState(0);
  const [rejecting, setRejecting] = useState<MyInvitation | null>(null);

  const query = useMyInvitations({ status, limit: PAGE_SIZE, offset });
  const respond = useRespondToInvitation();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function accept(invitation: MyInvitation) {
    setBusyId(invitation.id);
    await runAction(() => respond.mutateAsync({ id: invitation.id, response: 'accept' }), 'Invitation accepted');
    setBusyId(null);
  }

  async function reject() {
    if (!rejecting) return;

    const ok = await runAction(() => respond.mutateAsync({ id: rejecting.id, response: 'reject' }), 'Invitation rejected');

    if (ok) setRejecting(null);
  }

  return (
    <div>
      <PageHeader title="Invitations" description="Invitations to join communities." />

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as InvitationStatus);
          setOffset(0);
        }}
      >
        <TabsList aria-label="Invitation status">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value === 'pending' && query.data && status === 'pending' ? ` (${query.data.pagination.total ?? 0})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-5">
        {query.isPending ? <ListSkeleton /> : null}
        {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.isSuccess && query.data.items.length === 0 ? (
          <EmptyState icon={<Mail className="h-6 w-6" aria-hidden />} title="No invitations" description={EMPTY_COPY[status]} />
        ) : null}

        {query.isSuccess && query.data.items.length > 0 ? (
          <>
            <ul className="space-y-3">
              {query.data.items.map((invitation) => (
                <li key={invitation.id} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={invitation.community.name} src={invitation.community.logoUrl} size="lg" shape="rounded" />
                    <div className="min-w-0">
                      <p className="truncate text-body font-semibold text-ink">{invitation.community.name}</p>
                      <p className="text-small text-ink-secondary">
                        Invited by {invitation.inviter.name ?? 'a community administrator'} · {formatRelative(invitation.createdAt)}
                      </p>
                      {invitation.status === 'pending' ? (
                        <p className="text-small text-ink-muted">Expires {formatDate(invitation.expiresAt)}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {invitation.status !== 'pending' ? <StatusBadge kind="invitation" status={invitation.status} /> : null}
                    {invitation.status === 'pending' ? (
                      <>
                        <Button size="sm" loading={busyId === invitation.id} onClick={() => void accept(invitation)} aria-label={`Accept invitation to ${invitation.community.name}`}>
                          Accept
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busyId === invitation.id} onClick={() => setRejecting(invitation)} aria-label={`Reject invitation to ${invitation.community.name}`}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {invitation.status === 'accepted' ? (
                      <Link to={`/communities/${invitation.community.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        View community
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <Pagination limit={PAGE_SIZE} offset={offset} total={query.data.pagination.total ?? 0} onChange={setOffset} />
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={`Reject invitation to ${rejecting?.community.name ?? 'this community'}?`}
        description="You won't join this community, and the person who invited you will be told. You can't undo this."
        confirmLabel="Reject Invitation"
        tone="danger"
        loading={respond.isPending}
        onConfirm={reject}
      />
    </div>
  );
}
