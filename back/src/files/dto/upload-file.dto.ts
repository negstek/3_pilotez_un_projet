import {
  EXPIRATION_DEFAULT_DAYS,
  EXPIRATION_MAX_DAYS,
  EXPIRATION_MIN_DAYS,
  FILE_MESSAGES,
  FILE_PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_BYTES,
  VALIDATION_MESSAGES,
} from '@datashare/shared-lib';
import { Transform, Type } from 'class-transformer';
import { IsByteLength, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Text fields of the multipart body of POST /files (US01); the file itself is checked by multer (size, extension) and by the controller
 * (presence). Limits and messages come from @datashare/shared-lib, shared with the upload form.
 */
export class UploadFileDto {
  // An empty field of an HTML form arrives as "": it means "no password", not a password too short.
  @Transform(({ value }: { value: unknown }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(FILE_PASSWORD_MIN_LENGTH, { message: FILE_MESSAGES.passwordTooShort })
  // Same bcrypt ceiling as the account password (see RegisterDto and docs/architecture.md).
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: VALIDATION_MESSAGES.passwordTooLong })
  password?: string;

  // Multipart fields are strings: "3" is converted to 3 before validation. The initializer applies when the field is absent (US01:
  // "7 jours par défaut").
  @Type(() => Number)
  @IsInt({ message: FILE_MESSAGES.expirationInvalid })
  @Min(EXPIRATION_MIN_DAYS, { message: FILE_MESSAGES.expirationInvalid })
  @Max(EXPIRATION_MAX_DAYS, { message: FILE_MESSAGES.expirationInvalid })
  expiresInDays: number = EXPIRATION_DEFAULT_DAYS;
}
