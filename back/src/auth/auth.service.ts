import type { AuthResponse } from '@datashare/shared-lib';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { User } from '../generated/prisma/client.js';
import { UsersService } from '../users/users.service.js';
import { JwtPayload } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

// bcrypt cost factor: 2^10 rounds (about 50-100 ms per hash), the library's default. Slow enough to hinder brute force on a leaked hash,
// fast enough not to penalize sign-up and login. Each +1 doubles the time.
export const BCRYPT_ROUNDS = 10;

// Hash compared against when the email is unknown. Without it, a login for an unknown email would return immediately while a known email
// would pay the bcrypt cost, and the response time alone would reveal which emails have an account. Computed once at startup.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', BCRYPT_ROUNDS);

/**
 * Account creation (US03) and login (US04). Passwords only ever exist here in clear text: they are hashed before reaching UsersService and
 * never returned.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Creates the account and logs the user in straight away, so the front can redirect to the personal space without asking for the
   * credentials again. The bcrypt hash embeds a random salt (US03: "hashed, salted").
   */
  async register({ email, password }: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.users.create(email, passwordHash);
    return this.buildAuthResponse(user);
  }

  /**
   * Checks the credentials and issues a new access token.
   *
   * @throws UnauthorizedException (401) if the email is unknown or the password does not match.
   */
  async login({ email, password }: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      // Same message whether the email or the password is wrong, for the same reason as DUMMY_HASH: not revealing which emails are
      // registered.
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    return this.buildAuthResponse(user);
  }

  /** Signs the access token; expiry and secret come from the JwtModule config. */
  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email },
    };
  }
}
