import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Live contract test: runs the web app's real API modules against a real, running backend
 * (no mocks). Start the backend first, then `npm run test:integration`.
 * YEGNA_API_URL defaults to http://127.0.0.1:5055/api/v1.
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.int.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    env: { VITE_API_BASE_URL: process.env.YEGNA_API_URL ?? 'http://127.0.0.1:5055/api/v1' },
  },
});
