import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { tokenStore } from '@/lib/auth/token-store';
import { fail, mockApi, ok } from '@/test/api';
import { profileFixture } from '@/test/factories';
import { mockWorkspace, renderApp } from '@/test/render';

type User = ReturnType<typeof userEvent.setup>;

async function completeAccountStep(user: User) {
  await user.type(await screen.findByLabelText('Email address'), 'Abebe@Example.com');
  await user.type(screen.getByLabelText(/Phone number/), '0911234567');
  await user.type(screen.getByLabelText('Password'), 'Secret123');
  await user.type(screen.getByLabelText('Confirm password'), 'Secret123');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function completePersonalStep(user: User) {
  await user.type(await screen.findByLabelText('First name'), 'Abebe');
  await user.type(screen.getByLabelText('Last name'), 'Kebede');
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

async function submitFayda(user: User, number = '100000000001') {
  await user.type(await screen.findByLabelText('FIN number'), number);
  await user.click(screen.getByRole('button', { name: 'Verify with Fayda' }));
}

function mockSuccessfulRegistration(capture?: (body: unknown) => void) {
  mockApi('post', '/auth/register', async ({ request }) => {
    capture?.(await request.json());

    return ok(
      {
        user: { id: 'user-1', email: 'abebe@example.com', phone: '+251911234567', status: 'active' },
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        refreshTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      },
      {},
      201,
    );
  });
  mockApi('get', '/users/me', () => ok(profileFixture()));
  mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 0 }));
  mockApi('get', '/invitations/me', () => ok({ invitations: [] }, { pagination: { limit: 1, offset: 0, count: 0, total: 0 } }));
  mockWorkspace();
}

describe('RegisterPage', () => {
  it('walks through account, personal and Fayda steps, then signs the user in', async () => {
    const user = userEvent.setup();
    let body: unknown;

    mockSuccessfulRegistration((captured) => (body = captured));
    renderApp('/register');

    expect(await screen.findByRole('heading', { name: 'Create Your Account' })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Account');

    await completeAccountStep(user);
    expect(await screen.findByRole('listitem', { current: 'step' })).toHaveTextContent('Personal');

    await completePersonalStep(user);
    expect(await screen.findByRole('heading', { name: 'Fayda Identity Verification' })).toBeInTheDocument();

    await submitFayda(user);

    expect(await screen.findByRole('heading', { name: "You're all set!" })).toBeInTheDocument();
    expect(body).toEqual({
      faydaIdentifier: '100000000001',
      faydaIdentifierType: 'fin',
      email: 'abebe@example.com',
      phone: '+251911234567',
      password: 'Secret123',
      firstName: 'Abebe',
      lastName: 'Kebede',
    });
    expect(tokenStore.getRefreshToken()).toBe('refresh-1');

    // the success screen stays visible even though the user is now signed in
    await user.click(screen.getByRole('button', { name: 'Continue to Yegna' }));
    expect(await screen.findByRole('heading', { name: /Abebe/ })).toBeInTheDocument();
  });

  it('validates the account step before moving on', async () => {
    const user = userEvent.setup();

    renderApp('/register');
    await user.click(await screen.findByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email address'), 'abebe@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.type(screen.getByLabelText('Confirm password'), 'Different123');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Account');
  });

  it('checks the Fayda number looks right and lets the user pick FAN or FIN', async () => {
    const user = userEvent.setup();

    renderApp('/register');
    await completeAccountStep(user);
    await completePersonalStep(user);

    await user.type(await screen.findByLabelText('FIN number'), '12345');
    await user.click(screen.getByRole('button', { name: 'Verify with Fayda' }));

    expect(await screen.findByText('Enter the 12 to 16 digit number on your Fayda ID.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('ID type'), 'fan');
    expect(screen.getByLabelText('FAN number')).toBeInTheDocument();
  });

  it('sends the selected ID type with the number', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> = {};

    mockSuccessfulRegistration((captured) => (body = captured as Record<string, unknown>));
    renderApp('/register');
    await completeAccountStep(user);
    await completePersonalStep(user);

    await user.selectOptions(await screen.findByLabelText('ID type'), 'fan');
    await user.type(screen.getByLabelText('FAN number'), '100000000002');
    await user.click(screen.getByRole('button', { name: 'Verify with Fayda' }));

    await screen.findByRole('heading', { name: "You're all set!" });
    expect(body.faydaIdentifierType).toBe('fan');
    expect(body.faydaIdentifier).toBe('100000000002');
  });

  it('keeps the user on the Fayda step with a clear message when verification fails', async () => {
    const user = userEvent.setup();

    mockApi('post', '/auth/register', () => fail(400, 'FAYDA_VERIFICATION_FAILED', 'Fayda verification failed'));
    renderApp('/register');
    await completeAccountStep(user);
    await completePersonalStep(user);
    await submitFayda(user, '999999999999');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't verify that Fayda ID");
    expect(screen.getByRole('heading', { name: 'Fayda Identity Verification' })).toBeInTheDocument();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('sends the user back to the Account step when the email or phone is already registered', async () => {
    const user = userEvent.setup();

    mockApi('post', '/auth/register', () => fail(409, 'ACCOUNT_ALREADY_EXISTS', 'Account already exists'));
    renderApp('/register');
    await completeAccountStep(user);
    await completePersonalStep(user);
    await submitFayda(user);

    expect(await screen.findByText('An account with that email or phone number already exists.')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Account');
    // earlier answers are kept so the user only fixes what is wrong
    expect(screen.getByLabelText('Email address')).toHaveValue('Abebe@Example.com');
  });

  it('lets the user go back and edit a previous step without losing answers', async () => {
    const user = userEvent.setup();

    renderApp('/register');
    await completeAccountStep(user);
    await screen.findByLabelText('First name');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByLabelText('Email address')).toHaveValue('Abebe@Example.com');
  });

  it('links to sign in', async () => {
    renderApp('/register');

    expect(await screen.findByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
  });
});
