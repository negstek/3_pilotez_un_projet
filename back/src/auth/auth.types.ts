// AuthUser and AuthResponse are part of the API contract and live in @datashare/shared-lib, shared with the front. Only the back's own
// types stay here.

/**
 * Claims signed into the access token. Kept minimal: the token is readable by anyone who holds it (it is signed, not encrypted), so it must
 * never carry sensitive data.
 */
export interface JwtPayload {
  /** User id, in the standard JWT "subject" claim. */
  sub: string;
  email: string;
}
