import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fail, mockApi, ok, pagination } from '@/test/api';
import { invitationFixture } from '@/test/factories';
import { mockWorkspace, renderApp, signInAs } from '@/test/render';

function mockInvitations(items: ReturnType<typeof invitationFixture>[]) {
  mockApi('get', '/invitations/me', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    const filtered = items.filter((item) => !status || item.status === status);

    return ok({ invitations: filtered }, { pagination: pagination(filtered.length) });
  });
}

describe('InvitationsPage', () => {
  it('lists pending invitations with the community and who invited the member', async () => {
    signInAs();
    mockWorkspace();
    mockInvitations([invitationFixture({ id: 'a', community: { id: 'c1', name: 'Bole Community', logoUrl: null } })]);
    renderApp('/invitations');

    expect(await screen.findByText('Bole Community')).toBeInTheDocument();
    expect(screen.getByText(/Invited by Eyob Tesfaye/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept invitation to Bole Community' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pending \(1\)/ })).toBeInTheDocument();
  });

  it('accepts an invitation by its ID and confirms it', async () => {
    const user = userEvent.setup();
    let accepted = false;

    signInAs();
    mockWorkspace();
    mockInvitations([invitationFixture({ id: 'inv-42' })]);
    mockApi('post', '/invitations/inv-42/accept', () => {
      accepted = true;

      return ok({});
    });
    renderApp('/invitations');

    await user.click(await screen.findByRole('button', { name: /Accept invitation/ }));

    expect(await screen.findByText('Invitation accepted')).toBeInTheDocument();
    expect(accepted).toBe(true);
  });

  it('asks for confirmation, explaining the consequence, before rejecting', async () => {
    const user = userEvent.setup();
    let rejected = false;

    signInAs();
    mockWorkspace();
    mockInvitations([invitationFixture({ id: 'inv-7' })]);
    mockApi('post', '/invitations/inv-7/reject', () => {
      rejected = true;

      return ok({});
    });
    renderApp('/invitations');

    await user.click(await screen.findByRole('button', { name: /Reject invitation/ }));
    expect(rejected).toBe(false);

    const dialog = await screen.findByRole('dialog', { name: /Reject invitation to Bole Community/ });

    expect(within(dialog).getByText(/You won't join this community/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reject Invitation' }));

    expect(await screen.findByText('Invitation rejected')).toBeInTheDocument();
    expect(rejected).toBe(true);
  });

  it('explains why an invitation cannot be accepted (expired)', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockInvitations([invitationFixture()]);
    mockApi('post', '/invitations/inv-1/accept', () => fail(409, 'INVITATION_EXPIRED', 'Invitation expired'));
    renderApp('/invitations');

    await user.click(await screen.findByRole('button', { name: /Accept invitation/ }));

    expect(await screen.findByText('This invitation has expired.')).toBeInTheDocument();
  });

  it('shows accepted invitations with a link to the community', async () => {
    const user = userEvent.setup();

    signInAs();
    mockWorkspace();
    mockInvitations([invitationFixture({ id: 'x', status: 'accepted' })]);
    renderApp('/invitations');

    await user.click(await screen.findByRole('tab', { name: /Accepted/ }));

    expect(await screen.findByRole('link', { name: 'View community' })).toHaveAttribute('href', '/communities/community-1');
    expect(screen.queryByRole('button', { name: /Accept invitation/ })).not.toBeInTheDocument();
  });

  it('has a friendly empty state', async () => {
    signInAs();
    mockWorkspace();
    mockInvitations([]);
    renderApp('/invitations');

    expect(await screen.findByText("You don't have any pending invitations.")).toBeInTheDocument();
  });
});
