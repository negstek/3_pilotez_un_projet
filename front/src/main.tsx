import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import './index.css'

// Provider order matters: AuthProvider sits inside BrowserRouter so that auth related components (RequireAuth, forms) can use the router
// hooks.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
