import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { config } from 'dotenv';

// Configuration of the e2e tests (`npm run test:e2e`): the whole Nest application is started and called over HTTP with Supertest, against a
// real PostgreSQL test database.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Names the project in the coverage run, which combines both configurations (vitest.config.cov.ts).
    name: 'e2e',
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Injected into the test processes before AppModule loads, so they take precedence over the development `.env` read by ConfigModule.
    env: config({ path: '.env.test', quiet: true }).parsed,
    // All suites share the same test database and empty it between tests: running files in parallel would make them wipe each other's data.
    fileParallelism: false,
  },
});
