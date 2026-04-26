import { defineConfig } from 'vitest/config';

/**
 * Local vitest config for @coforma/web.
 *
 * The repo-root vitest.config.ts can't be used from inside this package
 * because vitest is installed only in this package's node_modules (and
 * also in @coforma/api). Pre-existing test debt: there are no other
 * tests in this package today.
 *
 * Scope: src/**\/*.test.ts only — keep app code (which pulls in `next`,
 * `jose`, prisma, etc.) out of the test resolver path until a proper
 * Next.js test setup exists.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    testTimeout: 10000,
  },
});
