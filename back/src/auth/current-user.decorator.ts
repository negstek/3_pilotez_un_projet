import type { AuthUser } from '@datashare/shared-lib';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Injects the authenticated user into a handler parameter: `me(@CurrentUser() user: AuthUser)`. Only meaningful on routes protected by
 * JwtAuthGuard, which is what sets `request.user`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request>().user as AuthUser,
);
