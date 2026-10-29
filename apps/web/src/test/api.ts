import { HttpResponse, http } from 'msw';

import { server } from './server';

export const API = 'http://localhost/api/v1';

export function ok<T>(data: T, extra: Record<string, unknown> = {}, status = 200) {
  return HttpResponse.json({ success: true, data, ...extra }, { status });
}

export function fail(status: number, code: string, message: string, headers?: Record<string, string>) {
  return HttpResponse.json({ success: false, error: { code, message } }, { status, headers });
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Registers a handler for one endpoint (relative to the API base URL). */
export function mockApi(method: Method, path: string, resolver: Parameters<typeof http.get>[1]) {
  server.use(http[method](`${API}${path}`, resolver));
}

export function pagination(count: number, total = count, limit = 20, offset = 0) {
  return { limit, offset, count, total };
}
