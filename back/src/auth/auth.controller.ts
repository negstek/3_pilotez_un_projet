import type { AuthResponse, AuthUser } from '@datashare/shared-lib';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

/**
 * Authentication routes (see docs/api-contract.yaml, `auth` tag). Request bodies are validated by the global ValidationPipe before reaching
 * handlers.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** US03: 201 with a token, 409 if the email is taken, 422 if invalid. */
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  /** US04: 200 with a token, 401 on wrong credentials, 422 if invalid. */
  @Post('login')
  // POST defaults to 201 in Nest, but logging in creates no resource.
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  /**
   * Returns the identity carried by the token. Lets the client check that its token is still accepted, and serves as the reference route
   * for the guard.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
