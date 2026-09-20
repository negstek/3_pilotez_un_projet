import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Sous WSL2 : écoute sur toutes les interfaces pour être joignable depuis le
  // navigateur Windows, et port 8080 car le 5173 par défaut tombe dans une plage
  // réservée par Hyper-V (cf. `netsh int ipv4 show excludedportrange protocol=tcp`).
  server: { host: true, port: 8080, strictPort: true },
})
