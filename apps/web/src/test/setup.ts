import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { tokenStore } from '@/lib/auth/token-store';
import { server } from './server';

// Lazy route chunks (Recharts in particular) can take a moment to load on a cold start.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });

  // jsdom has no layout engine; Recharts' ResponsiveContainer needs a ResizeObserver to exist.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  tokenStore.clear();
  window.localStorage.clear();
});

afterAll(() => server.close());
