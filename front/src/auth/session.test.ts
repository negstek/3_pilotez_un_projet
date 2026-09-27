import { describe, expect, it } from 'vitest'
import { fakeJwt } from '../test/jwt.ts'
import { clearSession, loadSession, saveSession, STORAGE_KEY } from './session.ts'

const user = { id: 'u1', email: 'alice@test.fr' }

describe('session', () => {
  it('restores a session whose token is still valid', () => {
    const session = { accessToken: fakeJwt(3600), user }
    saveSession(session)

    expect(loadSession()).toEqual(session)
  })

  it('ignores and removes a session whose token has expired', () => {
    saveSession({ accessToken: fakeJwt(-10), user })

    expect(loadSession()).toBeNull()
    expect(localStorage).toHaveLength(0)
  })

  it('ignores unreadable content', () => {
    localStorage.setItem(STORAGE_KEY, '{pas du json')

    expect(loadSession()).toBeNull()
  })

  it('removes the session on logout', () => {
    saveSession({ accessToken: fakeJwt(3600), user })
    clearSession()

    expect(loadSession()).toBeNull()
  })
})
