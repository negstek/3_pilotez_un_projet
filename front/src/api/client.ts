// Base URL of the API, injected at build time by Vite from front/.env.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/**
 * HTTP error returned by the API, built from the contract's `Error` body. `status` lets screens react to a specific case (401, 409…);
 * `message` is already user-readable (the API writes it in French) and can be shown as is. `status` is 0 when the server could not be
 * reached at all.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  token?: string | null
}

/**
 * Single entry point to the REST API: screens never call `fetch` directly. This keeps headers and error handling in one place, and lets
 * component tests mock the `src/api/` modules with `vi.mock` instead of the network.
 *
 * @param token JWT added as `Authorization: Bearer` for protected routes.
 * @throws ApiError for any non-2xx response or network failure.
 */
export async function apiRequest<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    // fetch only rejects when no HTTP response was received (server down, network error, CORS rejection).
    throw new ApiError(0, 'Le serveur est injoignable, réessayez plus tard.')
  }

  if (!response.ok) {
    // The body may not be JSON (e.g. a proxy error page): fall back to a generic message rather than crashing on the parse error.
    const error = (await response.json().catch(() => null)) as {
      message?: string
    } | null
    throw new ApiError(response.status, error?.message ?? 'Une erreur inattendue est survenue.')
  }
  return (await response.json()) as T
}
