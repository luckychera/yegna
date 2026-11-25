import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from '@/app/providers/AppProviders';
import { createTestRouter } from '@/app/router/routes';
import { tokenStore } from '@/lib/auth/token-store';
import type { UserProfile } from '@/features/auth/auth.types';
import { mockApi, ok, pagination } from './api';
import { myCommunityFixture, profileFixture } from './factories';

/** Renders the real router and providers at a path. */
export function renderApp(path: string) {
  const router = createTestRouter([path]);
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { ...utils, router };
}

/**
 * Makes the app boot as a signed-in user: a stored refresh token that the (mocked) backend
 * accepts, plus the quiet background endpoints every screen touches.
 */
export function signInAs(
  options: { profile?: UserProfile; permissions?: string[] } = {},
) {
  tokenStore.setTokens('fresh-access', 'stored-refresh');

  mockApi('get', '/users/me', () =>
    ok(options.profile ?? profileFixture()),
  );

  mockApi('post', '/auth/refresh', () =>
    ok({
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh',
      refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
    }),
  );

  mockApi('get', '/notifications/unread-count', () =>
    ok({ unreadCount: 0 }),
  );

  mockApi('get', '/invitations/me', () =>
    ok(
      { invitations: [] },
      { pagination: pagination(0) },
    ),
  );
}
/** Quiet default data for the screens a signed-in user lands on. Override per test as needed. */
export function mockWorkspace(options: { permissions?: string[] } = {}) {
  mockApi('get', '/communities/me', () => {
    console.log('[reports-test] /communities/me MOCK HIT');

    return ok(
      { memberships: [myCommunityFixture(options.permissions ?? [])] },
      { pagination: pagination(1) },
    );
  });
  mockApi('get', '/contributions/me', () => ok({ contributions: [], summary: [] }, { pagination: pagination(0) }));
  mockApi('get', '/payments/me', () => ok({ payments: [], summary: [] }, { pagination: pagination(0) }));
  mockApi('get', '/notifications', () => ok([], { pagination: { limit: 5, offset: 0, count: 0 } }));
}
