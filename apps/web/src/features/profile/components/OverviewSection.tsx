import { Link } from 'react-router';

import type { UserProfile } from '@/features/auth/auth.types';
import { useIdentityDetails } from '@/features/account/account.hooks';
import { ErrorState, Skeleton } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/formatting/date';
import { fullName, humanize } from '@/lib/formatting/text';
import { accountSectionPath } from '../account-sections';
import { identityStatus } from '../identity-status';
import { SectionFrame } from './SectionFrame';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-small text-ink-secondary">{label}</dt>
      <dd className="mt-0.5 text-body break-words text-ink">{value}</dd>
    </div>
  );
}

export function OverviewSection({ profile }: { profile: UserProfile }) {
  const identity = useIdentityDetails();
  const name = fullName({
    displayName: profile.profile?.displayName,
    firstName: profile.profile?.firstName,
    lastName: profile.profile?.lastName,
  });
  const fayda = identityStatus(identity.data?.verificationStatus ?? null);

  return (
    <SectionFrame
      title="Overview"
      description="This is your Yegna account. Each community keeps its own membership, number and role."
    >
      <Card>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={name} src={profile.profile?.avatarUrl} size="xl" />
              <div className="min-w-0">
                <p className="truncate text-h2 font-semibold text-ink">{name}</p>
                <p className="text-body text-ink-secondary">Registered {formatDate(profile.user.createdAt)}</p>
              </div>
            </div>
            <Link to={accountSectionPath('personal')} className={buttonVariants({})}>
              Edit profile
            </Link>
          </div>

          <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <Fact label="Email" value={profile.user.email ?? 'Not provided'} />
            <Fact label="Phone" value={profile.user.phone ?? 'Not provided'} />
            <Fact label="Account status" value={humanize(profile.user.status)} />
            <Fact label="Display name" value={profile.profile?.displayName?.trim() || 'Same as your name'} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-small text-ink-secondary">Fayda verification</p>
            {identity.isPending ? (
              <Skeleton className="mt-2 h-6 w-28" />
            ) : identity.isError ? (
              <div className="mt-2">
                <ErrorState error={identity.error} onRetry={() => void identity.refetch()} className="px-4 py-6" />
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={fayda.tone}>{fayda.label}</Badge>
                {identity.data?.verificationMode === 'mock' ? (
                  <Badge tone="warning">Development check</Badge>
                ) : null}
              </div>
            )}
          </div>
          <Link to={accountSectionPath('identity')} className={buttonVariants({ variant: 'secondary' })}>
            View identity
          </Link>
        </CardContent>
      </Card>
    </SectionFrame>
  );
}
