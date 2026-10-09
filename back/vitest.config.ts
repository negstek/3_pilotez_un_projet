import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones added by `nest g library` (native to Vite, which replaced the
  // vite-tsconfig-paths plugin).
  resolve: { tsconfigPaths: true },
  test: {
    // Names the project in the coverage run, which combines both configurations (vitest.config.cov.ts).
    name: 'unit',
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    setupFiles: ['./test/silence-logger.ts'],
  },
});
