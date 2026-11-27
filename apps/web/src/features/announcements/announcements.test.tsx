import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { notificationTarget } from '@/features/notifications/notification-visuals';
import { fail, mockApi, ok, pagination } from '@/test/api';
import { myCommunityFixture, notificationRow, ADMIN_PERMISSIONS } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';
import type { Announcement } from './announcement.types';

const announcement: Announcement = {
  id: '11111111-1111-4111-8111-111111111111',
  communityId: 'community-1',
  category: 'meeting',
  title: 'Monthly meeting',
  body: 'We meet on Sunday after church.',
  eventAt: '2026-12-06T09:00:00.000Z',
  location: 'Hall',
  isPinned: true,
  publishedAt: '2026-11-20T08:00:00.000Z',
  updatedAt: '2026-11-20T08:00:00.000Z',
  isRead: false,
  author: { id: 'user-2', name: 'Selam Admin', avatarUrl: null },
  community: { id: 'community-1', name: 'Bole Community', logoUrl: null },
};

function mockFeed(items: Announcement[] = [announcement], unreadCount = items.filter((item) => !item.isRead).length) {
  mockApi('get', '/communities/community-1/announcements', () => ok({ announcements: items, unreadCount }));
}

describe('notification targets', () => {
  it('opens an announcement when the community and id are present', () => {
    expect(notificationTarget('community_announcement', 'community-1', announcement.id)).toBe(
      `/communities/community-1?tab=announcements&announcement=${announcement.id}`,
    );
  });

  it('opens the announcements tab when the id is missing, and goes nowhere without a community', () => {
    expect(notificationTarget('community_announcement', 'community-1', null)).toBe('/communities/community-1?tab=announcements');
    expect(notificationTarget('community_announcement', 'community-1', '   ')).toBe('/communities/community-1?tab=announcements');
    expect(notificationTarget('community_announcement', null, announcement.id)).toBeNull();
    expect(notificationTarget('community_announcement', '   ', announcement.id)).toBeNull();
    expect(notificationTarget('payment_successful', 'community-1', announcement.id)).toBe('/payments');
  });
});

