import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

/**
 * Authentication: account creation, login and JWT verification. Other modules protect their routes by importing this module and using
 * JwtAuthGuard.
 */
@Module({
  imports: [
    UsersModule,
    // With Nest 12, guards that extend AuthGuard() require these options to be provided: the injector now reads @Optional() with
    // getOwnMetadata, so the marker set on the parent guard is no longer inherited by subclasses and startup fails with "can't resolve
    // dependencies of the JwtAuthGuard".
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Async registration so the secret is read through ConfigService (after `.env` is loaded) rather than from process.env at import time.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Fails at startup if missing, rather than signing tokens with an undefined secret.
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // No refresh token in the MVP: the user logs in again once the token expires (see docs/architecture.md, authentication note).
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // Re-exported so that modules protecting their routes with JwtAuthGuard (FilesModule…) also get the Passport options required above.
  exports: [PassportModule],
})
export class AuthModule {}
