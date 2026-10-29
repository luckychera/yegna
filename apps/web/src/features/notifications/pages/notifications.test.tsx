import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockApi, ok } from '@/test/api';
import { notificationRow } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

function mockList(rows: Record<string, unknown>[], onRequest?: (search: URLSearchParams) => void) {
  mockApi('get', '/notifications', ({ request }) => {
    const url = new URL(request.url);

    onRequest?.(url.searchParams);

    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const items = rows.filter((row) => !unreadOnly || row.read_at === null);

    return ok(items, { pagination: { limit: 20, offset: 0, count: items.length } });
  });
}

describe('NotificationsPage', () => {
  it('makes unread notifications obvious, including to screen readers', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 1 }));
    mockList([
      notificationRow({ id: 'u', title: 'Membership approved', type: 'membership_approved', read_at: null }),
      notificationRow({ id: 'r', title: 'Contribution due', type: 'contribution_due', read_at: '2026-01-01T00:00:00.000Z' }),
    ]);
    renderApp('/notifications');

    expect(await screen.findByText(/Membership approved/)).toBeInTheDocument();
    expect(screen.getByText('(unread)')).toBeInTheDocument();
    expect(screen.getAllByText('(unread)')).toHaveLength(1);
  });

  it('marks a notification as read and opens the related page', async () => {
    const user = userEvent.setup();
    let markedRead = '';

    signInAs();
    mockWorkspace();
    mockList([notificationRow({ id: 'n-pay', title: 'Payment successful', type: 'payment_successful' })]);
    mockApi('patch', '/notifications/n-pay/read', () => {
      markedRead = 'n-pay';

      return ok({});
    });
    mockApi('get', '/payments/me', () => ok({ payments: [], summary: [] }, { pagination: { limit: 10, offset: 0, count: 0, total: 0 } }));
    const { router } = renderApp('/notifications');

    await user.click(await screen.findByRole('button', { name: /Payment successful/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/payments'));
    expect(markedRead).toBe('n-pay');
  });

  it('marks everything as read in one action', async () => {
    const user = userEvent.setup();
    let called = false;

    signInAs();
    mockWorkspace();
    mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 2 }));
    mockList([notificationRow({ id: 'a' }), notificationRow({ id: 'b', title: 'Other' })]);
    mockApi('patch', '/notifications/read-all', () => {
      called = true;

      return ok({ updatedCount: 2 });
    });
    renderApp('/notifications');

    const button = await screen.findByRole('button', { name: 'Mark all as read' });

    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText('All notifications marked as read')).toBeInTheDocument();
    expect(called).toBe(true);
  });

  it('disables "mark all" when nothing is unread', async () => {
    signInAs();
    mockWorkspace();
    mockList([notificationRow({ read_at: '2026-01-01T00:00:00.000Z' })]);
    renderApp('/notifications');

    await screen.findByText(/Payment successful/);
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('filters to unread notifications', async () => {
    const user = userEvent.setup();
    const seen: (string | null)[] = [];

    signInAs();
    mockWorkspace();
    mockList(
      [notificationRow({ id: 'u', title: 'Fresh one' }), notificationRow({ id: 'r', title: 'Old one', read_at: '2026-01-01T00:00:00.000Z' })],
      (search) => seen.push(search.get('unreadOnly')),
    );
    renderApp('/notifications');

    await screen.findByText(/Old one/);
    await user.click(screen.getByRole('tab', { name: /Unread/ }));

    await waitFor(() => expect(screen.queryByText(/Old one/)).not.toBeInTheDocument());
    expect(screen.getByText(/Fresh one/)).toBeInTheDocument();
    expect(seen).toContain('true');
  });

  it('shows friendly empty states', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockList([]);
    renderApp('/notifications');

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Unread/ }));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
