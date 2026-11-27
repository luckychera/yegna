import { Link, useParams } from 'react-router';

import { useTheme } from '@/app/providers/ThemeProvider';
import { useCardVerification } from '@/features/account/account.hooks';
import { communityTypeLabel } from '@/features/communities/community.types';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { StatusBadge } from '@/components/data-display/StatusBadge';
import { ErrorState, Skeleton } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/Avatar';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { isApiError } from '@/lib/api/errors';
import { formatDate, formatDateTime } from '@/lib/formatting/date';

export function VerifyCardPage() {
  const { code = '' } = useParams();
  const { resolvedTheme } = useTheme();
  const verification = useCardVerification(code);
  const card = verification.data;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-10">
      <BrandLogo tone={resolvedTheme === 'dark' ? 'light' : 'dark'} size="md" />
      <header>
        <h1 className="text-h2 font-semibold text-ink">Membership check</h1>
        <p className="mt-1 text-body text-ink-secondary">
          This page confirms a Yegna membership card. It never shows a Fayda number or contact details.
        </p>
      </header>

      {verification.isLoading ? <Skeleton className="h-48 w-full" /> : null}
      {verification.isError ? (
        <ErrorState
          error={verification.error}
          title={isApiError(verification.error) && verification.error.status === 404 ? 'Card not found' : undefined}
          onRetry={() => void verification.refetch()}
        />
      ) : null}
      {card ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={card.community.name} src={card.community.logoUrl} shape="rounded" size="lg" />
              <div className="min-w-0">
                <p className="truncate text-h3 font-semibold text-ink">{card.community.name}</p>
                <p className="text-small text-ink-secondary">{communityTypeLabel(card.community.communityType)}</p>
              </div>
            </div>
            <StatusBadge kind="membership" status={card.status} />
            {card.valid ? (
              <dl className="grid gap-3 border-t border-line pt-4 text-body">
                <div>
                  <dt className="text-small text-ink-secondary">Member</dt>
                  <dd className="font-medium text-ink">{card.holderName}</dd>
                </div>
                <div>
                  <dt className="text-small text-ink-secondary">Membership number</dt>
                  <dd className="font-mono font-semibold tracking-wide text-ink">{card.membershipNumber}</dd>
                </div>
                <div>
                  <dt className="text-small text-ink-secondary">Member since</dt>
                  <dd className="font-medium text-ink">{formatDate(card.memberSince)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-body text-ink-secondary">This membership is not active, so the card cannot be confirmed.</p>
            )}
            <p className="text-small text-ink-muted">Checked {formatDateTime(card.checkedAt)}</p>
          </CardContent>
        </Card>
      ) : null}

      <Link to="/login" className={buttonVariants({ variant: 'secondary' })}>
        Sign in to Yegna
      </Link>
    </main>
  );
}
