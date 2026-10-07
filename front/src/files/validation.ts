import {
  FILE_MAX_SIZE_BYTES,
  FILE_MESSAGES,
  FILE_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  VALIDATION_MESSAGES,
  isForbiddenFileName,
} from '@datashare/shared-lib'

// Client-side checks of the upload (US01), with the limits and messages of @datashare/shared-lib also used by the back's DTO and multer
// options. They avoid sending up to 1 GB only to have it refused; the server's checks remain authoritative. Each function returns the
// error message to display, or undefined if valid.

/** Checked as soon as the file is chosen, before any field is filled. */
export function validateUploadFile(file: Pick<File, 'name' | 'size'>): string | undefined {
  if (file.size > FILE_MAX_SIZE_BYTES) return FILE_MESSAGES.fileTooLarge
  if (isForbiddenFileName(file.name)) return FILE_MESSAGES.fileForbidden
}

/** The password is optional; when filled in, same rules as the server (6 characters minimum, 72 bytes maximum). */
export function validateFilePassword(password: string): string | undefined {
  if (!password) return undefined
  if (password.length < FILE_PASSWORD_MIN_LENGTH) return FILE_MESSAGES.passwordTooShort
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return VALIDATION_MESSAGES.passwordTooLong
}
