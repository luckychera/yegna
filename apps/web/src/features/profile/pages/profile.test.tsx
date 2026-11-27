import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { IdentityDetails, MembershipCard, NotificationPreferences } from '@/features/account/account.types';
import { fail, mockApi, ok, pagination } from '@/test/api';
import { myCommunityFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

const FIN_DIGITS = '1234567890123456';

const identity: IdentityDetails = {
  id: 'identity-1',
  provider: 'fayda',
  verificationStatus: 'verified',
  verifiedAt: '2026-01-15T08:05:00.000Z',
  identifierType: 'FIN',
  verificationMode: 'mock',
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: '2026-01-15T08:05:00.000Z',
};

const card: MembershipCard = {
  membershipId: 'membership-1',
  membershipNumber: 'YG-7K3Q-M9TD',
  status: 'active',
  joinedAt: '2026-01-02T00:00:00.000Z',
  issuedAt: '2026-01-02T00:00:00.000Z',
  verificationCode: 'ABCDEFGHJKMNPQRSTUVWXY23',
  roles: ['admin'],
  community: { id: 'community-1', name: 'Bole Community', communityType: 'equb', logoUrl: null },
  holder: { name: 'Abebe Kebede', avatarUrl: null },
};

const preferences: NotificationPreferences = {
  inApp: { announcements: true, contributions: true, payments: false, memberships: true, invitations: true },
  updatedAt: null,
};

function mockIdentity(value: IdentityDetails | null = identity) {
  mockApi('get', '/identity/me', () => (value ? ok({ identity: value }) : fail(404, 'IDENTITY_NOT_FOUND', 'No identity record was found for this account')));
}

describe('account workspace', () => {
  it('shows the account overview without any Fayda number', async () => {
    signInAs();
    mockWorkspace();
    mockIdentity();
    renderApp('/profile');

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText('abebe@example.com')).toBeInTheDocument();
    expect(screen.getByText('+251911234567')).toBeInTheDocument();
    expect(screen.getByText('Registered Jan 15, 2026')).toBeInTheDocument();
    expect(await screen.findByText('Development check')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile?section=personal');
    expect(screen.queryByText(FIN_DIGITS)).not.toBeInTheDocument();
  });

  it('treats a missing identity record as not verified', async () => {
    signInAs();
    mockWorkspace();
    mockIdentity(null);
    renderApp('/profile');

    expect(await screen.findByText('Not verified')).toBeInTheDocument();
    expect(screen.queryByText('Development check')).not.toBeInTheDocument();
  });

  it('validates personal details and saves only the fields the account API accepts', async () => {
    const user = userEvent.setup();
    let saved: unknown = null;

    signInAs();
    mockWorkspace();
    mockIdentity();
    mockApi('patch', '/users/me', async ({ request }) => {
      saved = await request.json();

      return ok({});
    });
    renderApp('/profile?section=personal');

    await screen.findByRole('heading', { name: 'Personal information' });
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Fayda/)).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('First name'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument();
    expect(saved).toBeNull();

    await user.type(screen.getByLabelText('First name'), 'Abebe');
    await user.type(screen.getByLabelText(/Avatar URL/), 'notaurl');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter an http or https URL.')).toBeInTheDocument();
    expect(saved).toBeNull();

    await user.clear(screen.getByLabelText(/Avatar URL/));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(saved).toMatchObject({ firstName: 'Abebe', lastName: 'Kebede', avatarUrl: null }));
    expect(await screen.findByText('Profile updated successfully')).toBeInTheDocument();
    expect(saved).not.toHaveProperty('email');
    expect(saved).not.toHaveProperty('phone');
  });

  it('shows how identity was checked and never a reference number', async () => {
    signInAs();
    mockWorkspace();
    mockIdentity();
    renderApp('/profile?section=identity');

    expect(await screen.findByText('Development verification')).toBeInTheDocument();
    expect(screen.getByText('Fayda Identification Number (FIN)')).toBeInTheDocument();
    expect(screen.getByText('Fayda')).toBeInTheDocument();
    expect(screen.queryByText(/reference/i)).not.toBeInTheDocument();
    expect(screen.queryByText(FIN_DIGITS)).not.toBeInTheDocument();
  });

  it('lists community memberships separately from the Yegna account', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/communities/me', () =>
      ok(
        {
          memberships: [
            myCommunityFixture(['members.view'], {
              roles: [{ id: 'role-1', name: 'admin', assignedAt: '2026-01-02T00:00:00.000Z' }],
              membership: {
                id: 'membership-1',
                status: 'active',
                membershipNumber: 'YG-7K3Q-M9TD',
                joinedAt: '2026-01-02T00:00:00.000Z',
              },
            }),
          ],
        },
        { pagination: pagination(1) },
      ),
    );
    renderApp('/profile?section=memberships');

    expect(await screen.findByText('YG-7K3Q-M9TD')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Bole Community')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open community' })).toHaveAttribute('href', '/communities/community-1');
  });

  it('renders a membership card whose verification link carries only the card code', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/membership-cards/me', () => ok({ cards: [card] }));
    renderApp('/profile?section=cards');

    const article = await screen.findByRole('article', { name: 'Membership card for Bole Community' });

    expect(within(article).getByText('YG-7K3Q-M9TD')).toBeInTheDocument();
    expect(within(article).getByText('Abebe Kebede')).toBeInTheDocument();
    expect(within(article).getByRole('link', { name: 'Open verification page' })).toHaveAttribute(
      'href',
      `${window.location.origin}/verify/ABCDEFGHJKMNPQRSTUVWXY23`,
    );
    expect(article).not.toHaveTextContent(FIN_DIGITS);
    expect(article).toHaveTextContent('no Fayda number');
  });

  it('signs out another device without offering it for the current one', async () => {
    const user = userEvent.setup();
    let revoked = '';

    signInAs();
    mockWorkspace();
    mockApi('get', '/auth/sessions', () =>
      ok({
        sessions: [
          {
            id: 'session-current',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
            lastActiveAt: '2026-11-25T12:00:00.000Z',
            expiresAt: '2026-12-25T12:00:00.000Z',
            current: true,
          },
          {
            id: 'session-other',
            ipAddress: null,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
            lastActiveAt: '2026-11-24T12:00:00.000Z',
            expiresAt: '2026-12-24T12:00:00.000Z',
            current: false,
          },
        ],
      }),
    );
    mockApi('post', '/auth/sessions/session-other/revoke', () => {
      revoked = 'session-other';

      return ok({});
    });
    renderApp('/profile?section=security');

    const current = (await screen.findByText('Firefox on Linux')).closest('li')!;
    const other = screen.getByText('Safari on iOS').closest('li')!;

    expect(within(current).getByText('This device')).toBeInTheDocument();
    expect(within(current).queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    expect(within(other).getByText(/IP not recorded/)).toBeInTheDocument();

    await user.click(within(other).getByRole('button', { name: 'Sign out' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Sign out that device?' })).getByRole('button', { name: 'Sign out device' }));

    await waitFor(() => expect(revoked).toBe('session-other'));
    expect(await screen.findByText('That device was signed out')).toBeInTheDocument();
  });

  it('keeps a saved notification preference and rolls nothing in until the API agrees', async () => {
    const user = userEvent.setup();
    let body: unknown = null;

    signInAs();
    mockWorkspace();
    mockApi('get', '/notifications/preferences', () => ok({ preferences }));
    mockApi('patch', '/notifications/preferences', async ({ request }) => {
      body = await request.json();

      return ok({
        preferences: { ...preferences, inApp: { ...preferences.inApp, payments: true } },
      });
    });
    renderApp('/profile?section=notifications');

    const payments = await screen.findByRole('switch', { name: 'Payments' });

    expect(payments).toHaveAttribute('aria-checked', 'false');
    await user.click(payments);

    await waitFor(() => expect(body).toEqual({ inApp: { payments: true } }));
    expect(payments).toHaveAttribute('aria-checked', 'true');
  });

  it('opens security from the old settings address', async () => {
    signInAs();
    mockWorkspace();
    mockApi('get', '/auth/sessions', () => ok({ sessions: [] }));
    renderApp('/settings');

    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
  });
});

describe('public membership check', () => {
  it('confirms an active card with member details and nothing else', async () => {
    mockApi('get', '/membership-cards/verify/ABCDEFGHJKMNPQRSTUVWXY23', () =>
      ok({
        card: {
          valid: true,
          status: 'active',
          community: { name: 'Bole Community', communityType: 'equb', logoUrl: null },
          membershipNumber: 'YG-7K3Q-M9TD',
          holderName: 'Abebe K.',
          holderAvatarUrl: null,
          memberSince: '2026-01-02T00:00:00.000Z',
          checkedAt: '2026-11-25T12:00:00.000Z',
        },
      }),
    );
    renderApp('/verify/ABCDEFGHJKMNPQRSTUVWXY23');

    expect(await screen.findByRole('heading', { name: 'Membership check' })).toBeInTheDocument();
    expect(await screen.findByText('Abebe K.')).toBeInTheDocument();
    expect(screen.getByText('YG-7K3Q-M9TD')).toBeInTheDocument();
    expect(screen.queryByText(FIN_DIGITS)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('hides member details when the card is no longer valid', async () => {
    mockApi('get', '/membership-cards/verify/ABCDEFGHJKMNPQRSTUVWXY23', () =>
      ok({
        card: {
          valid: false,
          status: 'suspended',
          community: { name: 'Bole Community', communityType: 'equb', logoUrl: null },
          checkedAt: '2026-11-25T12:00:00.000Z',
        },
      }),
    );
    renderApp('/verify/ABCDEFGHJKMNPQRSTUVWXY23');

    expect(await screen.findByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText(/not active/)).toBeInTheDocument();
    expect(screen.queryByText('YG-7K3Q-M9TD')).not.toBeInTheDocument();
  });

  it('explains a code that does not match a card', async () => {
    mockApi('get', '/membership-cards/verify/UNKNOWNCODEUNKNOWNCODE12', () =>
      fail(404, 'CARD_NOT_FOUND', 'Membership card not found'),
    );
    renderApp('/verify/UNKNOWNCODEUNKNOWNCODE12');

    expect(await screen.findByRole('heading', { name: 'Card not found' })).toBeInTheDocument();
    expect(screen.getByText(/replaced with a new one/)).toBeInTheDocument();
  });
});
