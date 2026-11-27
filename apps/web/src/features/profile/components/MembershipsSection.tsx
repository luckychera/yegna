import { Link } from 'react-router';

import { useMyCommunities } from '@/features/communities/community.hooks';
import { communityTypeLabel } from '@/features/communities/community.types';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/Avatar';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDate } from '@/lib/formatting/date';
import { humanize } from '@/lib/formatting/text';
import { SectionFrame } from './SectionFrame';

export function MembershipsSection() {
  const memberships = useMyCommunities({ limit: 100 });
  const items = memberships.data?.items ?? [];
  const hidden = (memberships.data?.pagination.total ?? items.length) - items.length;

  return (
    <SectionFrame
      title="My community memberships"
      description="A membership belongs to one community. Your Yegna account stays the same across all of them."
    >
      {memberships.isPending ? <ListSkeleton rows={3} /> : null}
      {memberships.isError ? <ErrorState error={memberships.error} onRetry={() => void memberships.refetch()} /> : null}
      {memberships.isSuccess && items.length === 0 ? (
        <EmptyState
          title="No community memberships"
          description="Join a community to get a membership number and a card."
          action={
            <Link to="/communities" className={buttonVariants({})}>
              Browse communities
            </Link>
          }
        />
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const roles = item.roles.map((role) => humanize(role.name));

            return (
              <li key={item.membership.id}>
                <Card>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={item.community.name} src={item.community.logoUrl} shape="rounded" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{item.community.name}</p>
                        <p className="text-small text-ink-secondary">{communityTypeLabel(item.community.communityType)}</p>
                        <dl className="mt-2 grid gap-x-6 gap-y-1 text-small sm:grid-cols-2">
                          <div>
                            <dt className="text-ink-muted">Membership number</dt>
                            <dd className="font-medium text-ink">{item.membership.membershipNumber ?? 'Not issued yet'}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Role</dt>
                            <dd className="font-medium text-ink">{roles.length > 0 ? roles.join(', ') : 'No assigned role'}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Joined</dt>
                            <dd className="font-medium text-ink">{formatDate(item.membership.joinedAt)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="membership" status={item.membership.status} />
                      <Link to={`/communities/${item.community.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                        Open community
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}
      {hidden > 0 ? (
        <p className="text-small text-ink-secondary">Showing the first {items.length} memberships.</p>
      ) : null}
      <Link to="/memberships" className="text-body font-medium text-primary hover:underline">
        Manage memberships
      </Link>
    </SectionFrame>
  );
}
