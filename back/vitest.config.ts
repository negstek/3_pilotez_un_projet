import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    // Names the project in the coverage run, which combines both configurations (vitest.config.cov.ts).
    name: 'unit',
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
