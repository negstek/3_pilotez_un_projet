import type { AuthUser } from '@datashare/shared-lib';
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Authentication that is optional but never ignored (US07, anonymous upload): a request without credentials goes through as anonymous,
 * and @CurrentUser() is then `null`; a request with a valid access token is authenticated exactly as with JwtAuthGuard. Usage:
 * `@UseGuards(OptionalJwtAuthGuard)` on a route open to visitors, whose handler declares `@CurrentUser() user: AuthUser | null`.
 *
 * A request that does present credentials, but invalid ones (expired, forged or malformed token), is rejected with 401 rather than
 * downgraded to anonymous. Otherwise a user whose session has just expired would upload "successfully" a file with no owner, which they
 * could neither find in their history nor delete (US05, US06).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Called by AuthGuard once Passport has run the JWT strategy; the returned value becomes `request.user`.
   *
   * @param err Error raised by the strategy itself, if any.
   * @param user User returned by JwtStrategy.validate(), or `false` when there is no token or when it has been refused.
   * @param _info Reason of the refusal (unused: every refusal gets the same 401, as with JwtAuthGuard).
   * @throws UnauthorizedException (401) if an Authorization header was sent but does not carry a valid token.
   */
  handleRequest<TUser = AuthUser | null>(err: unknown, user: AuthUser | false, _info: unknown, context: ExecutionContext): TUser {
    if (err) throw err instanceof Error ? err : new UnauthorizedException();
    if (user) return user as TUser;
    // Passport reports "no token" and "bad token" the same way (user === false): the header tells them apart. Any Authorization header
    // counts as an attempt to authenticate, whatever its scheme.
    const { authorization } = context.switchToHttp().getRequest<Request>().headers;
    if (authorization !== undefined) throw new UnauthorizedException();
    return null as TUser;
  }
}
