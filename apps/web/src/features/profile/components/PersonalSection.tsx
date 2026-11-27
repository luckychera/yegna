import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { useAuth } from '@/app/providers/useAuth';
import type { UserProfile } from '@/features/auth/auth.types';
import { authApi } from '@/features/auth/auth.api';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { SelectField, TextField } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api/errors';
import { profileSchema, type ProfileFormValues } from '@/lib/validation/profile.schema';
import { accountSectionPath } from '../account-sections';
import { LANGUAGE_OPTIONS, timeZoneChoices } from '../time-zones';
import { SectionFrame } from './SectionFrame';

function formValues(profile: UserProfile): ProfileFormValues {
  return {
    firstName: profile.profile?.firstName ?? '',
    middleName: profile.profile?.middleName ?? '',
    lastName: profile.profile?.lastName ?? '',
    displayName: profile.profile?.displayName ?? '',
    avatarUrl: profile.profile?.avatarUrl ?? '',
    preferredLanguage: profile.profile?.preferredLanguage ?? 'en',
    timezone: profile.profile?.timezone ?? 'Africa/Addis_Ababa',
  };
}

export function PersonalSection({ profile }: { profile: UserProfile }) {
  const { refreshProfile } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: formValues(profile),
  });

  const language = profile.profile?.preferredLanguage ?? 'en';
  const languages = LANGUAGE_OPTIONS.some((option) => option.value === language)
    ? LANGUAGE_OPTIONS
    : [...LANGUAGE_OPTIONS, { value: language, label: language }];
  const zones = timeZoneChoices(profile.profile?.timezone ?? 'Africa/Addis_Ababa');

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await authApi.updateProfile({
        firstName: values.firstName,
        middleName: values.middleName || null,
        lastName: values.lastName,
        displayName: values.displayName || null,
        avatarUrl: values.avatarUrl || null,
        preferredLanguage: values.preferredLanguage,
        timezone: values.timezone,
      });
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <SectionFrame
      title="Personal information"
      description="These details appear on your membership cards. Email, phone and your Fayda number cannot be changed here."
    >
      <Card>
        <CardContent>
          {serverError ? (
            <Alert tone="danger" className="mb-4">
              {serverError}
            </Alert>
          ) : null}
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register('firstName')} />
              <TextField
                label="Middle name"
                optional
                autoComplete="additional-name"
                error={errors.middleName?.message}
                {...register('middleName')}
              />
              <TextField label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register('lastName')} />
              <TextField
                label="Display name"
                optional
                hint="Shown around Yegna instead of your full name when set."
                error={errors.displayName?.message}
                {...register('displayName')}
              />
            </div>
            <TextField
              label="Avatar URL"
              optional
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              hint="A link to an image. Leave blank to keep your initials."
              error={errors.avatarUrl?.message}
              {...register('avatarUrl')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Preferred language" error={errors.preferredLanguage?.message} {...register('preferredLanguage')}>
                {languages.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Time zone" error={errors.timezone?.message} {...register('timezone')}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link to={accountSectionPath('overview')} className={buttonVariants({ variant: 'secondary' })}>
                Cancel
              </Link>
              <Button type="submit" loading={isSubmitting}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SectionFrame>
  );
}
