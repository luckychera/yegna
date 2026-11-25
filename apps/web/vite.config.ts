import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // In development the browser talks to Vite, which forwards /api to the backend,
    // so no CORS configuration is needed locally.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // The live contract test needs a running backend: run it with `npm run test:integration`.
    exclude: [...configDefaults.exclude, 'src/**/*.int.test.ts'],
    env: { VITE_API_BASE_URL: 'http://localhost/api/v1' },
    restoreMocks: true,
    clearMocks: true,
  },
});
