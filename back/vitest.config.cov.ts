import { defineConfig } from 'vitest/config';

// Configuration of the coverage report (`npm run test:cov`). The unit tests and the e2e API tests run together, as two projects, and their
// coverage is merged: controllers, guards and the JWT strategy are only exercised through HTTP, by the e2e tests, so a report limited to
// the unit tests would count them as untested. Like `npm run test:e2e`, it needs the PostgreSQL of docker-compose.
export default defineConfig({
  test: {
    projects: ['./vitest.config.ts', './vitest.config.e2e.ts'],
    coverage: {
      // Every source file counts, including the ones no test loads (otherwise they would simply be missing from the report).
      include: ['src/**/*.ts'],
      // Not ours to test: the generated Prisma client. Without logic: the entry point and the Nest modules (wiring only).
      exclude: ['src/generated/**', 'src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts'],
      reporter: ['text', 'html', 'json'],
      // The command fails under the 70 % required by the specifications.
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});
