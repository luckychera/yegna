import { useState } from 'react';

import { DataTable, type Column } from '@/components/data-display/DataTable';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/Field';
import { useAssignableRoles, useCommunityMembers } from '@/features/memberships/membership.hooks';
import { runAction } from '@/lib/api/action';
import { formatDate } from '@/lib/formatting/date';
import { humanize } from '@/lib/formatting/text';
import { useCommunityInvitations, useCreateInvitation, useRevokeInvitation } from '../invitation.hooks';
import type { CommunityInvitation } from '../invitation.types';

interface Props {
  communityId: string;
  canInvite: boolean;
  canViewMembers: boolean;
  canAssignRoles: boolean;
}

export function CommunityInvitationsPanel({ communityId, canInvite, canViewMembers, canAssignRoles }: Props) {
  const invitations = useCommunityInvitations(communityId, true);
  const members = useCommunityMembers(communityId, canViewMembers);
  const revoke = useRevokeInvitation(communityId);
  const [target, setTarget] = useState<CommunityInvitation | null>(null);
  const [inviting, setInviting] = useState(false);

  const nameByUser = new Map((members.data ?? []).map((member) => [member.userId, member.name]));

  async function confirm() {
    if (!target) return;

    const ok = await runAction(() => revoke.mutateAsync(target.id), 'Invitation revoked');

    if (ok) setTarget(null);
  }

  const columns: Column<CommunityInvitation>[] = [
    { key: 'invitee', header: 'Invited member', primary: true, cell: (row) => nameByUser.get(row.invitedUserId) ?? 'Invited member' },
    { key: 'role', header: 'Role on joining', cell: (row) => (row.roleName ? humanize(row.roleName) : 'Member') },
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
      {canInvite ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-ink-secondary">
            {canAssignRoles
              ? 'Choose the role they receive when they accept and become an active member. A pending invitation does not grant that role.'
              : 'People you invite join as members. An administrator can change their role after they join.'}
          </p>
          <Button className="shrink-0" onClick={() => setInviting(true)}>
            Invite someone
          </Button>
        </div>
      ) : null}

      {invitations.isPending ? <ListSkeleton rows={3} /> : null}
      {invitations.isError ? <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} /> : null}
      {invitations.isSuccess && invitations.data.length === 0 ? (
        <EmptyState title="No invitations" description="Invitations to this community will be listed here." />
      ) : null}
      {invitations.isSuccess && invitations.data.length > 0 ? (
        <DataTable caption="Community invitations" columns={columns} rows={invitations.data} getRowKey={(row) => row.id} />
      ) : null}

      <InviteDialog
        open={inviting}
        communityId={communityId}
        canAssignRoles={canAssignRoles}
        onOpenChange={setInviting}
      />

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

function InviteDialog({
  open,
  communityId,
  canAssignRoles,
  onOpenChange,
}: {
  open: boolean;
  communityId: string;
  canAssignRoles: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const roles = useAssignableRoles(communityId, open && canAssignRoles);
  const create = useCreateInvitation(communityId);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = roleId || roles.data?.find((role) => role.name === 'member')?.id || roles.data?.[0]?.id || '';
  const selectedRole = roles.data?.find((role) => role.id === selected);

  async function submit() {
    const trimmed = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter the email address of a person who already has a Yegna account.');
      return;
    }

    if (canAssignRoles && !selected) {
      setError('Choose a role.');
      return;
    }

    setError(null);

    const ok = await runAction(
      () => create.mutateAsync({ email: trimmed, ...(canAssignRoles ? { roleId: selected } : {}) }),
      'Invitation sent',
    );

    if (ok) {
      setEmail('');
      setRoleId('');
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!create.isPending) onOpenChange(next);
      }}
      title="Invite someone"
      description={
        canAssignRoles
          ? 'They receive this role only after they accept and their membership is active.'
          : 'They join as a member. You cannot choose another role.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={create.isPending}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error ?? undefined}
        />
        {canAssignRoles ? (
          roles.isError ? (
            <Alert tone="danger">The role list could not be loaded.</Alert>
          ) : (
            <SelectField
              label="Role"
              value={selected}
              onChange={(event) => setRoleId(event.target.value)}
              hint={selectedRole?.description}
              disabled={roles.isPending}
            >
              {(roles.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {humanize(role.name)}
                </option>
              ))}
            </SelectField>
          )
        ) : (
          <Alert tone="info">This person joins as a member.</Alert>
        )}
      </div>
    </Dialog>
  );
}
