import type { AuthUser } from '@datashare/shared-lib';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Injects the authenticated user into a handler parameter: `me(@CurrentUser() user: AuthUser)`. Only meaningful on routes protected by a
 * guard, which is what sets `request.user`: always a user behind JwtAuthGuard, but `null` for a visitor behind OptionalJwtAuthGuard, where
 * the parameter must be declared `AuthUser | null`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request>().user as AuthUser,
);
