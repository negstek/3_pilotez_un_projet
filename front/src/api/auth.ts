import type { AuthResponse, Credentials } from '@datashare/shared-lib'
import { apiRequest } from './client.ts'

// Calls to the authentication routes (see docs/api-contract.yaml, `auth` tag). The request and response types come from
// @datashare/shared-lib, shared with the back, so a change in the contract breaks the build on both sides.

/** US03: 201 on success; ApiError 409 (email taken) or 422 (invalid input). */
export function registerUser(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest('/auth/register', { method: 'POST', body: credentials })
}

/** US04: 200 on success; ApiError 401 (wrong credentials) or 422. */
export function loginUser(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest('/auth/login', { method: 'POST', body: credentials })
}
