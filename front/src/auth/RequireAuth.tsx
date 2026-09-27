import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthContext.tsx'

/**
 * Guards a route: visitors who are not logged in are redirected to /login. The requested path is passed in the navigation state so that the
 * login form can bring the user back to it afterwards (see useAuthForm).
 *
 * This is a UX convenience only: actual access control is enforced by the API, which rejects requests without a valid token.
 */
export function RequireAuth({ children }: Readonly<{ children: ReactNode }>) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    // `replace` keeps the protected URL out of the history, so "back" after logging in does not loop through the redirect.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
