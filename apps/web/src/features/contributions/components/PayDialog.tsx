import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { useStartCheckout } from '@/features/payments/payment.hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDateOnly } from '@/lib/formatting/date';
import { formatMoney } from '@/lib/formatting/money';
import { redirectTo } from '@/lib/navigation';
import { payAmountSchema } from '@/lib/validation/contribution.schemas';
import type { MyContribution } from '../contribution.types';

interface PayDialogProps {
  contribution: MyContribution | null;
  onOpenChange: (open: boolean) => void;
}

export function PayDialog({ contribution, onOpenChange }: PayDialogProps) {
  return (
    <Dialog
      open={contribution !== null}
      onOpenChange={onOpenChange}
      title="Payment summary"
      description="Review the details, then continue to our secure payment partner."
    >
      {contribution ? <PayForm key={contribution.id} contribution={contribution} onCancel={() => onOpenChange(false)} /> : null}
    </Dialog>
  );
}

function PayForm({ contribution, onCancel }: { contribution: MyContribution; onCancel: () => void }) {
  const checkout = useStartCheckout();
  const [serverError, setServerError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const outstanding = Number(contribution.outstandingAmount);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ amount: string }>({
    resolver: zodResolver(payAmountSchema(outstanding)),
    defaultValues: { amount: String(outstanding) },
  });

  const submit = handleSubmit(async ({ amount }) => {
    setServerError(null);

    try {
      const result = await checkout.mutateAsync({
        contributionId: contribution.id,
        // Only send an amount for partial payments; otherwise the backend charges the full balance.
        ...(Number(amount) !== outstanding ? { amount } : {}),
        returnUrl: `${window.location.origin}/payments/return`,
      });

      setRedirecting(true);
      redirectTo(result.checkoutUrl);
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  const busy = checkout.isPending || redirecting;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {serverError ? <Alert tone="danger">{serverError}</Alert> : null}

      <dl className="divide-y divide-line rounded-xl border border-line text-body">
        <div className="flex justify-between gap-3 px-4 py-3">
          <dt className="text-ink-secondary">Community</dt>
          <dd className="text-right font-medium text-ink">{contribution.community.name}</dd>
        </div>
        <div className="flex justify-between gap-3 px-4 py-3">
          <dt className="text-ink-secondary">Contribution</dt>
          <dd className="text-right text-ink">
            {formatDateOnly(contribution.periodStart)} – {formatDateOnly(contribution.periodEnd)}
          </dd>
        </div>
        <div className="flex justify-between gap-3 px-4 py-3">
          <dt className="text-ink-secondary">Still due</dt>
          <dd className="text-right text-h3 font-bold text-ink">{formatMoney(contribution.outstandingAmount, contribution.currency)}</dd>
        </div>
      </dl>

      <TextField
        label={`Amount to pay (${contribution.currency})`}
        inputMode="decimal"
        hint="Pay the full amount, or a smaller amount to pay in parts."
        error={errors.amount?.message}
        disabled={busy}
        {...register('amount')}
      />

      <p className="flex items-center gap-2 text-small text-ink-secondary">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        You will be taken to Chapa to complete the payment securely. You won&apos;t be charged until you confirm there.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {redirecting ? 'Redirecting…' : 'Continue to Payment'}
        </Button>
      </div>
    </form>
  );
}