describe('community announcements', () => {
  it('lists announcements and opens the detail, marking it read', async () => {
    const user = userEvent.setup();
    let marked = '';

    signInAs();
    mockWorkspace();
    mockFeed();
    mockApi('post', `/communities/community-1/announcements/${announcement.id}/read`, () => {
      marked = announcement.id;

      return ok({ read: true });
    });
    renderApp('/communities/community-1?tab=announcements');

    expect(await screen.findByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText('Monthly meeting')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New announcement' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Monthly meeting/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Monthly meeting' });

    expect(within(dialog).getByText('We meet on Sunday after church.')).toBeInTheDocument();
    expect(within(dialog).getByText('Hall')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    await waitFor(() => expect(marked).toBe(announcement.id));
  });

  it('hides management from a pending member because they are not active', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () =>
      ok(
        {
          memberships: [
            myCommunityFixture([], {
              membership: { id: 'membership-1', status: 'pending', membershipNumber: null, joinedAt: null },
            }),
          ],
        },
        { pagination: pagination(1) },
      ),
    );
    renderApp('/communities/community-1');

    expect(await screen.findByRole('heading', { name: 'Bole Community' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['About']);
  });

  it('shows an empty state without inventing announcements', async () => {
    signInAs();
    mockWorkspace();
    mockFeed([]);
    renderApp('/communities/community-1?tab=announcements');

    expect(await screen.findByText('No announcements yet')).toBeInTheDocument();
    expect(screen.queryByText('Monthly meeting')).not.toBeInTheDocument();
  });

  it('shows the API refusal instead of an empty feed', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/community-1/announcements', () => fail(403, 'PERMISSION_DENIED', 'nope'));
    renderApp('/communities/community-1?tab=announcements');

    expect(await screen.findByRole('heading', { name: 'Permission denied' })).toBeInTheDocument();
  });

  it('shows a loading state while the feed is in flight', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/community-1/announcements', () => new Promise(() => undefined));
    renderApp('/communities/community-1?tab=announcements');

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('lets a manager publish, edit and remove, and validates before calling the API', async () => {
    const user = userEvent.setup();
    let created: unknown = null;
    let updated: unknown = null;
    let removed = false;

    signInAs();
    mockWorkspace({ permissions: ADMIN_PERMISSIONS });
    mockFeed([{ ...announcement, isRead: true }]);
    mockApi('post', '/communities/community-1/announcements', async ({ request }) => {
      created = await request.json();

      return ok({ announcement, notifiedMembers: 2 }, {}, 201);
    });
    mockApi('patch', `/communities/community-1/announcements/${announcement.id}`, async ({ request }) => {
      updated = await request.json();

      return ok({ announcement: { ...announcement, title: 'Meeting moved', isRead: true } });
    });
    mockApi('delete', `/communities/community-1/announcements/${announcement.id}`, () => {
      removed = true;

      return ok({});
    });
    renderApp('/communities/community-1?tab=announcements');

    await user.click(await screen.findByRole('button', { name: 'New announcement' }));
    const createDialog = await screen.findByRole('dialog', { name: 'New announcement' });
    await user.click(within(createDialog).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Use at least 3 characters.')).toBeInTheDocument();
    expect(created).toBeNull();

    await user.type(within(createDialog).getByLabelText('Title'), 'Sunday meeting');
    await user.type(within(createDialog).getByLabelText('Message'), 'Bring the ledger.');
    await user.click(within(createDialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(created).toMatchObject({ title: 'Sunday meeting', body: 'Bring the ledger.', category: 'update' }));
    expect(await screen.findByText('Announcement published')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Monthly meeting/ }));
    const detail = await screen.findByRole('dialog', { name: 'Monthly meeting' });
    await user.click(within(detail).getByRole('button', { name: 'Edit' }));

    const edit = await screen.findByRole('dialog', { name: 'Edit announcement' });
    const title = within(edit).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Meeting moved');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updated).toMatchObject({ title: 'Meeting moved', isPinned: true, location: 'Hall' }));
    expect(await screen.findByText('Announcement updated')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Edit announcement' })).not.toBeInTheDocument();

    const stillOpen = await screen.findByRole('dialog', { name: 'Monthly meeting' });
    await user.click(within(stillOpen).getByRole('button', { name: 'Remove' }));
    expect(removed).toBe(false);
    await user.click(within(await screen.findByRole('dialog', { name: 'Remove this announcement?' })).getByRole('button', { name: 'Remove announcement' }));

    await waitFor(() => expect(removed).toBe(true));
    expect(await screen.findByText('Announcement removed')).toBeInTheDocument();
  });

  it('opens the announcement from a notification and stays put when the community id is missing', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockFeed();
    mockApi('get', '/notifications', () =>
      ok(
        [
          notificationRow({
            id: 'n-ann',
            title: 'Bole Community: Monthly meeting',
            type: 'community_announcement',
            community_id: 'community-1',
            entity_type: 'announcement',
            entity_id: announcement.id,
          }),
          notificationRow({
            id: 'n-lost',
            title: 'Announcement without a community',
            type: 'community_announcement',
            community_id: null,
            entity_id: announcement.id,
          }),
        ],
        { pagination: { limit: 20, offset: 0, count: 2 } },
      ),
    );
    mockApi('patch', '/notifications/n-ann/read', () => ok({}));
    mockApi('patch', '/notifications/n-lost/read', () => ok({}));
    mockApi('post', `/communities/community-1/announcements/${announcement.id}/read`, () => ok({ read: true }));
    const { router } = renderApp('/notifications');

    await user.click(await screen.findByRole('button', { name: /Announcement without a community/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/notifications'));

    await user.click(screen.getByRole('button', { name: /Bole Community: Monthly meeting/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/communities/community-1'));
    expect(router.state.location.search).toBe(`?tab=announcements&announcement=${announcement.id}`);
    expect(await screen.findByRole('dialog', { name: 'Monthly meeting' })).toBeInTheDocument();
  });
});

describe('dashboard announcements', () => {
  it('links each announcement to its detail and shows when there are none', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/announcements/me', () => ok({ announcements: [{ ...announcement, isRead: false }] }));
    renderApp('/dashboard');

    const link = await screen.findByRole('link', { name: /Monthly meeting/ });

    expect(link).toHaveAttribute('href', `/communities/community-1?tab=announcements&announcement=${announcement.id}`);
    expect(within(link).getByText('Unread')).toBeInTheDocument();
  });

  it('shows an empty state and an error state', async () => {
    signInAs();
    mockWorkspace();
    const view = renderApp('/dashboard');

    expect(await screen.findByText('No announcements from your communities yet.')).toBeInTheDocument();

    mockApi('get', '/announcements/me', () => fail(500, 'INTERNAL_SERVER_ERROR', 'The announcements feed failed'));
    view.unmount();
    renderApp('/dashboard');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });
});
