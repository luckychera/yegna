import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fail, mockApi, ok, pagination } from '@/test/api';
import { communityFixture, myCommunityFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

describe('MyMembershipPage', () => {
  it('lists memberships with status, role and join date', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () =>
      ok(
        {
          memberships: [
            myCommunityFixture(['members.view'], { roles: [{ id: 'r', name: 'admin', assignedAt: '2026-01-02' }] }),
            myCommunityFixture([], {
              community: { ...communityFixture(), id: 'c2', name: 'Gerji Edir' },
              membership: { id: 'm2', status: 'pending', membershipNumber: null, joinedAt: null },
            }),
          ],
        },
        { pagination: pagination(2) },
      ),
    );
    renderApp('/memberships');

    const table = await screen.findByRole('table', { name: 'My memberships' });

    expect(within(within(table).getByText('Bole Community').closest('tr')!).getByText('Active')).toBeInTheDocument();
    expect(within(within(table).getByText('Bole Community').closest('tr')!).getByText('Admin')).toBeInTheDocument();
    expect(within(within(table).getByText('Gerji Edir').closest('tr')!).getByText('Pending')).toBeInTheDocument();
    // pending memberships cannot be left (the backend does not allow it)
    expect(within(within(table).getByText('Gerji Edir').closest('tr')!).queryByRole('button', { name: /Leave/ })).not.toBeInTheDocument();
  });

  it('leaves a community only after the consequence is explained and confirmed', async () => {
    const user = userEvent.setup();
    let left = false;

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [myCommunityFixture()] }, { pagination: pagination(1) }));
    mockApi('post', '/communities/community-1/leave', () => {
      left = true;

      return ok({ membership: { id: 'membership-1', status: 'left' } });
    });
    renderApp('/memberships');

    await user.click(await screen.findByRole('button', { name: /Leave/ }));
    expect(left).toBe(false);

    const dialog = await screen.findByRole('dialog', { name: 'Leave Bole Community?' });

    expect(within(dialog).getByText(/lose access to its members and contributions/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Leave community' }));

    expect(await screen.findByText('You left Bole Community')).toBeInTheDocument();
    expect(left).toBe(true);
  });

  it('reports a refused leave (e.g. an invalid status change)', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [myCommunityFixture()] }, { pagination: pagination(1) }));
    mockApi('post', '/communities/community-1/leave', () => fail(400, 'INVALID_MEMBERSHIP_STATUS_TRANSITION', 'Cannot change membership status'));
    renderApp('/memberships');

    await user.click(await screen.findByRole('button', { name: /Leave/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave community' }));

    expect(await screen.findByText('Cannot change membership status')).toBeInTheDocument();
  });

  it('filters by status through the API', async () => {
    const user = userEvent.setup();
    const seen: (string | null)[] = [];

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', ({ request }) => {
      seen.push(new URL(request.url).searchParams.get('status'));

      return ok({ memberships: [myCommunityFixture()] }, { pagination: pagination(1) });
    });
    renderApp('/memberships');

    await screen.findByRole('table', { name: 'My memberships' });
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'left');

    await waitFor(() => expect(seen).toContain('left'));
  });

  it('has a friendly empty state', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [] }, { pagination: pagination(0) }));
    renderApp('/memberships');

    expect(await screen.findByText('No memberships yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore Communities' })).toBeInTheDocument();
  });
});
