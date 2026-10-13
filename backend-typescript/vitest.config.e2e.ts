import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Some legacy suites clear entire tables. Never let them use the application DB.
const testDatabase = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (!testDatabase || !['localhost', '127.0.0.1'].includes(testDatabase.hostname) || !testDatabase.pathname.endsWith('_test')) {
  throw new Error('E2E requires DATABASE_URL pointing to a dedicated localhost database whose name ends in _test. Do not use evolix_trade_dev.');
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    setupFiles:['./test/security-fixture.setup.ts'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
