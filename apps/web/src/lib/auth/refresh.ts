import { ApiError } from '@/lib/api/errors';
import { request } from '@/lib/api/http';
import { tokenStore } from './token-store';

export type RefreshOutcome = 'ok' | 'invalid' | 'unavailable';

interface RefreshPayload {
  accessToken: string;
  refreshToken: string;
}

const LOCK_NAME = 'yegna-refresh-token';

let inflight: Promise<RefreshOutcome> | null = null;

async function withCrossTabLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;

  if (locks?.request) {
    return locks.request(LOCK_NAME, task);
  }

  return task();
}

async function performRefresh(): Promise<RefreshOutcome> {
  // Read the token INSIDE the lock so we always send the newest rotated value.
  // The backend revokes every session if a rotated refresh token is ever reused.
  const refreshToken = tokenStore.getRefreshToken();

  if (!refreshToken) {
    return 'invalid';
  }

  try {
    const { data } = await request<RefreshPayload>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });

    tokenStore.setTokens(data.accessToken, data.refreshToken);

    return 'ok';
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
      tokenStore.clear();

      return 'invalid';
    }

    // Network failure, timeout, 5xx or rate limit: keep the session and let the caller retry later.
    return 'unavailable';
  }
}

/**
 * Single-flight refresh: concurrent callers in this tab share one request, and the Web Locks
 * API serializes refreshes across tabs so the same refresh token is never sent twice.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  if (!inflight) {
    inflight = withCrossTabLock(performRefresh).finally(() => {
      inflight = null;
    });
  }

  return inflight;
}
