import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { fail, mockApi, ok, pagination } from '@/test/api';
import { communityFixture, myCommunityFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

// jsdom has no layout, so give charts a fixed size and let them render real SVG.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();

  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
    }) => cloneElement(children, { width: 480, height: 256 }),
  };
});

const CONTRIBUTION_STATS = {
  total_contributions: 10,
  pending_contributions: 3,
  paid_contributions: 5,
  overdue_contributions: 1,
  waived_contributions: 1,
  cancelled_contributions: 0,
  total_expected: '10000.00',
  total_paid: '6500.00',
  total_outstanding: '3500.00',
};

const PAYMENT_STATS = {
  total_payments: 7,
  pending_payments: 1,
  processing_payments: 0,
  successful_payments: 5,
  failed_payments: 1,
  cancelled_payments: 0,
  refunded_payments: 0,
  successful_amount: '6500.00',
  refunded_amount: '0.00',
};

describe('ReportsPage', () => {
  it('denies access to people without the backend reports permission', async () => {
    signInAs();
    mockWorkspace({ permissions: ['community.view'] });

    renderApp('/reports');

    await waitFor(() => {
      expect(screen.getByText('No reports available')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('tab', { name: 'Overview' }),
    ).not.toBeInTheDocument();
  });

  it('shows real figures from the API, each also readable as text beside its chart', async () => {
    signInAs();
    mockWorkspace({ permissions: ['reports.view'] });

    mockApi('get', '/reports/community/community-1', () =>
      ok({
        community: {
          id: 'community-1',
          name: 'Bole Community',
          community_type: 'equb',
          status: 'active',
          created_at: '2026-01-01',
        },
        memberships: {
          total_memberships: 48,
          active_memberships: 40,
          pending_memberships: 5,
          suspended_memberships: 2,
          left_memberships: 1,
        },
        contributions: {
          total_contributions: 10,
          total_expected: '10000.00',
          total_paid: '6500.00',
        },
        payments: {
          total_payments: 7,
          successful_payment_amount: '6500.00',
        },
      }),
    );

    renderApp('/reports');

    expect(await screen.findByText('48')).toBeInTheDocument();
    expect(screen.getByText('40 active')).toBeInTheDocument();
    expect(screen.getByText('ETB 10,000')).toBeInTheDocument();
    expect(screen.getAllByText('ETB 6,500').length).toBeGreaterThan(0);

    expect(screen.getAllByText('Suspended').length).toBeGreaterThanOrEqual(2);

    const chart = screen.getByRole('img', {
      name: 'Bar chart of members by status',
    });

    expect(chart.querySelector('svg')).not.toBeNull();
  });

  it('loads the contribution report for the chosen period', async () => {
    const user = userEvent.setup();
    const periods: (string | null)[] = [];

    signInAs();
    mockWorkspace({ permissions: ['reports.view'] });

    mockApi('get', '/reports/community/community-1', () =>
      ok({
        community: {
          id: 'community-1',
          name: 'Bole',
          community_type: 'equb',
          status: 'active',
          created_at: '2026-01-01',
        },
        memberships: {
          total_memberships: 1,
          active_memberships: 1,
          pending_memberships: 0,
          suspended_memberships: 0,
          left_memberships: 0,
        },
        contributions: {
          total_contributions: 0,
          total_expected: '0.00',
          total_paid: '0.00',
        },
        payments: {
          total_payments: 0,
          successful_payment_amount: '0.00',
        },
      }),
    );

    mockApi('get', '/reports/contributions/community-1', ({ request }) => {
      periods.push(new URL(request.url).searchParams.get('period'));

      return ok({
        period: {
          type: 'month',
          startDate: null,
          endDate: null,
        },
        summary: CONTRIBUTION_STATS,
      });
    });

    renderApp('/reports');

    await user.click(
      await screen.findByRole('tab', { name: 'Contributions' }),
    );

    expect(await screen.findByText('ETB 3,500')).toBeInTheDocument();
    expect(screen.getByText('65% of expected')).toBeInTheDocument();
    expect(periods).toContain('current');

    await user.selectOptions(
      screen.getByLabelText('Period'),
      'year',
    );

    await waitFor(() => {
      expect(periods).toContain('year');
    });

    expect(
      screen.getByText(/Contributions are counted by their due date/),
    ).toBeInTheDocument();
  });

  it('does not query a custom range until both dates are chosen, and rejects a reversed range', async () => {
    const user = userEvent.setup();
    const queries: string[] = [];

    signInAs();
    mockWorkspace({ permissions: ['reports.view'] });

    mockApi('get', '/reports/payments/community-1', ({ request }) => {
      queries.push(new URL(request.url).search);

      return ok({
        period: {
          type: 'custom',
          startDate: null,
          endDate: null,
        },
        summary: PAYMENT_STATS,
      });
    });

    renderApp('/reports?tab=payments');

    await screen.findByText('ETB 6,500', {}, { timeout: 3000 });

    const before = queries.length;

    await user.selectOptions(
      screen.getByLabelText('Period'),
      'custom',
    );

    expect(queries.length).toBe(before);

    await user.type(
      screen.getByLabelText('From'),
      '2026-05-10',
    );

    await user.type(
      screen.getByLabelText('To'),
      '2026-05-01',
    );

    expect(
      await screen.findByText('Must be on or after the start date.'),
    ).toBeInTheDocument();

    expect(queries.length).toBe(before);
  });

  it('lets a member who can report on several communities choose between them', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];

    signInAs();

    mockApi('get', '/communities/me', () =>
      ok(
        {
          memberships: [
            myCommunityFixture(['reports.view'], {
              community: {
                ...communityFixture(),
                id: 'c-a',
                name: 'Alpha Equb',
              },
            }),
            myCommunityFixture(['reports.view'], {
              community: {
                ...communityFixture(),
                id: 'c-b',
                name: 'Beta Edir',
              },
            }),
            myCommunityFixture([], {
              community: {
                ...communityFixture(),
                id: 'c-c',
                name: 'No Reports Mahiber',
              },
            }),
          ],
        },
        {
          pagination: pagination(3),
        },
      ),
    );

    mockApi('get', '/contributions/me', () =>
      ok(
        {
          contributions: [],
          summary: [],
        },
        {
          pagination: pagination(0),
        },
      ),
    );

    mockApi('get', '/payments/me', () =>
      ok(
        {
          payments: [],
          summary: [],
        },
        {
          pagination: pagination(0),
        },
      ),
    );

    mockApi('get', '/notifications', () =>
      ok([], {
        pagination: {
          limit: 5,
          offset: 0,
          count: 0,
        },
      }),
    );

    for (const id of ['c-a', 'c-b']) {
      mockApi('get', `/reports/community/${id}`, () => {
        asked.push(id);

        return ok({
          community: {
            id,
            name: id,
            community_type: 'equb',
            status: 'active',
            created_at: '2026-01-01',
          },
          memberships: {
            total_memberships: 1,
            active_memberships: 1,
            pending_memberships: 0,
            suspended_memberships: 0,
            left_memberships: 0,
          },
          contributions: {
            total_contributions: 0,
            total_expected: '0.00',
            total_paid: '0.00',
          },
          payments: {
            total_payments: 0,
            successful_payment_amount: '0.00',
          },
        });
      });
    }

    renderApp('/reports');

    const select = await screen.findByLabelText('Community');

    expect(
      screen.queryByRole('option', {
        name: 'No Reports Mahiber',
      }),
    ).not.toBeInTheDocument();

    await user.selectOptions(select, 'c-b');

    await waitFor(() => {
      expect(asked).toContain('c-b');
    });
  });

  it('shows permission-denied when the API itself refuses', async () => {
    signInAs();
    mockWorkspace({ permissions: ['reports.view'] });

    mockApi(
      'get',
      '/reports/community/community-1',
      () => fail(403, 'PERMISSION_DENIED', 'nope'),
    );

    renderApp('/reports');

    expect(
      await screen.findByText('Permission denied'),
    ).toBeInTheDocument();
  });

  it('does not offer an export, because the backend has none', async () => {
    signInAs();
    mockWorkspace({ permissions: ['reports.view'] });

    mockApi(
      'get',
      '/reports/community/community-1',
      () => fail(403, 'PERMISSION_DENIED', 'nope'),
    );

    renderApp('/reports');

    await screen.findByText('Permission denied');

    expect(
      screen.queryByRole('button', { name: /export/i }),
    ).not.toBeInTheDocument();
  });
});
