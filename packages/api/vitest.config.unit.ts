import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for unit tests that DON'T need a Postgres test DB.
 * The default `vitest.config.ts` loads `test/setup.ts`, which requires
 * `DATABASE_URL` to point at a real test DB and runs `prisma migrate
 * deploy`. Pure unit tests (HMAC verification, schema validators, pure
 * functions) shouldn't pay that cost.
 *
 * Run via: `pnpm test:unit` (mapped to `vitest run --config vitest.config.unit.ts`).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Convention: any test file under a `__tests__/unit/` folder OR
    // tagged with `.unit.spec.ts` is unit-only.
    include: ['src/**/__tests__/**/*.spec.ts'],
    // Excluded paths get the full DB-backed config via `vitest.config.ts`.
    exclude: ['node_modules', 'dist', 'src/**/__tests__/integration/**'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
