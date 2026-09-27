import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Loaded before every test file (see `test.setupFiles` in vite.config.ts). Each test starts from a blank DOM and an empty localStorage, so
// a session saved by one test cannot leak into the next.
afterEach(() => {
  cleanup()
  localStorage.clear()
})
