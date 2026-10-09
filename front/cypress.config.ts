import { defineConfig } from 'cypress'

// End-to-end tests (`npm run e2e` at the repository root): a real browser drives the front, which talks to a real back on the test
// database. The stack is started on its own ports (front 8081, back 3001), so it never collides with a development session.
export default defineConfig({
  e2e: {
    baseUrl: 'https://localhost:8081',
    // No custom commands nor global hooks: the few shared helpers are plain functions imported by the specs.
    supportFile: false,
  },
})
