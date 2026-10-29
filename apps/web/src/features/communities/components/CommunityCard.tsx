import { Users } from 'lucide-react';
import { Link } from 'react-router';

import { StatusBadge } from '@/components/data-display/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { communityTypeLabel, type CommunitySummary, type MembershipStatus } from '../community.types';

export interface CommunityCardModel {
  community: CommunitySummary;
  membership: { id: string; status: MembershipStatus } | null;
}

interface CommunityCardProps {
  model: CommunityCardModel;
  joining: boolean;
  onJoin: (community: CommunitySummary) => void;
}

export function CommunityCard({ model, joining, onJoin }: CommunityCardProps) {
  const { community, membership } = model;
  const status = membership?.status;
  const canJoin = !status || status === 'left' || status === 'rejected';

  return (
    <article className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-start gap-3">
        <Avatar name={community.name} src={community.logoUrl} size="lg" shape="rounded" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-h3 font-semibold text-ink">
            <Link to={`/communities/${community.id}`} state={{ community }} className="hover:text-primary hover:underline">
              {community.name}
            </Link>
          </h3>
          <Badge tone="neutral" className="mt-1">
            {communityTypeLabel(community.communityType)}
          </Badge>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-body text-ink-secondary">
        {community.description || 'No description yet.'}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <span className="flex items-center gap-1.5 text-small text-ink-secondary">
          <Users className="h-4 w-4" aria-hidden />
          {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
        </span>

        <div className="flex items-center gap-2">
          {status && status !== 'left' ? <StatusBadge kind="membership" status={status} /> : null}
          {canJoin ? (
            <Button size="sm" loading={joining} onClick={() => onJoin(community)} aria-label={`Join ${community.name}`}>
              Join
            </Button>
          ) : (
            <Link to={`/communities/${community.id}`} state={{ community }} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              View
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
