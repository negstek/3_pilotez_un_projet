import type { AuthResponse } from '@datashare/shared-lib'

// Persistence of the session in localStorage. The trade-offs of this choice (vs. an httpOnly cookie) are documented in
// docs/architecture.md.

// Exported so that tests read and write the same key.
export const STORAGE_KEY = 'datashare.session'

export type Session = AuthResponse

/**
 * Expiry date (in ms) read from the JWT payload, or null if it cannot be read. The signature is not checked: the front cannot (it does not
 * know the secret) and does not need to, since the API verifies every request anyway.
 */
function tokenExpiry(token: string): number | null {
  try {
    // The payload is base64url-encoded: convert it to plain base64 for atob().
    const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Returns the saved session, or `null` if it is missing, unreadable or expired. An expired session is discarded right away: there is no
 * point in showing the user as logged in when the API is going to reject their token.
 *
 * @param now Current time, injectable for tests.
 */
export function loadSession(now = Date.now()): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as Session
    const expiry = tokenExpiry(session.accessToken)
    if (expiry === null || expiry <= now) {
      clearSession()
      return null
    }
    return session
  } catch {
    // Corrupted JSON, or localStorage unavailable (private mode, blocked storage): behave as if logged out.
    return null
  }
}

/** Saves the session so it survives a page reload. */
export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

/** Logout: the token is simply forgotten (a JWT cannot be revoked server-side). */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
