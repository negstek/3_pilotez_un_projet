/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // basicSsl: serves the dev server over HTTPS with a self-signed certificate generated on first start (the browser asks once to accept
  // it), so that development uses the same scheme as production.
  plugins: [react(), basicSsl()],
  // Dev server tuned for WSL2:
  // - `host: true` listens on all interfaces, otherwise the Windows browser cannot reach a server bound to 127.0.0.1 inside WSL;
  // - port 8080 because Vite's default 5173 falls within a TCP range reserved by Hyper-V on Windows (`netsh int ipv4 show excludedportrange
  //   protocol=tcp`), which prevents WSL from forwarding it;
  // - `strictPort` fails loudly if 8080 is taken, instead of silently moving to another port that the debug configuration would not know
  //   about.
  // The API is reached through the same origin under /api: the browser only talks HTTPS to Vite, which forwards to NestJS over plain HTTP
  // on the loopback, the way the production reverse proxy will. Being same-origin, the API needs no CORS. `vite preview` reuses this proxy.
  server: {
    host: true,
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  // Vitest: component tests run in a simulated DOM (jsdom).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
