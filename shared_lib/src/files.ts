// Files: bodies of the `files` routes (mirroring docs/api-contract.yaml, which remains the reference) and the input rules of US01, US02 and
// US05, applied by the back's DTOs (authoritative, 422 on failure) and by the front's forms.

/** Response of `POST /files` (US01). */
export interface FileUploadResponse {
  id: string;
  /** Link to share: the front's download page, `<front>/f/<downloadToken>`. */
  downloadUrl: string;
  /** ISO 8601 date. */
  expiresAt: string;
}

/** Response of `GET /f/{token}`: what the download page shows before the file is fetched (US02). */
export interface FilePublicMetadata {
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  /** ISO 8601 date. */
  expiresAt: string;
  passwordProtected: boolean;
}

/** State of a link in the history (US05): `expired` from its expiry date until the daily purge deletes it (US10). */
export type FileStatus = 'active' | 'expired';

/** Values of the `status` filter of `GET /files`: only the active files by default (US06), the expired ones, or both. */
export const FILE_STATUS_FILTERS = ['active', 'expired', 'all'] as const;
export type FileStatusFilter = (typeof FILE_STATUS_FILTERS)[number];

/** Item of `GET /files`: a file of the logged-in user's history (US05). */
export interface FileHistoryItem {
  id: string;
  originalName: string;
  sizeBytes: number;
  /** Upload date, ISO 8601. */
  createdAt: string;
  /** ISO 8601 date. */
  expiresAt: string;
  status: FileStatus;
  passwordProtected: boolean;
  /** Same link as the one returned at upload, so that the owner can open or share it again ("Accéder" button of the mockups). */
  downloadUrl: string;
}

/** Body of `POST /f/{token}/download`; the password is only required when the file is protected. */
export interface DownloadRequest {
  password?: string;
}

/** US01: "taille maximale : 1 Go" (binary gigabyte). */
export const FILE_MAX_SIZE_BYTES = 1024 ** 3;

/** US01 / US10: lifetime of the link, chosen at upload time; 7 days by default. */
export const EXPIRATION_MIN_DAYS = 1;
export const EXPIRATION_MAX_DAYS = 7;
export const EXPIRATION_DEFAULT_DAYS = 7;

/** US01: "champ mot de passe : minimum 6 caractères, si renseigné". The 72-byte bcrypt ceiling is the account's (PASSWORD_MAX_BYTES). */
export const FILE_PASSWORD_MIN_LENGTH = 6;

/**
 * US01 leaves forbidden files "à définir selon la politique de sécurité (ex. .exe, .bat, etc.)": executables and scripts, which a recipient
 * could run by mistake. Checked on the extension of the original name, in lowercase.
 */
export const FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.vbs', '.sh', '.jar'] as const;

/** True when the file name ends with a forbidden extension, whatever its case ("SETUP.EXE" included). */
export function isForbiddenFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return FORBIDDEN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Messages shown to the user, identical in the API's 422 response and in the forms. */
export const FILE_MESSAGES = {
  fileRequired: 'Le fichier est requis',
  fileTooLarge: 'La taille des fichiers est limitée à 1 Go',
  fileForbidden: `Ce type de fichier n'est pas autorisé (${FORBIDDEN_EXTENSIONS.join(', ')})`,
  passwordTooShort: `Le mot de passe doit contenir au moins ${FILE_PASSWORD_MIN_LENGTH} caractères`,
  expirationInvalid: `La durée d'expiration doit être comprise entre ${EXPIRATION_MIN_DAYS} et ${EXPIRATION_MAX_DAYS} jours`,
  downloadPasswordRequired: 'Le mot de passe est requis pour télécharger ce fichier',
  statusFilterInvalid: `Le filtre doit valoir ${FILE_STATUS_FILTERS.join(', ')}`,
} as const;
