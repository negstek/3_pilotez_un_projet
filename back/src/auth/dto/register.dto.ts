import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, VALIDATION_MESSAGES, type Credentials } from '@datashare/shared-lib';
import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MinLength } from 'class-validator';
import { normalizeEmail } from './normalize-email.js';

/**
 * Body of POST /auth/register, with the input rules of US03. Limits and messages come from @datashare/shared-lib, so the sign-up form
 * applies exactly the same rules.
 */
export class RegisterDto implements Credentials {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailInvalid })
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, { message: VALIDATION_MESSAGES.passwordTooShort })
  // bcrypt only uses the first 72 bytes and the library silently drops the rest: beyond that limit, two different passwords sharing the
  // same first 72 bytes would both be accepted. The limit is in UTF-8 bytes, not characters (an accented character takes two). Rationale in
  // docs/architecture.md.
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: VALIDATION_MESSAGES.passwordTooLong })
  password: string;
}
