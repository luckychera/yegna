import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/useAuth';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField, TextField } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api/errors';
import { useI18n } from '@/i18n/I18nProvider';
import { loginSchema, toLoginIdentifier, type LoginFormValues } from '@/lib/validation/auth.schemas';

export function LoginPage() {
  const { login, notice } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const identifier = toLoginIdentifier(values.identifier);

    if (!identifier) {
      return;
    }

    try {
      await login(identifier, values.password);
      navigate(from && from !== '/login' ? from : '/dashboard', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <div className="animate-enter">
      <h1 className="text-h1 font-bold text-ink">{t('auth.welcomeBack')}</h1>
      <p className="mt-1 text-body text-ink-secondary">{t('auth.loginSubtitle')}</p>

      <div className="mt-6 space-y-3" aria-live="polite">
        {notice === 'expired' ? <Alert tone="warning">{t('auth.sessionExpired')}</Alert> : null}
        {notice === 'password-changed' ? (
          <Alert tone="success">{t('auth.passwordChanged')}</Alert>
        ) : null}
        {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      </div>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <TextField
          label={t('auth.identifier')}
          autoComplete="username"
          inputMode="email"
          placeholder={t('auth.identifierPlaceholder')}
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')}
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {t('auth.signIn')}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-ink-secondary">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          {t('auth.signUp')}
        </Link>
      </p>
    </div>
  );
}
