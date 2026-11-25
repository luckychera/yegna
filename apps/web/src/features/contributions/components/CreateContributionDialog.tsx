import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { useCommunityMembers } from '@/features/memberships/membership.hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { createContributionSchema, type CreateContributionValues } from '@/lib/validation/contribution.schemas';
import { contributionApi } from '../contribution.api';

interface CreateContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Communities where the backend grants contributions.create. */
  communities: { id: string; name: string; canViewMembers: boolean }[];
  defaultCommunityId?: string;
}

export function CreateContributionDialog({ open, onOpenChange, communities, defaultCommunityId }: CreateContributionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New contribution"
      description="Create a contribution for one member of the community."
      className="max-w-lg"
    >
      {open ? (
        <ContributionForm communities={communities} defaultCommunityId={defaultCommunityId} onClose={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  );
}

function ContributionForm({
  communities,
  defaultCommunityId,
  onClose,
}: Pick<CreateContributionDialogProps, 'communities' | 'defaultCommunityId'> & { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateContributionValues>({
    resolver: zodResolver(createContributionSchema),
    defaultValues: {
      communityId: defaultCommunityId ?? (communities.length === 1 ? communities[0].id : ''),
      membershipId: '',
      contributionPeriodStart: '',
      contributionPeriodEnd: '',
      dueDate: '',
      amount: '',
      notes: '',
    },
  });

  const communityId = useWatch({ control, name: 'communityId' });
  const selected = communities.find((community) => community.id === communityId);
  const members = useCommunityMembers(communityId, Boolean(selected?.canViewMembers));
  const activeMembers = (members.data ?? []).filter((member) => member.status === 'active');

  const create = useMutation({
    mutationFn: (values: CreateContributionValues) =>
      contributionApi.create(values.communityId, {
        membershipId: values.membershipId,
        contributionPeriodStart: values.contributionPeriodStart,
        contributionPeriodEnd: values.contributionPeriodEnd,
        dueDate: values.dueDate,
        amount: values.amount,
        ...(values.notes ? { notes: values.notes } : {}),
      }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contributions'] }),
      queryClient.invalidateQueries({ queryKey: ['communities'] }),
    ]),
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);

    try {
      await create.mutateAsync(values);
      toast.success('Contribution created successfully');
      onClose();
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}

      <SelectField
        label="Community"
        error={errors.communityId?.message}
        {...register('communityId', { onChange: () => setValue('membershipId', '') })}
      >
        <option value="">Select a community</option>
        {communities.map((community) => (
          <option key={community.id} value={community.id}>
            {community.name}
          </option>
        ))}
      </SelectField>

      {selected && !selected.canViewMembers ? (
        <Alert tone="warning">You don&apos;t have permission to see this community&apos;s member list, so a member can&apos;t be chosen.</Alert>
      ) : null}
      {members.isError ? <Alert tone="danger">{getErrorMessage(members.error)}</Alert> : null}

      <SelectField
        label="Member"
        disabled={!selected || members.isPending}
        error={errors.membershipId?.message}
        hint={selected && members.isSuccess && activeMembers.length === 0 ? 'This community has no active members yet.' : undefined}
        {...register('membershipId')}
      >
        <option value="">{members.isPending && selected?.canViewMembers ? 'Loading members…' : 'Select a member'}</option>
        {activeMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Period start" type="date" error={errors.contributionPeriodStart?.message} {...register('contributionPeriodStart')} />
        <TextField label="Period end" type="date" error={errors.contributionPeriodEnd?.message} {...register('contributionPeriodEnd')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Due date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
        <TextField label="Amount (ETB)" inputMode="decimal" placeholder="1000" error={errors.amount?.message} {...register('amount')} />
      </div>
      <TextAreaField label="Description" optional error={errors.notes?.message} {...register('notes')} />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Create contribution
        </Button>
      </div>
    </form>
  );
}
