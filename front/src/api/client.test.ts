import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client.ts'

// Replaces the global fetch with a stub resolving to `response` (or rejecting with it when it is an Error, to simulate a network failure).
const mockFetch = (response: Partial<Response> | Error) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  )

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the body as JSON and the token as a Bearer header', async () => {
    mockFetch({ ok: true, json: () => Promise.resolve({ ok: 1 }) })

    await apiRequest('/files', { method: 'POST', body: { a: 1 }, token: 'jwt' })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' },
    })
  })

  it('turns an error response into an ApiError with the API message', async () => {
    mockFetch({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ statusCode: 409, message: 'Cet email est déjà utilisé' }),
    })

    await expect(apiRequest('/auth/register')).rejects.toEqual(new ApiError(409, 'Cet email est déjà utilisé'))
  })

  it('reports an unreachable server', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    await expect(apiRequest('/auth/login')).rejects.toMatchObject({ status: 0 })
  })
})
