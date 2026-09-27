/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev server tuned for WSL2:
  // - `host: true` listens on all interfaces, otherwise the Windows browser cannot reach a server bound to 127.0.0.1 inside WSL;
  // - port 8080 because Vite's default 5173 falls within a TCP range reserved by Hyper-V on Windows (`netsh int ipv4 show excludedportrange
  //   protocol=tcp`), which prevents WSL from forwarding it;
  // - `strictPort` fails loudly if 8080 is taken, instead of silently moving to another port that the debug configuration would not know
  //   about.
  server: { host: true, port: 8080, strictPort: true },
  // Vitest: component tests run in a simulated DOM (jsdom).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
