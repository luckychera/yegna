import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { redirectTo } from '@/lib/navigation';
import { fail, mockApi, ok, pagination } from '@/test/api';
import { ADMIN_PERMISSIONS, contributionFixture, memberRow, myCommunityFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const SUMMARY = [
  { currency: 'ETB', count: 3, totalAmount: '3000.00', paidAmount: '1000.00', outstandingAmount: '2000.00', pendingCount: 1, overdueCount: 1 },
];

function mockContributions(items = [contributionFixture()], summary = SUMMARY) {
  mockApi('get', '/contributions/me', () => ok({ contributions: items, summary }, { pagination: pagination(items.length) }));
}

describe('ContributionsPage', () => {
  it('shows what the member owes with clear status, summary and due information', async () => {
    signInAs();
    mockWorkspace();
    mockContributions([
      contributionFixture({ id: 'a', status: 'pending', dueDate: '2000-01-10T00:00:00.000Z', isOverdue: true, community: { id: 'c1', name: 'Late Equb', logoUrl: null } }),
      contributionFixture({ id: 'b', status: 'paid', paidAmount: '1000.00', outstandingAmount: '0.00', community: { id: 'c1', name: 'Settled Equb', logoUrl: null } }),
    ]);
    renderApp('/contributions');

    const table = await screen.findByRole('table', { name: 'My contributions' });

    // unpaid + past due reads "Overdue" even though the stored status is "pending"
    expect(within(within(table).getByText('Late Equb').closest('tr')!).getByText('Overdue')).toBeInTheDocument();
    expect(within(within(table).getByText('Settled Equb').closest('tr')!).getByText('Paid')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Contribution summary' });

    expect(summary).toHaveTextContent('ETB 1,000');
    expect(summary).toHaveTextContent('ETB 2,000');
  });

  it('offers Pay only where something is still due', async () => {
    signInAs();
    mockWorkspace();
    mockContributions([
      contributionFixture({ id: 'a', community: { id: 'c1', name: 'Open Equb', logoUrl: null } }),
      contributionFixture({ id: 'b', status: 'paid', outstandingAmount: '0.00', community: { id: 'c1', name: 'Paid Equb', logoUrl: null } }),
      contributionFixture({ id: 'c', status: 'waived', outstandingAmount: '0.00', community: { id: 'c1', name: 'Waived Equb', logoUrl: null } }),
    ]);
    renderApp('/contributions');

    await screen.findByRole('table', { name: 'My contributions' });
    expect(screen.getAllByRole('button', { name: /^Pay / })).toHaveLength(1);
  });

  it('starts a real checkout for the full amount and sends the user to the payment provider', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> = {};

    signInAs();
    mockWorkspace();
    mockContributions();
    mockApi('post', '/payments/checkout', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;

      return ok({ payment: { id: 'pay-1' }, checkoutUrl: 'https://checkout.chapa.co/checkout/payment/YEGNA-PAY-pay-1' }, {}, 201);
    });
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: /^Pay Bole Community/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment summary' });

    expect(within(dialog).getByText('Bole Community')).toBeInTheDocument();
    expect(within(dialog).getAllByText('ETB 1,000').length).toBeGreaterThan(0);

    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://checkout.chapa.co/checkout/payment/YEGNA-PAY-pay-1'));
    // full payment: no amount is sent, the backend charges the remaining balance
    expect(body).toEqual({ contributionId: 'contribution-1', returnUrl: `${window.location.origin}/payments/return` });
  });

  it('lets the member pay part of what is due', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> = {};

    signInAs();
    mockWorkspace();
    mockContributions();
    mockApi('post', '/payments/checkout', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;

      return ok({ payment: { id: 'pay-1' }, checkoutUrl: 'https://checkout.chapa.co/x' }, {}, 201);
    });
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: /^Pay Bole Community/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment summary' });
    const amount = within(dialog).getByLabelText('Amount to pay (ETB)');

    await user.clear(amount);
    await user.type(amount, '250');
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalled());
    expect(body.amount).toBe('250');
  });

  it('blocks amounts above the balance or that are not valid before calling the API', async () => {
    const user = userEvent.setup();
    let called = false;

    signInAs();
    mockWorkspace();
    mockContributions();
    mockApi('post', '/payments/checkout', () => {
      called = true;

      return ok({});
    });
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: /^Pay Bole Community/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment summary' });
    const amount = within(dialog).getByLabelText('Amount to pay (ETB)');

    await user.clear(amount);
    await user.type(amount, '1500');
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));
    expect(await within(dialog).findByText('That is more than the amount still due.')).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '12.345');
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));
    expect(await within(dialog).findByText('Use a number with up to 2 decimals.')).toBeInTheDocument();

    expect(called).toBe(false);
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('keeps the user in the dialog with a clear message if checkout cannot start', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockContributions();
    mockApi('post', '/payments/checkout', () => fail(400, 'CONTRIBUTION_ALREADY_SETTLED', 'Contribution is already settled'));
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: /^Pay Bole Community/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment summary' });

    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));

    expect(await within(dialog).findByText('This contribution has already been paid in full.')).toBeInTheDocument();
    expect(redirectTo).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Continue to Payment' })).toBeEnabled();
  });

  it('explains an already-open payment instead of starting a second one', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockContributions();
    mockApi('post', '/payments/checkout', () => fail(409, 'OPEN_PAYMENT_EXISTS', 'You already have a payment in progress'));
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: /^Pay Bole Community/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Payment summary' });

    await user.click(within(dialog).getByRole('button', { name: 'Continue to Payment' }));

    expect(await within(dialog).findByText(/already have a payment in progress/i)).toBeInTheDocument();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('sends filters to the API', async () => {
    const user = userEvent.setup();
    const queries: string[] = [];

    signInAs();
    mockWorkspace();
    mockApi('get', '/contributions/me', ({ request }) => {
      queries.push(new URL(request.url).search);

      return ok({ contributions: [contributionFixture()], summary: SUMMARY }, { pagination: pagination(1) });
    });
    renderApp('/contributions');

    await screen.findByRole('table', { name: 'My contributions' });
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'paid');

    await waitFor(() => expect(queries.some((query) => query.includes('status=paid'))).toBe(true));
  });

  it('explains an empty list and offers a way out of a filtered empty list', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/contributions/me', ({ request }) =>
      new URL(request.url).searchParams.get('status')
        ? ok({ contributions: [], summary: [] }, { pagination: pagination(0) })
        : ok({ contributions: [], summary: [] }, { pagination: pagination(0) }),
    );
    renderApp('/contributions');

    expect(await screen.findByText('No contributions yet')).toBeInTheDocument();
    expect(screen.getByText(/When a community administrator creates a contribution for you/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'paid');
    expect(await screen.findByText('No contributions match your filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('No contributions yet')).toBeInTheDocument();
  });

  it('hides "New Contribution" from members who lack contributions.create', async () => {
    signInAs();
    mockWorkspace({ permissions: ['contributions.view'] });
    mockContributions();
    renderApp('/contributions');

    await screen.findByRole('table', { name: 'My contributions' });
    expect(screen.queryByRole('button', { name: 'New Contribution' })).not.toBeInTheDocument();
  });

  it('lets an authorized administrator create a contribution for a member', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> = {};

    signInAs();
    mockApi('get', '/communities/me', () =>
      ok({ memberships: [myCommunityFixture(ADMIN_PERMISSIONS)] }, { pagination: pagination(1) }),
    );
    mockApi('get', '/payments/me', () => ok({ payments: [], summary: [] }, { pagination: pagination(0) }));
    mockContributions();
    mockApi('get', '/communities/community-1/members', () =>
      ok({ members: [memberRow({ id: 'm-hana', user_id: 'u-hana', first_name: 'Hana', last_name: 'Girma' }), memberRow({ id: 'm-p', user_id: 'u-p', status: 'pending', first_name: 'Pending', last_name: 'Person' })] }),
    );
    mockApi('post', '/communities/community-1/contributions', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;

      return ok({ contribution: {} }, {}, 201);
    });
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: 'New Contribution' }));
    const dialog = await screen.findByRole('dialog', { name: 'New contribution' });

    // the community is preselected (only one) and only ACTIVE members can be chosen
    await within(dialog).findByRole('option', { name: 'Hana Girma' });
    expect(within(dialog).queryByRole('option', { name: 'Pending Person' })).not.toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('Member'), 'm-hana');
    fireEvent.change(within(dialog).getByLabelText('Period start'), { target: { value: '2026-11-01' } });
    fireEvent.change(within(dialog).getByLabelText('Period end'), { target: { value: '2026-11-30' } });
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: '2026-11-30' } });
    await user.type(within(dialog).getByLabelText('Amount (ETB)'), '750');
    await user.click(within(dialog).getByRole('button', { name: 'Create contribution' }));

    expect(await screen.findByText('Contribution created successfully')).toBeInTheDocument();
    expect(body).toEqual({
      membershipId: 'm-hana',
      contributionPeriodStart: '2026-11-01',
      contributionPeriodEnd: '2026-11-30',
      dueDate: '2026-11-30',
      amount: '750',
    });
  });

  it('validates the create-contribution form', async () => {
    const user = userEvent.setup();

    signInAs();
    mockApi('get', '/communities/me', () => ok({ memberships: [myCommunityFixture(ADMIN_PERMISSIONS)] }, { pagination: pagination(1) }));
    mockApi('get', '/payments/me', () => ok({ payments: [], summary: [] }, { pagination: pagination(0) }));
    mockApi('get', '/communities/community-1/members', () => ok({ members: [] }));
    mockContributions();
    renderApp('/contributions');

    await user.click(await screen.findByRole('button', { name: 'New Contribution' }));
    const dialog = await screen.findByRole('dialog', { name: 'New contribution' });

    await user.click(within(dialog).getByRole('button', { name: 'Create contribution' }));

    expect(await within(dialog).findByText('Choose a member.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter an amount.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Period start'), { target: { value: '2026-11-30' } });
    fireEvent.change(within(dialog).getByLabelText('Period end'), { target: { value: '2026-11-01' } });
    await user.click(within(dialog).getByRole('button', { name: 'Create contribution' }));
    expect(await within(dialog).findByText('The period must end on or after it starts.')).toBeInTheDocument();
  });

  it('shows an error with retry when contributions cannot load', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/contributions/me', () => fail(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    renderApp('/contributions');

    expect(await screen.findByText('Something went wrong while connecting to Yegna. Please try again.', {}, { timeout: 4000 })).toBeInTheDocument();
  });
});
