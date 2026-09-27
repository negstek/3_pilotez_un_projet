import { VALIDATION_MESSAGES, type Credentials } from '@datashare/shared-lib';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { normalizeEmail } from './normalize-email.js';

/**
 * Body of POST /auth/login (US04). No length rule on the password: it is only compared with the stored hash, and the rules apply at
 * sign-up.
 */
export class LoginDto implements Credentials {
  // Normalized the same way as at sign-up, otherwise "Alice@…" could not log into the account created as "alice@…".
  @Transform(normalizeEmail)
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailInvalid })
  email: string;

  @IsString()
  @IsNotEmpty({ message: VALIDATION_MESSAGES.passwordRequired })
  password: string;
}
