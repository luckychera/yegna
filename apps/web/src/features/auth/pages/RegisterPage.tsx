import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router';

import { useAuth } from '@/app/providers/useAuth';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordField, SelectField, TextField } from '@/components/ui/Field';
import { getErrorMessage, isApiError } from '@/lib/api/errors';
import { useI18n } from '@/i18n/I18nProvider';
import {
  accountStepSchema,
  faydaStepSchema,
  normalizeEthiopianPhone,
  personalStepSchema,
  type AccountStepValues,
  type FaydaStepValues,
  type PersonalStepValues,
} from '@/lib/validation/auth.schemas';
import { Stepper } from '../components/Stepper';

const STEPS = ['Account', 'Personal', 'Fayda', 'Complete'];

type StepIndex = 0 | 1 | 2 | 3;

/** Which step owns the field that a backend validation code refers to. */
function stepForError(error: unknown): StepIndex {
  if (!isApiError(error)) return 2;

  if (['ACCOUNT_ALREADY_EXISTS', 'CONTACT_REQUIRED', 'INVALID_PASSWORD', 'PASSWORD_REQUIRED', 'INVALID_EMAIL', 'INVALID_PHONE'].includes(error.code)) {
    return 0;
  }

  if (['FIRST_NAME_REQUIRED', 'LAST_NAME_REQUIRED'].includes(error.code)) {
    return 1;
  }

  return 2;
}

export function RegisterPage() {
  const { register: registerAccount, status } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [step, setStep] = useState<StepIndex>(0);
  const [account, setAccount] = useState<AccountStepValues | null>(null);
  const [personal, setPersonal] = useState<PersonalStepValues | null>(null);
  const [serverError, setServerError] = useState<{ step: StepIndex; message: string } | null>(null);

  // Signed-in visitors are sent to the app, but not while the "Complete" step is showing
  // (registering signs the user in, and they should still see the success screen).
  if (status === 'authenticated' && step !== 3) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submitFayda(values: FaydaStepValues) {
    if (!account || !personal) {
      setStep(0);

      return;
    }

    setServerError(null);

    const phone = account.phone ? normalizeEthiopianPhone(account.phone) : null;

    try {
      await registerAccount({
        faydaIdentifier: values.faydaIdentifier,
        faydaIdentifierType: values.faydaIdentifierType,
        email: account.email.toLowerCase(),
        ...(phone ? { phone } : {}),
        password: account.password,
        firstName: personal.firstName,
        ...(personal.middleName ? { middleName: personal.middleName } : {}),
        lastName: personal.lastName,
      });

      setStep(3);
    } catch (error) {
      const target = stepForError(error);

      setServerError({ step: target, message: getErrorMessage(error) });
      setStep(target);
    }
  }

  const errorForStep = serverError && serverError.step === step ? serverError.message : null;

  return (
    <div className="animate-enter">
      <h1 className="text-h1 font-bold text-ink">{t('auth.createAccount')}</h1>
      <p className="mt-1 text-body text-ink-secondary">{t('auth.registerSubtitle')}</p>

      <div className="mt-6">
        <Stepper steps={STEPS} current={step} />
      </div>

      <div className="mt-6" aria-live="polite">
        {errorForStep ? <Alert tone="danger" className="mb-4">{errorForStep}</Alert> : null}
      </div>

      {step === 0 ? (
        <AccountStep
          defaults={account}
          onNext={(values) => {
            setAccount(values);
            setServerError(null);
            setStep(1);
          }}
        />
      ) : null}

      {step === 1 ? (
        <PersonalStep
          defaults={personal}
          onBack={() => setStep(0)}
          onNext={(values) => {
            setPersonal(values);
            setServerError(null);
            setStep(2);
          }}
        />
      ) : null}

      {step === 2 ? <FaydaStep onBack={() => setStep(1)} onSubmit={submitFayda} /> : null}

      {step === 3 ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-ink">
            <CircleCheck className="h-7 w-7" aria-hidden />
          </span>
          <h2 className="text-h2 font-semibold text-ink">You&apos;re all set!</h2>
          <p className="text-body text-ink-secondary">
            Your account is ready and your Fayda identity has been verified.
          </p>
          <Button size="lg" fullWidth onClick={() => navigate('/dashboard', { replace: true })}>
            Continue to Yegna
          </Button>
        </div>
      ) : null}

      {step < 3 ? (
        <p className="mt-6 text-center text-body text-ink-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign In
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function AccountStep({ defaults, onNext }: { defaults: AccountStepValues | null; onNext: (values: AccountStepValues) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountStepValues>({
    resolver: zodResolver(accountStepSchema),
    defaultValues: defaults ?? { email: '', phone: '', password: '', confirmPassword: '' },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-4">
      <TextField label="Email address" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
      <TextField
        label="Phone number"
        optional
        type="tel"
        autoComplete="tel"
        placeholder="09XXXXXXXX"
        hint="Ethiopian mobile number, e.g. 0911234567"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <PasswordField
        label="Password"
        autoComplete="new-password"
        placeholder="Create a password"
        hint="At least 8 characters with uppercase, lowercase and a number."
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField label="Confirm password" autoComplete="new-password" placeholder="Repeat your password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
      <Button type="submit" size="lg" fullWidth>
        Next
      </Button>
    </form>
  );
}

function PersonalStep({
  defaults,
  onBack,
  onNext,
}: {
  defaults: PersonalStepValues | null;
  onBack: () => void;
  onNext: (values: PersonalStepValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalStepValues>({
    resolver: zodResolver(personalStepSchema),
    defaultValues: defaults ?? { firstName: '', middleName: '', lastName: '' },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-4">
      <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
      <TextField label="Middle name" optional autoComplete="additional-name" error={errors.middleName?.message} {...register('middleName')} />
      <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" size="lg" className="flex-1">
          Next
        </Button>
      </div>
    </form>
  );
}

function FaydaStep({ onBack, onSubmit }: { onBack: () => void; onSubmit: (values: FaydaStepValues) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FaydaStepValues>({
    resolver: zodResolver(faydaStepSchema),
    defaultValues: { faydaIdentifierType: 'fin', faydaIdentifier: '' },
  });

  const type = useWatch({ control, name: 'faydaIdentifierType' });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="rounded-card border border-line bg-surface-soft p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-body font-semibold text-ink">Fayda Identity Verification</h2>
            <p className="text-small text-ink-secondary">We verify your Fayda account to keep every community safe and trusted.</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-body text-ink-secondary">
          {['Secure and trusted', 'Validates your identity', 'Required for community participation'].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-success" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <SelectField label="ID type" error={errors.faydaIdentifierType?.message} {...register('faydaIdentifierType')}>
        <option value="fin">Fayda FIN</option>
        <option value="fan">Fayda FAN</option>
      </SelectField>
      <TextField
        label={type === 'fin' ? 'FIN number' : 'FAN number'}
        inputMode="numeric"
        autoComplete="off"
        maxLength={16}
        placeholder="Digits only"
        error={errors.faydaIdentifier?.message}
        {...register('faydaIdentifier')}
      />

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="submit" size="lg" className="flex-1" loading={isSubmitting}>
          Verify with Fayda
        </Button>
      </div>
    </form>
  );
}

