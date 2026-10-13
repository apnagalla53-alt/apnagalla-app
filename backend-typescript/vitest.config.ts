import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

const testDatabase=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
if(!testDatabase||!['localhost','127.0.0.1'].includes(testDatabase.hostname)||!testDatabase.pathname.endsWith('_test')) {
  throw new Error('Database tests require an explicitly configured disposable local *_test database');
}

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    fileParallelism: false,
  },
});
