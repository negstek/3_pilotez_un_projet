import { describe, expect, it } from 'vitest'
import { daysUntil, expiryLabel, expiryNotice, formatDate, formatDuration, formatSize } from './format.ts'
import { validateFilePassword, validateUploadFile } from './validation.ts'

describe('formatSize', () => {
  it.each([
    [512, '512 o'],
    [2_726_297, '2,6 Mo'],
    [1024 ** 3, '1 Go'],
    [3.7 * 1024 ** 3, '3,7 Go'],
  ])('formats %d bytes as "%s"', (bytes, expected) => {
    // toLocaleString uses a narrow no-break space in some locales: compare on the visible text.
    expect(formatSize(bytes).replace(/\s/g, ' ')).toBe(expected)
  })
})

describe('formatDuration', () => {
  it.each([
    [1, 'une journée'],
    [3, '3 jours'],
    [7, 'une semaine'],
  ])('formats %d days as "%s"', (days, expected) => {
    expect(formatDuration(days)).toBe(expected)
  })
})

describe('expiry of a shared file (US02)', () => {
  const now = new Date(2026, 9, 6, 18, 0)

  it('counts calendar days, not 24-hour periods', () => {
    expect(daysUntil(new Date(2026, 9, 7, 9, 0).toISOString(), now)).toBe(1)
    expect(daysUntil(new Date(2026, 9, 9, 23, 0).toISOString(), now)).toBe(3)
  })

  it('warns when the file expires today or tomorrow, informs otherwise', () => {
    expect(expiryNotice(new Date(2026, 9, 6, 22, 0).toISOString(), now)).toEqual({
      variant: 'warning',
      text: "Ce fichier expire aujourd'hui.",
    })
    expect(expiryNotice(new Date(2026, 9, 7, 9, 0).toISOString(), now)).toEqual({ variant: 'warning', text: 'Ce fichier expirera demain.' })
    expect(expiryNotice(new Date(2026, 9, 9, 9, 0).toISOString(), now)).toEqual({
      variant: 'info',
      text: 'Ce fichier expirera dans 3 jours.',
    })
  })
})

describe('history line (US05)', () => {
  const now = new Date(2026, 9, 6, 18, 0)

  it('formats a date in French', () => {
    expect(formatDate(new Date(2026, 9, 9, 9, 0).toISOString())).toBe('09/10/2026')
  })

  it('shows the expiry relative to today, with the date beyond tomorrow', () => {
    expect(expiryLabel(new Date(2026, 9, 6, 22, 0).toISOString(), 'active', now)).toBe("Expire aujourd'hui")
    expect(expiryLabel(new Date(2026, 9, 7, 9, 0).toISOString(), 'active', now)).toBe('Expire demain')
    expect(expiryLabel(new Date(2026, 9, 9, 9, 0).toISOString(), 'active', now)).toBe('Expire dans 3 jours, le 09/10/2026')
  })

  it('shows when the link of an expired file stopped working', () => {
    expect(expiryLabel(new Date(2026, 9, 5, 9, 0).toISOString(), 'expired', now)).toBe('Expiré le 05/10/2026')
  })
})

describe('upload checks (US01)', () => {
  it('accepts a file up to 1 GB, refuses a larger one', () => {
    expect(validateUploadFile({ name: 'video.mp4', size: 1024 ** 3 })).toBeUndefined()
    expect(validateUploadFile({ name: 'video.mp4', size: 1024 ** 3 + 1 })).toBe('La taille des fichiers est limitée à 1 Go')
  })

  it('refuses executables and scripts', () => {
    expect(validateUploadFile({ name: 'SETUP.EXE', size: 10 })).toContain("Ce type de fichier n'est pas autorisé")
  })

  it('makes the password optional, with 6 characters minimum and 72 bytes maximum', () => {
    expect(validateFilePassword('')).toBeUndefined()
    expect(validateFilePassword('12345')).toBe('Le mot de passe doit contenir au moins 6 caractères')
    expect(validateFilePassword('123456')).toBeUndefined()
    expect(validateFilePassword('é'.repeat(37))).toBe('Le mot de passe est trop long (72 caractères maximum)')
  })
})
