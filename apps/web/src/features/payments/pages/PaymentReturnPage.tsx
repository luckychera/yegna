import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Clock } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';

import { EmptyState, ErrorState, PageLoading } from '@/components/feedback/states';
import { isApiError } from '@/lib/api/errors';
import { Button } from '@/components/ui/Button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { redirectTo } from '@/lib/navigation';
import { paymentApi } from '../payment.api';
import { paymentReference } from '../payment-reference';
import { useMyPayments } from '../payment.hooks';

const POLL_MS = 5000;
const MAX_POLLS = 12;

/**
 * Where the payment provider sends the member back to. The browser's claim of success is never
 * trusted: the backend asks the provider and we show what it reports, polling while pending.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const paymentId = params.get('paymentId') ?? '';
  const queryClient = useQueryClient();

  const verification = useQuery({
    queryKey: ['payments', 'verify', paymentId],
    queryFn: () => paymentApi.verify(paymentId),
    enabled: Boolean(paymentId),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.outcome === 'pending' && query.state.dataUpdateCount < MAX_POLLS ? POLL_MS : false,
  });

  const outcome = verification.data?.outcome;
  const payment = verification.data?.payment;
  const settled = outcome !== undefined && outcome !== 'pending';

  // Receipts show the community name, which the verification response does not include.
  const history = useMyPayments({ limit: 50 });
  const receipt = history.data?.items.find((item) => item.id === paymentId);

  useEffect(() => {
    if (settled) {
      void queryClient.invalidateQueries({ queryKey: ['contributions'] });
      void queryClient.invalidateQueries({ queryKey: ['payments', 'mine'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }, [settled, queryClient]);

  if (!paymentId) {
    return (
      <EmptyState
        title="No payment to show"
        description="Open this page from a payment to see its result."
        action={
          <Link to="/payments" className={buttonVariants({})}>
            View payments
          </Link>
        }
      />
    );
  }

  if (verification.isPending) {
    return <PageLoading label="Confirming your payment" />;
  }

  if (verification.isError) {
    const needsReview = isApiError(verification.error) && verification.error.code === 'PAYMENT_NEEDS_REVIEW';

    return (
      <div className="space-y-3">
        <ErrorState
          error={verification.error}
          title={needsReview ? 'Your payment needs attention' : "We couldn't confirm your payment yet"}
          onRetry={needsReview ? undefined : () => void verification.refetch()}
        />
        {needsReview ? (
          <p className="text-center text-body text-ink-secondary">
            Payment reference: <span className="font-mono text-small break-all">{`YEGNA-PAY-${paymentId}`}</span>
          </p>
        ) : null}
      </div>
    );
  }

  const waiting = outcome === 'pending' || outcome === 'processing';

  return (
    <div className="mx-auto max-w-lg py-6" aria-live="polite">
      <Card>
        <CardContent className="space-y-5 text-center">
          {outcome === 'successful' ? (
            <>
              <Icon tone="success">
                <CircleCheck className="h-8 w-8" aria-hidden />
              </Icon>
              <h1 className="text-h2 font-bold text-ink">Payment Successful</h1>
              <p className="text-body text-ink-secondary">Thank you. Your contribution has been updated.</p>
            </>
          ) : null}
          {outcome === 'failed' || outcome === 'cancelled' ? (
            <>
              <Icon tone="danger">
                <CircleX className="h-8 w-8" aria-hidden />
              </Icon>
              <h1 className="text-h2 font-bold text-ink">Payment not completed</h1>
              <p className="text-body text-ink-secondary">This payment did not go through. You can try again from your contributions.</p>
            </>
          ) : null}
          {waiting ? (
            <>
              <Icon tone="warning">
                <Clock className="h-8 w-8" aria-hidden />
              </Icon>
              <h1 className="text-h2 font-bold text-ink">Waiting for confirmation</h1>
              <p className="text-body text-ink-secondary">
                We haven&apos;t received confirmation from the payment provider yet. If you completed the payment, it can take a moment to arrive.
              </p>
            </>
          ) : null}

          {payment ? (
            <dl className="divide-y divide-line rounded-xl border border-line text-left text-body">
              <Row label="Amount" value={formatMoney(payment.amount, payment.currency)} strong />
              {receipt ? <Row label="Community" value={receipt.community.name} /> : null}
              <Row label="Reference" value={payment.providerReference ?? receipt?.providerReference ?? paymentReference(payment)} mono />
              <Row label="Date" value={formatDateTime(payment.completedAt ?? payment.initiatedAt)} />
            </dl>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {outcome === 'successful' ? (
              <>
                <Link to="/contributions" className={buttonVariants({ variant: 'secondary' })}>
                  View Contribution
                </Link>
                <Link to="/dashboard" className={buttonVariants({})}>
                  Done
                </Link>
              </>
            ) : null}
            {waiting ? (
              <>
                <Button variant="secondary" loading={verification.isFetching} onClick={() => void verification.refetch()}>
                  Check again
                </Button>
                {payment?.checkoutUrl ? (
                  <Button onClick={() => redirectTo(payment.checkoutUrl!)}>Resume payment</Button>
                ) : null}
              </>
            ) : null}
            {outcome === 'failed' || outcome === 'cancelled' ? (
              <>
                <Link to="/payments" className={buttonVariants({ variant: 'secondary' })}>
                  View payments
                </Link>
                <Link to="/contributions" className={buttonVariants({})}>
                  Try again
                </Link>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Icon({ tone, children }: { tone: 'success' | 'danger' | 'warning'; children: React.ReactNode }) {
  const styles = { success: 'bg-success-soft text-success-ink', danger: 'bg-danger-soft text-danger-ink', warning: 'bg-warning-soft text-warning-ink' };

  return <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${styles[tone]}`}>{children}</span>;
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 px-4 py-3">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={`text-right text-ink ${strong ? 'text-h3 font-bold' : 'font-medium'} ${mono ? 'font-mono text-small' : ''}`}>{value}</dd>
    </div>
  );
}
