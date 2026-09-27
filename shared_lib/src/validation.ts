// Input rules from the specifications, applied twice: by the back's DTOs (authoritative, 422 on failure) and by the front's forms
// (immediate feedback under each field). Defining them once guarantees that both sides accept and reject exactly the same input, with the
// same message.

/** US03: "minimum 8 characters". */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt only uses the first 72 bytes of a password and silently drops the rest, so longer passwords are rejected at sign-up. The limit is
 * in UTF-8 bytes, not characters: an accented character takes two (rationale in docs/architecture.md).
 */
export const PASSWORD_MAX_BYTES = 72;

/** Messages shown to the user, identical in the API's 422 response and under the form fields. */
export const VALIDATION_MESSAGES = {
  emailInvalid: "Le format de l'email est invalide",
  passwordRequired: 'Le mot de passe est requis',
  passwordTooShort: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`,
  passwordTooLong: `Le mot de passe est trop long (${PASSWORD_MAX_BYTES} caractères maximum)`,
} as const;
