import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api/errors';
import { communitySchema, type CommunityFormValues } from '@/lib/validation/community.schemas';
import { COMMUNITY_TYPES, COMMUNITY_TYPE_LABELS, type CommunityInput, type CommunityType } from '../community.types';

interface CommunityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initial?: { name: string; communityType: string; description: string | null; logoUrl: string | null; bannerUrl: string | null };
  onSubmit: (input: CommunityInput) => Promise<void>;
}

export function CommunityFormDialog({ open, onOpenChange, mode, initial, onSubmit }: CommunityFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create a community' : 'Edit community'}
      description={
        mode === 'create'
          ? 'You will become its first administrator.'
          : 'Update how this community appears to its members.'
      }
    >
      {/* Mounted only while open so the form always starts from the right values. */}
      {open ? <CommunityForm mode={mode} initial={initial} onCancel={() => onOpenChange(false)} onSubmit={onSubmit} /> : null}
    </Dialog>
  );
}

function CommunityForm({
  mode,
  initial,
  onCancel,
  onSubmit,
}: Pick<CommunityFormDialogProps, 'mode' | 'initial' | 'onSubmit'> & { onCancel: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CommunityFormValues>({
    resolver: zodResolver(communitySchema),
    defaultValues: {
      name: initial?.name ?? '',
      communityType: (COMMUNITY_TYPES as readonly string[]).includes(initial?.communityType ?? '')
        ? (initial?.communityType as CommunityType)
        : 'equb',
      description: initial?.description ?? '',
      logoUrl: initial?.logoUrl ?? '',
      bannerUrl: initial?.bannerUrl ?? '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await onSubmit({
        name: values.name,
        communityType: values.communityType,
        ...(values.description ? { description: values.description } : {}),
        ...(values.logoUrl ? { logoUrl: values.logoUrl } : {}),
        bannerUrl: values.bannerUrl,
      });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}
      <TextField label="Community name" error={errors.name?.message} {...register('name')} />
      <SelectField label="Type" error={errors.communityType?.message} {...register('communityType')}>
        {COMMUNITY_TYPES.map((type) => (
          <option key={type} value={type}>
            {COMMUNITY_TYPE_LABELS[type]}
          </option>
        ))}
      </SelectField>
      <TextAreaField label="Description" optional error={errors.description?.message} {...register('description')} />
      <TextField
        label="Logo web address"
        optional
        inputMode="url"
        placeholder="https://"
        error={errors.logoUrl?.message}
        {...register('logoUrl')}
      />
      <TextField
        label="Banner web address"
        optional
        inputMode="url"
        placeholder="https://"
        error={errors.bannerUrl?.message}
        {...register('bannerUrl')}
      />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Create community' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
