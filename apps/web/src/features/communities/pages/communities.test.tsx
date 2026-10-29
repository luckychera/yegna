import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fail, mockApi, ok, pagination } from '@/test/api';
import { communityFixture, memberRow, myCommunityFixture, ADMIN_PERMISSIONS } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

describe('CommunitiesPage', () => {
  it('lists the directory with member counts and the user\'s membership state', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () =>
      ok(
        {
          communities: [
            communityFixture({ id: 'c1', name: 'Bole Community', memberCount: 48 }),
            communityFixture({ id: 'c2', name: 'Gerji Edir', memberCount: 1, myMembership: { id: 'm2', status: 'pending' } }),
          ],
        },
        { pagination: pagination(2) },
      ),
    );
    renderApp('/communities');

    expect(await screen.findByRole('link', { name: 'Bole Community' })).toBeInTheDocument();
    expect(screen.getByText('48 members')).toBeInTheDocument();
    expect(screen.getByText('1 member')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Bole Community' })).toBeInTheDocument();
    // already requested: shown as pending, with no second Join button
    expect(screen.queryByRole('button', { name: 'Join Gerji Edir' })).not.toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('never shows a location or cover image because the backend has none', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => ok({ communities: [communityFixture()] }, { pagination: pagination(1) }));
    renderApp('/communities');

    await screen.findByRole('link', { name: 'Bole Community' });
    expect(screen.queryByText(/addis ababa/i)).not.toBeInTheDocument();
    expect(document.querySelector('article img')).toBeNull();
  });

  it('searches with a debounce and sends the term to the API', async () => {
    const user = userEvent.setup();
    const seen: (string | null)[] = [];

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', ({ request }) => {
      seen.push(new URL(request.url).searchParams.get('q'));

      return ok({ communities: [communityFixture()] }, { pagination: pagination(1) });
    });
    renderApp('/communities');

    await screen.findByRole('link', { name: 'Bole Community' });
    await user.type(screen.getByRole('searchbox', { name: 'Search communities' }), 'bole');

    await waitFor(() => expect(seen).toContain('bole'));
    // typing 4 characters must not fire 4 requests
    expect(seen.filter((term) => term !== null).length).toBe(1);
  });

  it('shows a helpful empty state when a search finds nothing', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', ({ request }) =>
      new URL(request.url).searchParams.get('q')
        ? ok({ communities: [] }, { pagination: pagination(0) })
        : ok({ communities: [communityFixture()] }, { pagination: pagination(1) }),
    );
    renderApp('/communities');

    await screen.findByRole('link', { name: 'Bole Community' });
    await user.type(screen.getByRole('searchbox', { name: 'Search communities' }), 'zzz');

    expect(await screen.findByText('No communities match your search')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('link', { name: 'Bole Community' })).toBeInTheDocument();
  });

  it('joins a community after confirmation and reflects the pending request', async () => {
    const user = userEvent.setup();
    let joined = false;

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () =>
      ok(
        { communities: [communityFixture({ id: 'c1', name: 'Bole Community', myMembership: joined ? { id: 'm1', status: 'pending' } : null })] },
        { pagination: pagination(1) },
      ),
    );
    mockApi('post', '/communities/c1/join', () => {
      joined = true;

      return ok(
        { membership: { id: 'm1', communityId: 'c1', status: 'pending', membershipNumber: null, joinedAt: null, approvedAt: null, leftAt: null, createdAt: '2026-01-01' } },
        { message: 'Your request to join has been submitted' },
        201,
      );
    });
    renderApp('/communities');

    await user.click(await screen.findByRole('button', { name: 'Join Bole Community' }));
    const dialog = await screen.findByRole('dialog', { name: 'Join Bole Community?' });

    await user.click(within(dialog).getByRole('button', { name: 'Join community' }));

    expect(await screen.findByText('Your request to join has been submitted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Join Bole Community' })).not.toBeInTheDocument());
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('explains why a community cannot be joined (409)', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => ok({ communities: [communityFixture()] }, { pagination: pagination(1) }));
    mockApi('post', '/communities/community-1/join', () => fail(409, 'COMMUNITY_NOT_JOINABLE', 'This community is not accepting new members'));
    renderApp('/communities');

    await user.click(await screen.findByRole('button', { name: 'Join Bole Community' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Join community' }));

    expect(await screen.findByText('This community is not accepting new members right now.')).toBeInTheDocument();
  });

  it('shows only the user\'s communities on the My Communities tab', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => ok({ communities: [communityFixture({ id: 'c9', name: 'Somewhere Else' })] }, { pagination: pagination(1) }));
    mockApi('get', '/communities/me', () =>
      ok({ memberships: [myCommunityFixture([], { community: { ...communityFixture(), name: 'Mine Equb' } })] }, { pagination: pagination(1) }),
    );
    renderApp('/communities');

    await screen.findByRole('link', { name: 'Somewhere Else' });
    await user.click(screen.getByRole('tab', { name: 'My Communities' }));

    expect(await screen.findByRole('link', { name: 'Mine Equb' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Somewhere Else' })).not.toBeInTheDocument();
  });

  it('shows an error with retry when the directory cannot load', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => fail(500, 'INTERNAL_SERVER_ERROR', 'boom'));
    renderApp('/communities');

    expect(await screen.findByText('Something went wrong while connecting to Yegna. Please try again.', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('creates a community and opens it', async () => {
    const user = userEvent.setup();
    let body: unknown;

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => ok({ communities: [communityFixture()] }, { pagination: pagination(1) }));
    mockApi('post', '/communities', async ({ request }) => {
      body = await request.json();

      return ok(
        { community: { id: 'new-1', name: 'Kirkos Mahiber', description: null, community_type: 'mahiber', status: 'active', logo_url: null, created_at: '2026-01-01', updated_at: '2026-01-01' } },
        {},
        201,
      );
    });
    const { router } = renderApp('/communities');

    await user.click(await screen.findByRole('button', { name: 'Create Community' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a community' });

    await user.type(within(dialog).getByLabelText('Community name'), 'Kirkos Mahiber');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'mahiber');
    await user.click(within(dialog).getByRole('button', { name: 'Create community' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/communities/new-1'));
    expect(body).toEqual({ name: 'Kirkos Mahiber', communityType: 'mahiber', bannerUrl: '' });
  });

  it('validates the create form before calling the API', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockApi('get', '/communities', () => ok({ communities: [communityFixture()] }, { pagination: pagination(1) }));
    renderApp('/communities');

    await user.click(await screen.findByRole('button', { name: 'Create Community' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Create community' }));

    expect(await screen.findByText('Enter a community name.')).toBeInTheDocument();
  });
});

describe('CommunityDetailPage', () => {
  function mockMembers(rows: Record<string, unknown>[]) {
    mockApi('get', '/communities/community-1/members', () => ok({ members: rows }));
  }

  it('gives an ordinary member the About view only, with no admin controls', async () => {
    signInAs();
    mockWorkspace({ permissions: [] });
    renderApp('/communities/community-1');

    expect(await screen.findByRole('heading', { name: 'Bole Community' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['About']);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.getByText('Founded Jan 1, 2026')).toBeInTheDocument();
  });

  it('shows every section an administrator is permitted to use', async () => {
    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    renderApp('/communities/community-1');

    await screen.findByRole('heading', { name: 'Bole Community' });
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['About', 'Members', 'Contributions', 'Payments', 'Invitations']);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/reports?community=community-1');
  });

  it('lets a non-member see the community and request to join, without any private sections', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [] }, { pagination: pagination(0) }));
    mockApi('get', '/communities', () => ok({ communities: [communityFixture()] }, { pagination: pagination(1) }));
    renderApp('/communities/community-1');

    expect(await screen.findByRole('heading', { name: 'Bole Community' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Community' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByText('You are not a member of this community yet.')).toBeInTheDocument();
  });

  it('says so when the community does not exist', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () => ok({ memberships: [] }, { pagination: pagination(0) }));
    mockApi('get', '/communities', () => ok({ communities: [] }, { pagination: pagination(0) }));
    renderApp('/communities/does-not-exist');

    expect(await screen.findByText('Community not found')).toBeInTheDocument();
  });

  it('approves a pending member only after confirmation', async () => {
    const user = userEvent.setup();
    let approved = false;

    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    mockMembers([memberRow({ id: 'm-hana', user_id: 'u-hana', status: 'pending', first_name: 'Hana', last_name: 'Girma' })]);
    mockApi('post', '/communities/community-1/members/m-hana/approve', () => {
      approved = true;

      return ok({});
    });
    renderApp('/communities/community-1?tab=members');

    await user.click(await screen.findByRole('button', { name: 'Approve Hana Girma' }));
    expect(approved).toBe(false);

    const dialog = await screen.findByRole('dialog', { name: 'Approve Hana Girma?' });

    await user.click(within(dialog).getByRole('button', { name: 'Approve Member' }));

    expect(await screen.findByText('Membership approved')).toBeInTheDocument();
    expect(approved).toBe(true);
  });

  it('explains the consequence before suspending a member', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    mockMembers([memberRow({ id: 'm-selam', user_id: 'u-selam' })]);
    mockApi('post', '/communities/community-1/members/m-selam/suspend', () => ok({}));
    renderApp('/communities/community-1?tab=members');

    await user.click(await screen.findByRole('button', { name: 'Suspend Selam Tadesse' }));

    const dialog = await screen.findByRole('dialog', { name: 'Suspend membership?' });

    expect(within(dialog).getByText('This member will no longer be able to participate normally.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Suspend Membership' }));
    expect(await screen.findByText('Membership suspended')).toBeInTheDocument();
  });

  it('only offers the actions the backend permissions allow', async () => {
    signInAs();
    // can approve/reject (members.update) but NOT suspend/remove (members.remove)
    mockWorkspace({ permissions: ['members.view', 'members.update'] });
    mockMembers([
      memberRow({ id: 'm1', user_id: 'u1', status: 'pending', first_name: 'Hana', last_name: 'Girma' }),
      memberRow({ id: 'm2', user_id: 'u2', status: 'active', first_name: 'Selam', last_name: 'Tadesse' }),
    ]);
    renderApp('/communities/community-1?tab=members');

    expect(await screen.findByRole('button', { name: 'Approve Hana Girma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject Hana Girma' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend Selam Tadesse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Selam Tadesse' })).not.toBeInTheDocument();
  });

  it('never offers management actions on your own membership', async () => {
    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    mockMembers([memberRow({ id: 'm-me', user_id: 'user-1', first_name: 'Abebe', last_name: 'Kebede' })]);
    renderApp('/communities/community-1?tab=members');

    // wait for the members table itself (the sidebar also shows the user's name)
    await screen.findByText('member@example.com');
    expect(screen.queryByRole('button', { name: /Suspend Abebe Kebede|Remove Abebe Kebede/ })).not.toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('filters members by search and status', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    mockMembers([
      memberRow({ id: 'm1', user_id: 'u1', first_name: 'Hana', last_name: 'Girma', status: 'pending' }),
      memberRow({ id: 'm2', user_id: 'u2', first_name: 'Selam', last_name: 'Tadesse', status: 'active' }),
    ]);
    renderApp('/communities/community-1?tab=members');

    await screen.findAllByText('Hana Girma');
    await user.type(screen.getByRole('searchbox', { name: 'Search members' }), 'selam');

    await waitFor(() => expect(screen.queryAllByText('Hana Girma')).toHaveLength(0));
    expect(screen.getAllByText('Selam Tadesse').length).toBeGreaterThan(0);
  });

  it('shows a permission-denied message instead of crashing when the API refuses', async () => {
    signInAs();
    mockWorkspace({ permissions: ['members.view'] });
    mockApi('get', '/communities/community-1/members', () => fail(403, 'PERMISSION_DENIED', 'nope'));
    renderApp('/communities/community-1?tab=members');

    expect(await screen.findByText('Permission denied')).toBeInTheDocument();
  });
});
