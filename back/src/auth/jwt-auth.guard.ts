import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Rejects the request with 401 unless it carries a valid access token, and exposes the authenticated user through @CurrentUser(). Usage:
 * `@UseGuards(JwtAuthGuard)` on a route or a controller.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
