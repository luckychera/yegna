import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { tokenStore } from '@/lib/auth/token-store';
import { PERMISSIONS } from '@/lib/permissions';
import { fail, mockApi, ok, pagination } from '@/test/api';
import { communityFixture, contributionFixture, myCommunityFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

describe('route protection', () => {
  it('sends signed-out visitors to the login page', async () => {
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
  });

  it('shows a one-time "session expired" notice when the stored session is no longer valid', async () => {
    tokenStore.setTokens('stale', 'dead-refresh');
    mockApi('post', '/auth/refresh', () => fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token'));

    renderApp('/dashboard');

    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
  });

  it('lets the user retry when Yegna cannot be reached at startup', async () => {
    const user = userEvent.setup();

    tokenStore.setTokens('stale', 'stored-refresh');
    mockApi('post', '/auth/refresh', () => HttpResponse.json({}, { status: 503 }));
    renderApp('/dashboard');

    expect(await screen.findByText("We couldn't reach Yegna")).toBeInTheDocument();
    expect(tokenStore.getRefreshToken()).toBe('stored-refresh');

    signInAs();
    mockWorkspace();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: /Abebe/ })).toBeInTheDocument();
  });

  it('sends signed-in users away from the login page', async () => {
    signInAs();
    mockWorkspace();
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: /Abebe/ })).toBeInTheDocument();
  });

  it('shows a helpful page for unknown addresses', async () => {
    signInAs();
    mockWorkspace();
    renderApp('/definitely-not-a-page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('app shell', () => {
  it('hides Reports from people without the backend reports permission', async () => {
    signInAs();
    mockWorkspace({ permissions: [PERMISSIONS.COMMUNITY_VIEW] });
    renderApp('/dashboard');

    await screen.findByRole('heading', { name: /Abebe/ });

    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
  });

  it('shows Reports when the backend grants reports.view in any community', async () => {
    signInAs();
    mockWorkspace({ permissions: [PERMISSIONS.REPORTS_VIEW] });
    renderApp('/dashboard');

    expect(await screen.findByRole('link', { name: 'Reports' })).toBeInTheDocument();
  });

  it('shows unread notification and pending invitation badges', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 3 }));
    mockApi('get', '/invitations/me', () => ok({ invitations: [] }, { pagination: pagination(0, 2, 1) }));
    renderApp('/dashboard');

    expect(await screen.findByRole('link', { name: /Notifications.*3 new/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Invitations.*2 new/ })).toBeInTheDocument();
  });

  it('signs out: calls the API with the refresh token, clears the session and returns to login', async () => {
    const user = userEvent.setup();
    let logoutBody: unknown;

    signInAs();
    mockWorkspace();
    mockApi('post', '/auth/logout', async ({ request }) => {
      logoutBody = await request.json();

      return ok({});
    });
    renderApp('/dashboard');

    await screen.findByRole('heading', { name: /Abebe/ });
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(await screen.findByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
    expect(logoutBody).toEqual({ refreshToken: 'rotated-refresh' });
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('still signs out locally if the server cannot be reached', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('post', '/auth/logout', () => HttpResponse.error());
    renderApp('/dashboard');

    await screen.findByRole('heading', { name: /Abebe/ });
    await user.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);

    expect(await screen.findByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('returns to login with a notice when the session dies while using the app', async () => {
    let refreshCalls = 0;

    signInAs();
    mockWorkspace();
    // Boot refresh succeeds; the backend then rejects the session on the next refresh attempt.
    mockApi('post', '/auth/refresh', () => {
      refreshCalls += 1;

      return refreshCalls === 1
        ? ok({ accessToken: 'fresh-access', refreshToken: 'rotated-refresh', refreshTokenExpiresAt: '2099-01-01' })
        : fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    });
    mockApi('get', '/contributions/me', () => fail(401, 'INVALID_TOKEN', 'Invalid or expired token'));

    renderApp('/dashboard');

    expect(await screen.findByText('Your session has expired. Please sign in again.', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back!' })).toBeInTheDocument();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });
});

describe('dashboard', () => {
  it('shows real totals, upcoming contributions and recent activity from the API', async () => {
    signInAs();
    mockApi('get', '/communities/me', () =>
      ok({ memberships: [myCommunityFixture(), myCommunityFixture([], { community: { ...communityFixture(), id: 'c2', name: 'Gerji Edir' } })] }, { pagination: pagination(2, 3) }),
    );
    mockApi('get', '/payments/me', () =>
      ok(
        { payments: [], summary: [{ currency: 'ETB', count: 4, totalPaid: '12500.00', paidThisMonth: '0.00', pendingAmount: '0.00', refundedAmount: '0.00' }] },
        { pagination: pagination(0, 4) },
      ),
    );
    mockApi('get', '/contributions/me', () =>
      ok(
        {
          contributions: [
            contributionFixture({ id: 'late', dueDate: '2099-12-31T00:00:00.000Z', community: { id: 'c1', name: 'Later Equb', logoUrl: null } }),
            contributionFixture({ id: 'soon', dueDate: '2099-01-05T00:00:00.000Z', community: { id: 'c1', name: 'Sooner Equb', logoUrl: null }, outstandingAmount: '2000.00' }),
            contributionFixture({ id: 'done', status: 'paid', outstandingAmount: '0.00', community: { id: 'c1', name: 'Settled Equb', logoUrl: null } }),
          ],
          summary: [{ currency: 'ETB', count: 3, totalAmount: '3000.00', paidAmount: '1000.00', outstandingAmount: '2000.00', pendingCount: 2, overdueCount: 0 }],
        },
        { pagination: pagination(3) },
      ),
    );
    mockApi('get', '/notifications', () =>
      ok(
        [{ id: 'n1', community_id: null, type: 'payment_successful', title: 'Payment successful', message: 'We received your ETB 2,000.', priority: 'normal', entity_type: null, entity_id: null, read_at: null, created_at: new Date().toISOString() }],
        { pagination: { limit: 5, offset: 0, count: 1 } },
      ),
    );
    mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 3 }));

    renderApp('/dashboard');

    const summary = await screen.findByRole('region', { name: 'Summary' });

    await waitFor(() => expect(summary).toHaveTextContent('ETB 12,500'));
    expect(summary).toHaveTextContent('ETB 2,000');
    expect(summary).toHaveTextContent('3');

    const upcoming = (await screen.findByText('Upcoming Contributions')).closest('div')!.parentElement!;
    const names = Array.from(upcoming.querySelectorAll('li p.font-medium')).map((node) => node.textContent);

    expect(names).toEqual(['Sooner Equb', 'Later Equb']); // soonest first, settled contribution excluded
    expect(await screen.findByText('Payment successful')).toBeInTheDocument();
  });

  it('guides new users to find a community when they have none', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [] }, { pagination: pagination(0) }));
    renderApp('/dashboard');

    expect(await screen.findByText('No communities yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore Communities' })).toHaveAttribute('href', '/communities');
  });

  it('shows an error with retry when contributions cannot be loaded', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/contributions/me', () => fail(500, 'INTERNAL_SERVER_ERROR', 'SQL syntax error near SELECT'));
    renderApp('/dashboard');

    // the app retries a failed request once before giving up
    const alert = await screen.findByText(
      'Something went wrong while connecting to Yegna. Please try again.',
      {},
      { timeout: 4000 },
    );

    expect(alert).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('SQL syntax');
  });
});
