import { Mail, Pencil, Phone, Save, ShieldCheck, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/app/providers/useAuth';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/layout/PageHeader';
import { authApi } from '@/features/auth/auth.api';
import type { FaydaVerificationStatus, UpdateProfileInput } from '@/features/auth/auth.types';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/formatting/date';
import { fullName } from '@/lib/formatting/text';

const FAYDA: Record<
  FaydaVerificationStatus | 'none',
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  verified: { label: 'Verified', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Verification failed', tone: 'danger' },
  revoked: { label: 'Revoked', tone: 'danger' },
  none: { label: 'Not verified', tone: 'neutral' },
};

interface ProfileForm {
  firstName: string;
  middleName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string;
  preferredLanguage: string;
  timezone: string;
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-ink-secondary">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-small text-ink-secondary">{label}</p>
        <div className="truncate text-body text-ink">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-small font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body text-ink outline-none transition placeholder:text-ink-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-small font-medium text-ink">{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {children}
      </select>
    </label>
  );
}

function createForm(profile: ReturnType<typeof useAuth>['profile']): ProfileForm {
  return {
    firstName: profile?.profile?.firstName ?? '',
    middleName: profile?.profile?.middleName ?? '',
    lastName: profile?.profile?.lastName ?? '',
    displayName: profile?.profile?.displayName ?? '',
    avatarUrl: profile?.profile?.avatarUrl ?? '',
    preferredLanguage: profile?.profile?.preferredLanguage ?? 'en',
    timezone: profile?.profile?.timezone ?? 'Africa/Addis_Ababa',
  };
}

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();

  if (!profile) {
    return null;
  }

  return <ProfileEditor profile={profile} refreshProfile={refreshProfile} />;
}
function ProfileEditor({
  profile,
  refreshProfile,
}: {
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>;
  refreshProfile: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(() => createForm(profile));
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const name =
    fullName({
      displayName: profile.profile?.displayName,
      firstName: profile.profile?.firstName,
      lastName: profile.profile?.lastName,
    }) || 'Yegna member';

  const fayda = FAYDA[profile.identity?.verificationStatus ?? 'none'];

  function updateField<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function cancelEditing() {
    setForm(createForm(profile));
    setServerError(null);
    setEditing(false);
  }

  async function saveProfile() {
    setServerError(null);

    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();

    if (!firstName || !lastName) {
      setServerError('First name and last name are required.');
      return;
    }

    setIsSaving(true);

    const input: UpdateProfileInput = {
      firstName,
      middleName: form.middleName.trim() || null,
      lastName,
      displayName: form.displayName.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      preferredLanguage: form.preferredLanguage,
      timezone: form.timezone.trim(),
    };

    try {
      await authApi.updateProfile(input);
      await refreshProfile();

      toast.success('Profile updated successfully');
      setEditing(false);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your personal information and identity details."
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={cancelEditing} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" aria-hidden />
                Cancel
              </Button>

              <Button type="button" onClick={() => void saveProfile()} loading={isSaving}>
                <Save className="mr-2 h-4 w-4" aria-hidden />
                Save changes
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Edit profile
              </Button>

              <Link to="/settings" className={buttonVariants({ variant: 'secondary' })}>
                Account settings
              </Link>
            </div>
          )
        }
      />

      {serverError ? (
        <Alert tone="danger" className="mb-4 max-w-2xl">
          {serverError}
        </Alert>
      ) : null}

      {editing ? (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardContent className="space-y-5">
              <div>
                <h2 className="text-h2 font-semibold text-ink">Personal information</h2>
                <p className="mt-1 text-small text-ink-secondary">
                  Keep your Yegna profile information up to date.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(value) => updateField('firstName', value)}
                  required
                  placeholder="Your first name"
                />

                <Field
                  label="Middle name"
                  value={form.middleName}
                  onChange={(value) => updateField('middleName', value)}
                  placeholder="Your middle name"
                />

                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) => updateField('lastName', value)}
                  required
                  placeholder="Your last name"
                />

                <Field
                  label="Display name"
                  value={form.displayName}
                  onChange={(value) => updateField('displayName', value)}
                  placeholder="Name shown around Yegna"
                />
              </div>

              <Field
                label="Avatar URL"
                value={form.avatarUrl}
                onChange={(value) => updateField('avatarUrl', value)}
                type="url"
                placeholder="https://example.com/avatar.jpg"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Preferred language"
                  value={form.preferredLanguage}
                  onChange={(value) => updateField('preferredLanguage', value)}
                >
                  <option value="en">English</option>
                  <option value="am">Amharic</option>
                </SelectField>

                <Field
                  label="Timezone"
                  value={form.timezone}
                  onChange={(value) => updateField('timezone', value)}
                  placeholder="Africa/Addis_Ababa"
                />
              </div>

              <div className="rounded-lg border border-line bg-surface-soft p-3">
                <p className="text-small font-medium text-ink">Identity information is protected</p>
                <p className="mt-1 text-small text-ink-secondary">
                  Your Fayda identity, email address, and phone number cannot be changed from
                  profile editing.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar
                  name={
                    fullName({
                      displayName: form.displayName || null,
                      firstName: form.firstName || null,
                      lastName: form.lastName || null,
                    }) || 'Yegna member'
                  }
                  src={form.avatarUrl || undefined}
                  size="xl"
                />

                <div className="min-w-0">
                  <p className="text-small font-medium text-ink">Profile preview</p>
                  <p className="text-small text-ink-secondary">
                    This is how your profile identity will appear.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-4 pb-2">
              <Avatar name={name} src={profile.profile?.avatarUrl} size="xl" />

              <div className="min-w-0">
                <h2 className="truncate text-h2 font-semibold text-ink">{name}</h2>

                <p className="text-body text-ink-secondary">
                  Member since {formatDate(profile.user.createdAt)}
                </p>
              </div>
            </div>

            <div className="divide-y divide-line">
              <Row icon={<Mail className="h-4 w-4" aria-hidden />} label="Email">
                {profile.user.email ?? 'Not provided'}
              </Row>

              <Row icon={<Phone className="h-4 w-4" aria-hidden />} label="Phone">
                {profile.user.phone ?? 'Not provided'}
              </Row>

              <Row
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                label="Fayda verification"
              >
                <Badge tone={fayda.tone}>{fayda.label}</Badge>

                {profile.identity?.verifiedAt ? (
                  <span className="ml-2 text-small text-ink-secondary">
                    on {formatDate(profile.identity.verifiedAt)}
                  </span>
                ) : null}
              </Row>
            </div>

            <div className="pt-3">
              <p className="text-small text-ink-muted">
                Your Fayda ID number is never shown here. Account identity information is protected
                separately from your editable profile.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
