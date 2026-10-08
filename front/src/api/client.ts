// Base URL of the API, injected at build time by Vite from front/.env. Defaults to the same-origin /api prefix, proxied to NestJS by
// the Vite dev server (vite.config.ts) and by the reverse proxy in production.
const API_URL = import.meta.env.VITE_API_URL ?? '/api'

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
  /** Sent as JSON, except FormData (file upload), sent as multipart/form-data. */
  body?: unknown
  /** JWT of the session; null or absent for a public route. */
  token?: string | null
}

/**
 * Single entry point to the REST API: screens never call `fetch` directly. This keeps headers and error handling in one place, and lets
 * component tests mock the `src/api/` modules with `vi.mock` instead of the network.
 *
 * @param token JWT added as `Authorization: Bearer` for protected routes.
 * @throws ApiError for any non-2xx response or network failure.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  // 204 No Content (deletion) has no body to parse.
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Same as apiRequest, for a binary response (file download). */
export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  return (await send(path, options)).blob()
}

/** Sends the request and turns any failure into an ApiError; the caller reads the body in the format it expects (JSON or Blob). */
async function send(path: string, { method = 'GET', body, token }: RequestOptions): Promise<Response> {
  const isForm = body instanceof FormData
  const headers: Record<string, string> = {}
  // For FormData, the browser sets the multipart Content-Type itself, with the boundary separating the parts.
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined || isForm ? body : JSON.stringify(body),
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
  return response
}
