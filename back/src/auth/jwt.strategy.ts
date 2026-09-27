import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '@datashare/shared-lib';
import { JwtPayload } from './auth.types.js';

/**
 * Passport strategy behind JwtAuthGuard: reads the token from the `Authorization: Bearer <token>` header, then checks its signature and
 * expiry.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Only called once passport-jwt has verified the signature and expiry, so the payload can be trusted. The returned value becomes
  // `request.user`. The database is deliberately not queried: the API stays stateless.
  validate(payload: JwtPayload): AuthUser {
    return { id: payload.sub, email: payload.email };
  }
}
