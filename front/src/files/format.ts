import type { FileStatus } from '@datashare/shared-lib'

// Display of file information, shared by the upload, download and history screens.

// Multiples of 1024, like the 1 GB limit of US01 (FILE_MAX_SIZE_BYTES): a file at the limit shows "1 Go".
const UNITS = ['o', 'Ko', 'Mo', 'Go']

/** Size with a French unit and one decimal at most: 2.6 MB → "2,6 Mo", as in the mockups. */
export function formatSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const rounded = unit === 0 ? value : Math.round(value * 10) / 10
  return `${rounded.toLocaleString('fr-FR')} ${UNITS[unit]}`
}

/** Expiration duration as a phrase: "une journée", "3 jours", "une semaine" (options of the upload form, success message). */
export function formatDuration(days: number): string {
  if (days === 1) return 'une journée'
  if (days === 7) return 'une semaine'
  return `${days} jours`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Number of calendar days between now and the expiry date, in local time: 0 = today, 1 = tomorrow. */
export function daysUntil(expiresAt: string, now = new Date()): number {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((startOfDay(new Date(expiresAt)) - startOfDay(now)) / DAY_MS)
}

/** Notice of the download page: a warning when the file expires today or tomorrow, as in the mockups. */
export function expiryNotice(expiresAt: string, now = new Date()): { variant: 'info' | 'warning'; text: string } {
  const days = daysUntil(expiresAt, now)
  if (days <= 0) return { variant: 'warning', text: "Ce fichier expire aujourd'hui." }
  if (days === 1) return { variant: 'warning', text: 'Ce fichier expirera demain.' }
  return { variant: 'info', text: `Ce fichier expirera dans ${days} jours.` }
}

/** Date in the French format, in local time: "06/10/2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR')
}

/**
 * Expiry of a history line (US05): relative, as in the mockups ("Expire demain"), with the date the specifications ask for beyond
 * tomorrow. An expired file shows the date its link stopped working.
 */
export function expiryLabel(expiresAt: string, status: FileStatus, now = new Date()): string {
  if (status === 'expired') return `Expiré le ${formatDate(expiresAt)}`
  const days = daysUntil(expiresAt, now)
  if (days <= 0) return "Expire aujourd'hui"
  if (days === 1) return 'Expire demain'
  return `Expire dans ${days} jours, le ${formatDate(expiresAt)}`
}
