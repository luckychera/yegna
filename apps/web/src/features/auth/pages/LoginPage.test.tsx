import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { tokenStore } from '@/lib/auth/token-store';
import { fail, mockApi, ok } from '@/test/api';
import { profileFixture } from '@/test/factories';
import { mockWorkspace, renderApp } from '@/test/render';

const AUTH_RESPONSE = {
  user: { id: 'user-1', email: 'abebe@example.com', phone: null, status: 'active' },
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2099-01-01T00:00:00.000Z',
};

function mockSuccessfulLogin(capture?: (body: unknown) => void) {
  mockApi('post', '/auth/login', async ({ request }) => {
    capture?.(await request.json());

    return ok(AUTH_RESPONSE);
  });
  mockApi('get', '/users/me', () => ok(profileFixture()));
  mockApi('get', '/notifications/unread-count', () => ok({ unreadCount: 0 }));
  mockApi('get', '/invitations/me', () => ok({ invitations: [] }, { pagination: { limit: 1, offset: 0, count: 0, total: 0 } }));
  mockWorkspace();
}

describe('LoginPage', () => {
  it('signs in with an email and lands on the dashboard', async () => {
    const user = userEvent.setup();
    let body: unknown;

    mockSuccessfulLogin((captured) => (body = captured));
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email or phone number'), 'Abebe@Example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('heading', { name: /Abebe/ })).toBeInTheDocument();
    expect(body).toEqual({ email: 'abebe@example.com', password: 'Secret123' });
    expect(tokenStore.getRefreshToken()).toBe('refresh-1');
  });

  it('accepts a phone number and sends it in the normalized format', async () => {
    const user = userEvent.setup();
    let body: unknown;

    mockSuccessfulLogin((captured) => (body = captured));
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email or phone number'), '0911234567');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByRole('heading', { name: /Abebe/ });
    expect(body).toEqual({ phone: '+251911234567', password: 'Secret123' });
  });

  it('shows a friendly message for invalid credentials and stays on the form', async () => {
    const user = userEvent.setup();

    mockApi('post', '/auth/login', () => fail(401, 'INVALID_CREDENTIALS', 'Invalid credentials'));
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email or phone number'), 'abebe@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The email, phone number or password is incorrect.');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    expect(tokenStore.getRefreshToken()).toBeNull();
  });

  it('validates the fields before calling the API', async () => {
    const user = userEvent.setup();

    renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter your email or phone number.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email or phone number'), 'not valid');
    await user.type(screen.getByLabelText('Password'), 'x');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Enter a valid email or Ethiopian phone number.')).toBeInTheDocument();
  });

  it('reports a network failure without exposing technical details', async () => {
    const user = userEvent.setup();

    mockApi('post', '/auth/login', () => HttpResponse.error());
    renderApp('/login');

    await user.type(await screen.findByLabelText('Email or phone number'), 'abebe@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't reach Yegna/i);
  });

  it('lets the user reveal and hide the password', async () => {
    const user = userEvent.setup();

    renderApp('/login');

    const password = await screen.findByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('does not offer sign-in options the backend does not support', async () => {
    renderApp('/login');

    await screen.findByRole('button', { name: 'Sign In' });
    expect(screen.queryByText(/continue with fayda/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });
});
