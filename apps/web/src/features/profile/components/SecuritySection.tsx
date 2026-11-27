import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/app/providers/useAuth';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/features/account/account.hooks';
import type { AuthSession } from '@/features/account/account.types';
import { authApi } from '@/features/auth/auth.api';
import { ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { PasswordField } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api/errors';
import { runAction } from '@/lib/api/action';
import { formatDateTime } from '@/lib/formatting/date';
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/validation/auth.schemas';
import { describeClient } from '../session-label';
import { SectionFrame } from './SectionFrame';

function SessionRow({
  session,
  canRevoke,
  onRevoke,
}: {
  session: AuthSession;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {describeClient(session.userAgent)}
          {session.current ? (
            <Badge tone="success" className="ml-2">
              This device
            </Badge>
          ) : null}
        </p>
        <p className="text-small text-ink-secondary">
          Last active {formatDateTime(session.lastActiveAt)} · {session.ipAddress ?? 'IP not recorded'}
        </p>
      </div>
      {canRevoke && !session.current ? (
        <Button variant="secondary" size="sm" onClick={onRevoke}>
          Sign out
        </Button>
      ) : null}
    </li>
  );
}

export function SecuritySection() {
  const { logout, signOutLocally } = useAuth();
  const navigate = useNavigate();
  const sessions = useSessions();
  const revokeOne = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const listed = sessions.data ?? [];
  const currentKnown = listed.some((session) => session.current);
  const otherCount = listed.filter((session) => !session.current).length;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password updated');
      signOutLocally('password-changed');
      navigate('/login', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  async function confirmRevoke() {
    if (!revokeId) return;

    const ok = await runAction(() => revokeOne.mutateAsync(revokeId), 'That device was signed out');

    if (ok) setRevokeId(null);
  }

  async function confirmRevokeOthers() {
    const ok = await runAction(
      () => revokeOthers.mutateAsync(),
      (count) => (count === 0 ? 'No other devices were signed in' : 'Signed out of the other devices'),
    );

    if (ok) setConfirmOthers(false);
  }

  return (
    <SectionFrame title="Security" description="Your password and the devices currently signed in to this account.">
      <Card>
        <CardContent>
          <h3 className="text-h3 font-semibold text-ink">Change password</h3>
          <Alert tone="info" className="mt-3 mb-4">
            For your safety, changing your password signs you out of every device.
          </Alert>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-small text-ink-secondary">
            <li>At least 8 characters</li>
            <li>One uppercase letter, one lowercase letter and one number</li>
          </ul>
          {serverError ? (
            <Alert tone="danger" className="mb-4">
              {serverError}
            </Alert>
          ) : null}
          <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
            <PasswordField label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
            <PasswordField label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
            <PasswordField label="Confirm new password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
            <Button type="submit" loading={isSubmitting}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-h3 font-semibold text-ink">Signed-in devices</h3>
              <p className="mt-1 text-small text-ink-secondary">Each row is a browser or phone that can still refresh this account.</p>
            </div>
            {currentKnown && otherCount > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmOthers(true)}>
                Sign out other devices
              </Button>
            ) : null}
          </div>

          {sessions.isPending ? <ListSkeleton rows={2} /> : null}
          {sessions.isError ? <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} className="mt-4" /> : null}
          {sessions.isSuccess && listed.length === 0 ? (
            <p className="mt-4 text-body text-ink-secondary">No active sessions were found.</p>
          ) : null}
          {sessions.isSuccess && !currentKnown && listed.length > 0 ? (
            <Alert tone="info" className="mt-4">
              This sign-in was created before devices could be told apart, so other devices cannot be signed out from
              here. Sign out and back in to manage them.
            </Alert>
          ) : null}
          {listed.length > 0 ? (
            <ul className="mt-2">
              {listed.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  canRevoke={currentKnown}
                  onRevoke={() => setRevokeId(session.id)}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-h3 font-semibold text-ink">Sign out</h3>
            <p className="mt-1 text-small text-ink-secondary">Ends the session on this device.</p>
          </div>
          <Button variant="secondary" onClick={() => setConfirmSignOut(true)}>
            Sign out
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open && !revokeOne.isPending) setRevokeId(null);
        }}
        title="Sign out that device?"
        description="It will need to sign in again. This device stays signed in."
        confirmLabel="Sign out device"
        tone="danger"
        loading={revokeOne.isPending}
        onConfirm={confirmRevoke}
      />
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={(open) => {
          if (!open && !revokeOthers.isPending) setConfirmOthers(false);
        }}
        title="Sign out of every other device?"
        description="Those devices will need to sign in again. This device stays signed in."
        confirmLabel="Sign out other devices"
        tone="danger"
        loading={revokeOthers.isPending}
        onConfirm={confirmRevokeOthers}
      />
      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of Yegna?"
        description="This ends the session on this device. Other devices stay signed in until you sign them out."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={() => {
          void logout().then(() => toast.success('You have been signed out'));
        }}
      />
    </SectionFrame>
  );
}
