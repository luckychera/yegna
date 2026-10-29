import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { redirectTo } from '@/lib/navigation';
import { fail, mockApi, ok, pagination } from '@/test/api';
import { paymentFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const SUMMARY = [{ currency: 'ETB', count: 3, totalPaid: '15000.00', paidThisMonth: '5000.00', pendingAmount: '2000.00', refundedAmount: '0.00' }];

function mockPayments(items = [paymentFixture()]) {
  mockApi('get', '/payments/me', () => ok({ payments: items, summary: SUMMARY }, { pagination: pagination(items.length) }));
}

function checkoutPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    communityId: 'community-1',
    contributionId: 'contribution-1',
    provider: 'chapa',
    providerReference: 'CH-12345678',
    amount: '1000.00',
    currency: 'ETB',
    status: 'successful',
    paymentMethod: 'telebirr',
    checkoutUrl: null,
    initiatedAt: '2026-11-01T10:00:00.000Z',
    completedAt: '2026-11-01T10:02:00.000Z',
    failedAt: null,
    ...overrides,
  };
}

describe('PaymentsPage', () => {
  it('shows payment history with status, reference and summary totals', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([
      paymentFixture({ id: 'p1', status: 'successful', providerReference: 'CH-AAA111' }),
      paymentFixture({ id: 'p2', status: 'failed', checkoutUrl: null, providerReference: 'CH-BBB222' }),
      paymentFixture({ id: 'p3', status: 'refunded', providerReference: 'CH-CCC333' }),
    ]);
    renderApp('/payments');

    const table = await screen.findByRole('table', { name: 'My payments' });

    expect(within(table).getByText('CH-AAA111')).toBeInTheDocument();
    expect(within(within(table).getByText('CH-BBB222').closest('tr')!).getByText('Failed')).toBeInTheDocument();
    expect(within(within(table).getByText('CH-CCC333').closest('tr')!).getByText('Refunded')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Payment summary' });

    expect(summary).toHaveTextContent('ETB 15,000');
    expect(summary).toHaveTextContent('ETB 5,000');
    expect(summary).toHaveTextContent('ETB 2,000');
  });

  it('offers no actions for finished payments and never exposes lifecycle controls', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ status: 'successful' }), paymentFixture({ id: 'p2', status: 'failed' })]);
    renderApp('/payments');

    await screen.findByRole('table', { name: 'My payments' });
    expect(screen.queryByRole('button', { name: /complete payment|check status/i })).not.toBeInTheDocument();
    for (const forbidden of [/mark.*success/i, /mark.*fail/i, /process/i, /refund/i]) {
      expect(screen.queryByRole('button', { name: forbidden })).not.toBeInTheDocument();
    }
  });

  it('lets the member resume a pending checkout', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ status: 'pending', completedAt: null, checkoutUrl: 'https://checkout.chapa.co/resume-me' })]);
    renderApp('/payments');

    await user.click(await screen.findByRole('button', { name: /Complete payment of ETB 1,000/ }));

    expect(redirectTo).toHaveBeenCalledWith('https://checkout.chapa.co/resume-me');
  });

  it('checks a pending payment with the backend and reports the outcome', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ status: 'pending', completedAt: null, checkoutUrl: 'https://x.test', providerReference: 'CH-PEND' })]);
    mockApi('post', '/payments/payment-1/verify', () => ok({ payment: checkoutPayment({ status: 'successful' }), outcome: 'successful' }));
    renderApp('/payments');

    await user.click(await screen.findByRole('button', { name: /Check status of payment CH-PEND/ }));

    expect(await screen.findByText('Payment confirmed')).toBeInTheDocument();
  });

  it('is honest when the provider has not confirmed yet', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ status: 'pending', completedAt: null, providerReference: 'CH-PEND' })]);
    mockApi('post', '/payments/payment-1/verify', () => ok({ payment: checkoutPayment({ status: 'pending' }), outcome: 'pending' }));
    renderApp('/payments');

    await user.click(await screen.findByRole('button', { name: /Check status of payment CH-PEND/ }));

    expect(await screen.findByText('Still waiting for confirmation from the payment provider')).toBeInTheDocument();
  });

  it('falls back to the Yegna transaction reference when the provider reference is not stored', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ id: 'abc-123', providerReference: null })]);
    renderApp('/payments');

    expect(await screen.findByText('YEGNA-PAY-abc-123')).toBeInTheDocument();
  });

  it('explains an empty history and points to contributions', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([]);
    renderApp('/payments');

    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View contributions' })).toHaveAttribute('href', '/contributions');
  });
});

