import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser, Credentials } from '@datashare/shared-lib'
import { loginUser, registerUser } from '../api/auth.ts'
import { clearSession, loadSession, saveSession, type Session } from './session.ts'

// Authentication state shared by the whole app. A plain React Context is enough: the session is the only truly global client state (see the
// note on Redux in docs/architecture.md).

interface AuthContextValue {
  user: AuthUser | null
  /** JWT to pass to apiRequest() for protected routes. */
  token: string | null
  /** Opens a session; rejects with ApiError so the form can show the message. */
  login: (credentials: Credentials) => Promise<void>
  /** Creates the account then opens a session (the API returns a token). */
  register: (credentials: Credentials) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Holds the session and keeps it in sync with localStorage. */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // Lazy initializer: the saved session is read once, on first render, so a page reload keeps the user logged in.
  const [session, setSession] = useState<Session | null>(() => loadSession())

  // Memoized so that consumers of useAuth() only re-render when the session actually changes, not on every render of the provider.
  const value = useMemo<AuthContextValue>(() => {
    const open = (next: Session) => {
      saveSession(next)
      setSession(next)
    }
    return {
      user: session?.user ?? null,
      token: session?.accessToken ?? null,
      login: async (credentials) => open(await loginUser(credentials)),
      register: async (credentials) => open(await registerUser(credentials)),
      logout: () => {
        clearSession()
        setSession(null)
      },
    }
  }, [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Reads the authentication state; throws if used outside <AuthProvider>. */
// The hook lives next to its provider on purpose; the rule only matters for fast refresh, which still works for AuthProvider.
// eslint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within <AuthProvider>')
  return context
}
