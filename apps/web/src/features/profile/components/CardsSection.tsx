import { useState } from 'react';
import { Link } from 'react-router';

import { useMembershipCards, useRegenerateCard } from '@/features/account/account.hooks';
import type { MembershipCard } from '@/features/account/account.types';
import { communityTypeLabel } from '@/features/communities/community.types';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/feedback/states';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { formatDate } from '@/lib/formatting/date';
import { humanize } from '@/lib/formatting/text';
import { runAction } from '@/lib/api/action';
import { CardQr } from './CardQr';
import { SectionFrame } from './SectionFrame';

function MembershipCardView({ card, onRegenerate }: { card: MembershipCard; onRegenerate: () => void }) {
  const roles = card.roles.map((role) => humanize(role));

  return (
    <article aria-label={`Membership card for ${card.community.name}`} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between bg-brand-forest px-5 py-4">
        <BrandLogo tone="light" size="sm" />
        <span className="text-small font-medium tracking-wide text-white/80">Membership card</span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 space-y-3">
          <div>
            <p className="truncate text-h3 font-semibold text-ink">{card.holder.name}</p>
            <p className="text-body text-ink-secondary">{card.community.name}</p>
            <p className="text-small text-ink-muted">{communityTypeLabel(card.community.communityType)}</p>
          </div>
          <dl className="grid gap-3 text-small sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Membership number</dt>
              <dd className="font-mono text-body font-semibold tracking-wide text-ink">{card.membershipNumber ?? 'Not issued'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Issued</dt>
              <dd className="font-medium text-ink">{formatDate(card.issuedAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Role</dt>
              <dd className="font-medium text-ink">{roles.length > 0 ? roles.join(', ') : 'No assigned role'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Status</dt>
              <dd className="mt-1">
                <StatusBadge kind="membership" status={card.status} />
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link to={`/communities/${card.community.id}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              Open community
            </Link>
            <Button variant="ghost" size="sm" onClick={onRegenerate}>
              Issue a new code
            </Button>
          </div>
        </div>
        {card.verificationCode ? <CardQr code={card.verificationCode} /> : (
          <p className="max-w-48 text-small text-ink-secondary">A verification code has not been issued for this membership yet.</p>
        )}
      </div>
      <p className="border-t border-line px-5 py-3 text-small text-ink-muted">
        The QR code confirms this membership only. It contains no Fayda number, password or payment data.
      </p>
    </article>
  );
}

export function CardsSection() {
  const cards = useMembershipCards();
  const regenerate = useRegenerateCard();
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = cards.data?.find((card) => card.membershipId === targetId) ?? null;

  async function confirmRegenerate() {
    if (!target) return;

    const ok = await runAction(
      () => regenerate.mutateAsync(target.membershipId),
      'A new verification code was issued. The previous QR code no longer works.',
    );

    if (ok) setTargetId(null);
  }

  return (
    <SectionFrame
      title="Membership cards"
      description="One card for each active membership. The membership number is issued by Yegna and is separate from your Fayda number."
    >
      {cards.isPending ? <ListSkeleton rows={2} /> : null}
      {cards.isError ? <ErrorState error={cards.error} onRetry={() => void cards.refetch()} /> : null}
      {cards.isSuccess && cards.data.length === 0 ? (
        <EmptyState
          title="No membership cards yet"
          description="A card is issued when a community approves your membership."
          action={
            <Link to="/communities" className={buttonVariants({})}>
              Browse communities
            </Link>
          }
        />
      ) : null}
      {cards.data && cards.data.length > 0 ? (
        <ul className="space-y-4">
          {cards.data.map((card) => (
            <li key={card.membershipId}>
              <MembershipCardView card={card} onRegenerate={() => setTargetId(card.membershipId)} />
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !regenerate.isPending) setTargetId(null);
        }}
        title={target ? `Replace the code for ${target.community.name}?` : 'Replace the code?'}
        description="The QR code on this card will stop working. Anyone who saved it will no longer be able to confirm this membership. Your membership number stays the same."
        confirmLabel="Issue a new code"
        tone="danger"
        loading={regenerate.isPending}
        onConfirm={confirmRegenerate}
      />
    </SectionFrame>
  );
}
