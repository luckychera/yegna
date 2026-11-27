import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { getErrorMessage } from '@/lib/api/errors';
import { announcementSchema, toEventInput, type AnnouncementFormValues } from '@/lib/validation/announcement.schema';
import { useCreateAnnouncement, useUpdateAnnouncement } from '../announcement.hooks';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_LABELS, type Announcement } from '../announcement.types';

interface Props {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement?: Announcement | null;
}

function defaults(announcement?: Announcement | null): AnnouncementFormValues {
  return {
    title: announcement?.title ?? '',
    body: announcement?.body ?? '',
    category: announcement?.category ?? 'update',
    eventAt: toEventInput(announcement?.eventAt ?? null),
    location: announcement?.location ?? '',
    isPinned: announcement?.isPinned ?? false,
  };
}

export function AnnouncementFormDialog({ communityId, open, onOpenChange, announcement }: Props) {
  const create = useCreateAnnouncement(communityId);
  const update = useUpdateAnnouncement(communityId);
  const [serverError, setServerError] = useState<string | null>(null);
  const editing = Boolean(announcement);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: defaults(announcement),
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    const input = {
      title: values.title,
      body: values.body,
      category: values.category,
      eventAt: values.eventAt ? new Date(values.eventAt).toISOString() : null,
      location: values.location || null,
      isPinned: values.isPinned,
    };

    try {
      if (announcement) {
        await update.mutateAsync({ id: announcement.id, input });
        toast.success('Announcement updated');
      } else {
        await create.mutateAsync(input);
        toast.success('Announcement published');
      }

      onOpenChange(false);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
      title={editing ? 'Edit announcement' : 'New announcement'}
      description={editing ? 'Update this announcement. Members are not notified again.' : 'Active members of this community will be notified, unless they turned announcements off.'}
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="announcement-form" loading={isSubmitting}>
            {editing ? 'Save changes' : 'Publish'}
          </Button>
        </>
      }
    >
      {serverError ? (
        <Alert tone="danger" className="mb-4">
          {serverError}
        </Alert>
      ) : null}
      <form id="announcement-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <TextField label="Title" error={errors.title?.message} {...register('title')} />
        <TextAreaField label="Message" error={errors.body?.message} {...register('body')} />
        <SelectField label="Category" error={errors.category?.message} {...register('category')}>
          {ANNOUNCEMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {ANNOUNCEMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Event time"
          type="datetime-local"
          optional
          hint="For a meeting or event. Leave blank for a general notice."
          error={errors.eventAt?.message}
          {...register('eventAt')}
        />
        <TextField label="Location" optional error={errors.location?.message} {...register('location')} />
        <label className="flex items-center gap-2 text-body text-ink">
          <input type="checkbox" className="h-4 w-4 accent-primary" {...register('isPinned')} />
          Pin to the top of the community feed
        </label>
      </form>
    </Dialog>
  );
}
