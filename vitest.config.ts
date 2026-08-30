import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Mirrors tsconfig.json's "@/*": ["./*"] path mapping. Needed so tests can
  // import app/api route handlers the same way the app itself does (e.g.
  // "@/lib/db") — without this, importing a route handler in a test fails
  // to resolve before vi.mock() ever gets a chance to intercept it.
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
