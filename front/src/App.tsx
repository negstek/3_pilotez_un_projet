import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth.tsx'
import { DownloadPage } from './pages/DownloadPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { MySpacePage } from './pages/MySpacePage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'

/**
 * Application routes. Public screens are reachable by anyone; the personal space is wrapped in RequireAuth. Unknown URLs fall back to the
 * home page.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Shared download link (US02), public: the token is the only key to the file. */}
      <Route path="/f/:token" element={<DownloadPage />} />
      <Route
        path="/mon-espace"
        element={
          <RequireAuth>
            <MySpacePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
