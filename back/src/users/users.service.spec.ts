import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

// PrismaService is replaced by a minimal stub: only the translation of database errors into HTTP exceptions is tested here; the real UNIQUE
// constraint is covered by the e2e tests.
describe('UsersService', () => {
  const create = vi.fn();
  const service = new UsersService({
    user: { create },
  } as unknown as PrismaService);

  it('maps the UNIQUE constraint violation on email to a 409', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create('alice@test.fr', 'hash')).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows other database errors', async () => {
    const error = new Error('connexion perdue');
    create.mockRejectedValue(error);

    await expect(service.create('alice@test.fr', 'hash')).rejects.toBe(error);
  });
});
