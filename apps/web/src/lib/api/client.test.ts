import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { refreshSession } from '@/lib/auth/refresh';
import { sessionEvents } from '@/lib/auth/session-events';
import { tokenStore } from '@/lib/auth/token-store';
import { API, fail, mockApi, ok } from '@/test/api';
import { server } from '@/test/server';
import { api } from './client';
import { ApiError } from './errors';
import { request } from './http';

function protectedEndpoint(validToken = 'fresh-access') {
  mockApi('get', '/users/me', ({ request: req }) =>
    req.headers.get('authorization') === `Bearer ${validToken}`
      ? ok({ id: 'user-1' })
      : fail(401, 'INVALID_TOKEN', 'Invalid or expired token'),
  );
}

describe('api client: requests', () => {
  it('sends the in-memory access token and unwraps the envelope', async () => {
    tokenStore.setTokens('fresh-access', 'refresh-1');
    protectedEndpoint();

    const { data } = await api.get<{ id: string }>('/users/me');

    expect(data).toEqual({ id: 'user-1' });
  });

  it('does not send credentials for public endpoints', async () => {
    let header: string | null = 'unset';

    tokenStore.setTokens('fresh-access', 'refresh-1');
    mockApi('post', '/auth/login', ({ request: req }) => {
      header = req.headers.get('authorization');

      return ok({});
    });

    await api.post('/auth/login', {}, { auth: false });

    expect(header).toBeNull();
  });

  it('turns network failures into a typed ApiError', async () => {
    mockApi('get', '/users/me', () => HttpResponse.error());

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('times out slow requests', async () => {
    mockApi('get', '/users/me', async () => {
      await delay(300);

      return ok({});
    });

    await expect(request('/users/me', { timeoutMs: 20 })).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  });

  it('reads Retry-After from rate limit responses', async () => {
    mockApi('get', '/users/me', () => fail(429, 'RATE_LIMITED', 'Too many requests', { 'Retry-After': '42' }));

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 429, retryAfterSeconds: 42 });
  });

  it('rejects responses that are not valid JSON', async () => {
    mockApi('get', '/users/me', () => new HttpResponse('<html>gateway</html>', { status: 200 }));

    await expect(api.get('/users/me')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('api client: token refresh', () => {
  it('refreshes once on 401, rotates the stored refresh token and retries the request', async () => {
    tokenStore.setTokens('stale-access', 'refresh-1');
    protectedEndpoint();

    let refreshBody: unknown = null;

    mockApi('post', '/auth/refresh', async ({ request: req }) => {
      refreshBody = await req.json();

      return ok({ accessToken: 'fresh-access', refreshToken: 'refresh-2', refreshTokenExpiresAt: '2099-01-01' });
    });

    const { data } = await api.get<{ id: string }>('/users/me');

    expect(data.id).toBe('user-1');
    expect(refreshBody).toEqual({ refreshToken: 'refresh-1' });
    expect(tokenStore.getRefreshToken()).toBe('refresh-2');
    expect(tokenStore.getAccessToken()).toBe('fresh-access');
  });

  it('shares ONE refresh between concurrent 401s (the backend revokes everything on token reuse)', async () => {
    tokenStore.setTokens('stale-access', 'refresh-1');
    protectedEndpoint();

    let refreshCalls = 0;

    mockApi('post', '/auth/refresh', async () => {
      refreshCalls += 1;
      await delay(40);

      return ok({ accessToken: 'fresh-access', refreshToken: 'refresh-2', refreshTokenExpiresAt: '2099-01-01' });
    });

    const results = await Promise.all([api.get('/users/me'), api.get('/users/me'), api.get('/users/me')]);

    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it('serializes refreshes across tabs with the Web Locks API when available', async () => {
    const request = vi.fn(async (_name: string, task: () => Promise<unknown>) => task());

    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    try {
      tokenStore.setTokens('stale-access', 'refresh-1');
      mockApi('post', '/auth/refresh', () =>
        ok({ accessToken: 'fresh-access', refreshToken: 'refresh-2', refreshTokenExpiresAt: '2099-01-01' }),
      );

      expect(await refreshSession()).toBe('ok');
      expect(request).toHaveBeenCalledWith('yegna-refresh-token', expect.any(Function));
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('ends the session when the refresh token is rejected', async () => {
    tokenStore.setTokens('stale-access', 'refresh-1');
    protectedEndpoint();
    mockApi('post', '/auth/refresh', () => fail(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token'));

    const expired = vi.fn();
    const off = sessionEvents.onExpired(expired);

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 401 });

    off();
    expect(expired).toHaveBeenCalledTimes(1);
    expect(tokenStore.getRefreshToken()).toBeNull();
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('keeps the session when the refresh endpoint is unreachable (not a sign-out)', async () => {
    tokenStore.setTokens('stale-access', 'refresh-1');
    protectedEndpoint();
    mockApi('post', '/auth/refresh', () => HttpResponse.json({}, { status: 503 }));

    const expired = vi.fn();
    const off = sessionEvents.onExpired(expired);

    await expect(api.get('/users/me')).rejects.toBeInstanceOf(ApiError);

    off();
    expect(expired).not.toHaveBeenCalled();
    expect(tokenStore.getRefreshToken()).toBe('refresh-1');
  });

  it('signs out when there is no refresh token to try', async () => {
    protectedEndpoint();

    const expired = vi.fn();
    const off = sessionEvents.onExpired(expired);

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 401 });

    off();
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not loop: a second 401 after a successful refresh ends the session', async () => {
    tokenStore.setTokens('stale-access', 'refresh-1');
    protectedEndpoint('some-other-token');

    let refreshCalls = 0;

    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;

        return ok({ accessToken: 'fresh-access', refreshToken: 'refresh-2', refreshTokenExpiresAt: '2099-01-01' });
      }),
    );

    const expired = vi.fn();
    const off = sessionEvents.onExpired(expired);

    await expect(api.get('/users/me')).rejects.toMatchObject({ status: 401 });

    off();
    expect(refreshCalls).toBe(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
