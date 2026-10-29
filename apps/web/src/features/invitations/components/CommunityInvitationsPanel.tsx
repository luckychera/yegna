import { useState } from 'react';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { useCommunityMembers } from '@/features/memberships/membership.hooks';
import { runAction } from '@/lib/api/action';
import { formatDate } from '@/lib/formatting/date';
import { useCommunityInvitations, useRevokeInvitation } from '../invitation.hooks';
import type { CommunityInvitation } from '../invitation.types';

interface Props {
  communityId: string;
  canInvite: boolean;
  canViewMembers: boolean;
}

export function CommunityInvitationsPanel({ communityId, canInvite, canViewMembers }: Props) {
  const invitations = useCommunityInvitations(communityId, true);
  const members = useCommunityMembers(communityId, canViewMembers);
  const revoke = useRevokeInvitation(communityId);
  const [target, setTarget] = useState<CommunityInvitation | null>(null);

  const nameByUser = new Map((members.data ?? []).map((member) => [member.userId, member.name]));

  async function confirm() {
    if (!target) return;

    const ok = await runAction(() => revoke.mutateAsync(target.id), 'Invitation revoked');

    if (ok) setTarget(null);
  }

  const columns: Column<CommunityInvitation>[] = [
    { key: 'invitee', header: 'Invited member', primary: true, cell: (row) => nameByUser.get(row.invitedUserId) ?? 'Invited member' },
    { key: 'sent', header: 'Sent', cell: (row) => formatDate(row.createdAt) },
    { key: 'expires', header: 'Expires', cell: (row) => formatDate(row.expiresAt) },
    { key: 'status', header: 'Status', cell: (row) => <StatusBadge kind="invitation" status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      actions: true,
      className: 'text-right',
      cell: (row) =>
        canInvite && row.status === 'pending' ? (
          <Button size="sm" variant="secondary" onClick={() => setTarget(row)} aria-label="Revoke invitation">
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <Alert tone="info">Inviting new members by email or phone number isn&apos;t available yet. Invitations sent to existing members appear here.</Alert>

      {invitations.isPending ? <ListSkeleton rows={3} /> : null}
      {invitations.isError ? <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} /> : null}
      {invitations.isSuccess && invitations.data.length === 0 ? (
        <EmptyState title="No invitations" description="Invitations to this community will be listed here." />
      ) : null}
      {invitations.isSuccess && invitations.data.length > 0 ? (
        <DataTable caption="Community invitations" columns={columns} rows={invitations.data} getRowKey={(row) => row.id} />
      ) : null}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title="Revoke invitation?"
        description="The invited member will no longer be able to accept it. You can't undo this."
        confirmLabel="Revoke Invitation"
        tone="danger"
        loading={revoke.isPending}
        onConfirm={confirm}
      />
    </div>
  );
}
