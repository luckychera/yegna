import { refreshSession } from '@/lib/auth/refresh';
import { sessionEvents } from '@/lib/auth/session-events';
import { tokenStore } from '@/lib/auth/token-store';
import { ApiError, ERROR_CODES } from './errors';
import { request, type QueryValue } from './http';
import type { Envelope } from './types';

interface CallOptions {
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** Set false for endpoints that must work without a session (login, register). */
  auth?: boolean;
}

async function call<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown,
  options: CallOptions,
): Promise<Envelope<T>> {
  const send = () =>
    request<T>(path, {
      method,
      body,
      query: options.query,
      signal: options.signal,
      accessToken: options.auth === false ? null : tokenStore.getAccessToken(),
    });

  try {
    return await send();
  } catch (error) {
    if (options.auth === false || !(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    if (!tokenStore.hasRefreshToken()) {
      sessionEvents.emitExpired();
      throw error;
    }

    const outcome = await refreshSession();

    if (outcome === 'ok') {
      try {
        return await send();
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401) {
          sessionEvents.emitExpired();
        }

        throw retryError;
      }
    }

    if (outcome === 'invalid') {
      sessionEvents.emitExpired();
      throw error;
    }

    // The refresh could not be attempted (offline / provider down): not a sign-out.
    throw new ApiError('Network request failed', 0, ERROR_CODES.NETWORK);
  }
}

export const api = {
  get: <T>(path: string, options: CallOptions = {}) => call<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options: CallOptions = {}) => call<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options: CallOptions = {}) => call<T>('PATCH', path, body, options),
  delete: <T>(path: string, options: CallOptions = {}) => call<T>('DELETE', path, undefined, options),
};
