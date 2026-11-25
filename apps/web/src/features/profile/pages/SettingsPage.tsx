import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/app/providers/useAuth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PasswordField } from '@/components/ui/Field';
import { authApi } from '@/features/auth/auth.api';
import { getErrorMessage } from '@/lib/api/errors';
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/validation/auth.schemas';

export function SettingsPage() {
  const { signOutLocally } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await authApi.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password updated');
      // The backend ends every session when the password changes, so sign in again.
      signOutLocally('password-changed');
      navigate('/login', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account security." />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert tone="info" className="mb-4">
            For your safety, changing your password signs you out of every device.
          </Alert>
          {serverError ? <Alert tone="danger" className="mb-4">{serverError}</Alert> : null}
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              hint="At least 8 characters with uppercase, lowercase and a number."
              error={errors.newPassword?.message}
              {...register('newPassword')}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" loading={isSubmitting}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
