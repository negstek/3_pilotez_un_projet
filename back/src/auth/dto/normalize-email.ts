import { TransformFnParams } from 'class-transformer';

/**
 * class-transformer function that trims and lowercases an email. Email uniqueness (US03) must not depend on case or on stray spaces:
 * "Alice@Mail.fr " and "alice@mail.fr" are the same account. Non-string values are passed through untouched and rejected by @IsEmail.
 */
export const normalizeEmail = ({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim().toLowerCase() : value);
