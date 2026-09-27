import { describe, expect, it } from 'vitest'
import { validateEmail, validateNewPassword, validatePasswordConfirmation, validateRequiredPassword } from './validation.ts'

describe('validateEmail', () => {
  it('accepts a valid email, surrounding spaces included', () => {
    expect(validateEmail('alice@test.fr')).toBeUndefined()
    expect(validateEmail('  alice@test.fr ')).toBeUndefined()
  })

  it('requires an email', () => {
    expect(validateEmail('   ')).toBe("L'email est requis")
  })

  it.each(['alice', 'alice@', 'alice@test', 'ali ce@test.fr', 'alice@test..fr', 'alice@.test.fr'])('rejects "%s"', (email) => {
    expect(validateEmail(email)).toBe("Le format de l'email est invalide")
  })
})

describe('validateNewPassword', () => {
  it('requires at least 8 characters (US03)', () => {
    expect(validateNewPassword('1234567')).toMatch(/8 caractères/)
    expect(validateNewPassword('12345678')).toBeUndefined()
  })

  it('rejects more than 72 bytes, the back-end bcrypt limit', () => {
    expect(validateNewPassword('a'.repeat(72))).toBeUndefined()
    expect(validateNewPassword('a'.repeat(73))).toMatch(/trop long/)
    expect(validateNewPassword('é'.repeat(37))).toMatch(/trop long/)
  })
})

describe('validateRequiredPassword', () => {
  it('only requires a value at login, whatever its length', () => {
    expect(validateRequiredPassword('')).toBe('Le mot de passe est requis')
    expect(validateRequiredPassword('court')).toBeUndefined()
  })
})

describe('validatePasswordConfirmation', () => {
  it('flags a confirmation that differs from the password', () => {
    expect(validatePasswordConfirmation('motdepasse', 'motdepasse')).toBeUndefined()
    expect(validatePasswordConfirmation('motdepasse', 'motdepass')).toBe('Les mots de passe ne correspondent pas')
  })
})
