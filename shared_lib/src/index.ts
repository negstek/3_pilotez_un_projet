// Public entry point of @datashare/shared-lib (see the note on the shared package in docs/architecture.md).
export type { AuthResponse, AuthUser, Credentials } from './auth.js';
export { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES } from './validation.js';
export type { DownloadRequest, FilePublicMetadata, FileUploadResponse } from './files.js';
export {
  EXPIRATION_DEFAULT_DAYS,
  EXPIRATION_MAX_DAYS,
  EXPIRATION_MIN_DAYS,
  FILE_MAX_SIZE_BYTES,
  FILE_MESSAGES,
  FILE_PASSWORD_MIN_LENGTH,
  FORBIDDEN_EXTENSIONS,
  isForbiddenFileName,
} from './files.js';