describe('PaymentReturnPage', () => {
  it('confirms success with amount, community, reference and date', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([paymentFixture({ id: 'payment-1', providerReference: 'CH-12345678' })]);
    mockApi('post', '/payments/payment-1/verify', () => ok({ payment: checkoutPayment(), outcome: 'successful' }));
    renderApp('/payments/return?paymentId=payment-1');

    expect(await screen.findByRole('heading', { name: 'Payment Successful' })).toBeInTheDocument();
    expect(screen.getByText('ETB 1,000')).toBeInTheDocument();
    expect(await screen.findByText('Bole Community')).toBeInTheDocument();
    expect(screen.getByText('CH-12345678')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Contribution' })).toHaveAttribute('href', '/contributions');
    expect(screen.getByRole('link', { name: 'Done' })).toHaveAttribute('href', '/dashboard');
  });

  it('never claims success from the redirect alone: it asks the backend', async () => {
    let verified = false;

    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () => {
      verified = true;

      return ok({ payment: checkoutPayment({ status: 'pending', completedAt: null }), outcome: 'pending' });
    });
    // the provider may append its own "status=success" parameters; they must be ignored
    renderApp('/payments/return?paymentId=payment-1&status=success&trx_ref=abc');

    expect(await screen.findByRole('heading', { name: 'Waiting for confirmation' })).toBeInTheDocument();
    expect(verified).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Payment Successful' })).not.toBeInTheDocument();
  });

  it('lets the member check again and then see the confirmed result', async () => {
    const user = userEvent.setup();
    let calls = 0;

    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () => {
      calls += 1;

      return calls === 1
        ? ok({ payment: checkoutPayment({ status: 'pending', completedAt: null, checkoutUrl: 'https://x.test/resume' }), outcome: 'pending' })
        : ok({ payment: checkoutPayment(), outcome: 'successful' });
    });
    renderApp('/payments/return?paymentId=payment-1');

    await user.click(await screen.findByRole('button', { name: 'Check again' }));

    expect(await screen.findByRole('heading', { name: 'Payment Successful' })).toBeInTheDocument();
  });

  it('offers to resume checkout while still pending', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () =>
      ok({ payment: checkoutPayment({ status: 'pending', completedAt: null, checkoutUrl: 'https://x.test/resume' }), outcome: 'pending' }),
    );
    renderApp('/payments/return?paymentId=payment-1');

    await user.click(await screen.findByRole('button', { name: 'Resume payment' }));

    expect(redirectTo).toHaveBeenCalledWith('https://x.test/resume');
  });

  it('reports a failed payment without sounding like money was taken', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () => ok({ payment: checkoutPayment({ status: 'failed', completedAt: null }), outcome: 'failed' }));
    renderApp('/payments/return?paymentId=payment-1');

    expect(await screen.findByRole('heading', { name: 'Payment not completed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/contributions');
  });

  it('shows a friendly retryable error when the provider cannot be reached', async () => {
    const user = userEvent.setup();
    let ok502 = true;

    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () =>
      ok502 ? fail(502, 'PAYMENT_VERIFICATION_UNAVAILABLE', 'provider down') : ok({ payment: checkoutPayment(), outcome: 'successful' }),
    );
    renderApp('/payments/return?paymentId=payment-1');

    expect(await screen.findByText("We couldn't confirm your payment yet")).toBeInTheDocument();
    expect(screen.getByText(/couldn't confirm your payment with the payment provider/i)).toBeInTheDocument();

    ok502 = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Payment Successful' })).toBeInTheDocument();
  });

  it('flags a paid-but-unapplied payment for review, with a reference and no misleading retry', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/payment-1/verify', () =>
      fail(409, 'PAYMENT_NEEDS_REVIEW', 'The provider has the money but the contribution cannot absorb it'),
    );
    renderApp('/payments/return?paymentId=payment-1');

    expect(await screen.findByText('Your payment needs attention')).toBeInTheDocument();
    expect(screen.getByText(/contact your community administrator/i)).toBeInTheDocument();
    expect(screen.getByText('YEGNA-PAY-payment-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('handles a missing payment reference', async () => {
    signInAs();
    mockWorkspace();
    renderApp('/payments/return');

    expect(await screen.findByText('No payment to show')).toBeInTheDocument();
  });

  it('shows not found when the payment belongs to someone else', async () => {
    signInAs();
    mockWorkspace();
    mockPayments([]);
    mockApi('post', '/payments/other/verify', () => fail(404, 'PAYMENT_NOT_FOUND', 'Payment transaction not found'));
    renderApp('/payments/return?paymentId=other');

    expect(await screen.findByText("We couldn't find what you were looking for.")).toBeInTheDocument();
  });
});
