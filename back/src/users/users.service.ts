import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Data access for the `user` table. Holds no authentication logic (hashing, tokens): that belongs to AuthService.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Looks a user up by email; the email is expected to be already normalized. */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Creates a user from an already hashed password.
   *
   * @throws ConflictException (409) if the email is already taken.
   */
  async create(email: string, passwordHash: string): Promise<User> {
    try {
      return await this.prisma.user.create({ data: { email, passwordHash } });
    } catch (error) {
      // P2002 = violation of the UNIQUE constraint on `email`. Relying on the database instead of checking for an existing user first
      // closes the race window where two simultaneous sign-ups with the same email would both pass the check.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw error;
    }
  }
}
