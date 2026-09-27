import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES } from '@datashare/shared-lib'

// Client-side input checks (US03 / US04). Limits and messages come from @datashare/shared-lib, which the back's DTOs use as well. They give
// immediate feedback under each field without a server round trip, but do not replace the server-side validation, which remains
// authoritative. Each function returns the error message to display, or undefined if valid.

// Deliberately permissive (something@something.tld): the exact rules are the server's (class-validator's isEmail); the client only catches
// obvious typos.
// The domain is split on dots and its parts exclude the dot, so the pattern runs in linear time (no ambiguous backtracking).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "L'email est requis"
  if (!EMAIL_PATTERN.test(email.trim())) return VALIDATION_MESSAGES.emailInvalid
}

/** Rules for a password being created (sign-up); login only requires a value. */
export function validateNewPassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return VALIDATION_MESSAGES.passwordTooShort
  // Bytes, not characters (see PASSWORD_MAX_BYTES): TextEncoder gives the UTF-8 length, where an accented character counts as two.
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return VALIDATION_MESSAGES.passwordTooLong
}

/** Login: the password is only compared with the stored hash, so it just has to be filled in. */
export function validateRequiredPassword(password: string): string | undefined {
  if (!password) return VALIDATION_MESSAGES.passwordRequired
}

/**
 * Confirmation field of the sign-up mockup. Client-only: the confirmation is not sent to the API.
 */
export function validatePasswordConfirmation(password: string, confirmation: string): string | undefined {
  if (confirmation !== password) return 'Les mots de passe ne correspondent pas'
}
