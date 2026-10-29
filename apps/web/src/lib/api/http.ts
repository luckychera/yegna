import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, ERROR_CODES } from './errors';
import type { Envelope } from './types';

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  accessToken?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();

  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) {
    return null;
  }

  const seconds = Number(header);

  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/**
 * Low-level transport: no authentication logic. Always resolves to the success envelope or
 * throws an ApiError (including network failures and timeouts).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const { method = 'GET', body, query, accessToken, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();

  signal?.addEventListener('abort', onExternalAbort);

  try {
    let response: Response;

    try {
      response = await fetch(buildUrl(path, query), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) {
        throw new ApiError('Request timed out', 0, ERROR_CODES.TIMEOUT);
      }

      if (signal?.aborted) {
        throw error;
      }

      throw new ApiError('Network request failed', 0, ERROR_CODES.NETWORK);
    }

    const text = await response.text();
    let json: unknown = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    const payload = (json ?? {}) as {
      success?: boolean;
      data?: T;
      message?: string;
      pagination?: Envelope<T>['pagination'];
      error?: { code?: string; message?: string };
    };

    if (!response.ok || payload.success === false) {
      throw new ApiError(
        payload.error?.message ?? response.statusText ?? 'Request failed',
        response.status,
        payload.error?.code ?? `HTTP_${response.status}`,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }

    if (json === null && response.status !== 204) {
      throw new ApiError('Unexpected response from the server', response.status, ERROR_CODES.INVALID_RESPONSE);
    }

    return {
      data: payload.data as T,
      message: payload.message,
      pagination: payload.pagination,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
