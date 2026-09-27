import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { Mocked } from 'vitest';
import type { User } from '../generated/prisma/client.js';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const SECRET = 'test-secret';

// Unit tests of AuthService. UsersService is mocked (no database), whereas bcrypt and JwtService are real: hashing and signing are
// precisely what is under test.
describe('AuthService', () => {
  // Typed like the real methods, so mock.calls and mockResolvedValue are checked against UsersService's signatures.
  let users: Mocked<Pick<UsersService, 'findByEmail' | 'create'>>;
  let jwt: JwtService;
  let service: AuthService;

  const makeUser = (passwordHash: string): User => ({
    id: '6f1c2a3e-0000-4000-8000-000000000001',
    email: 'alice@test.fr',
    passwordHash,
    createdAt: new Date(),
  });

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
      // By default, the "database" returns the user with the hash it was given.
      create: vi.fn((_email: string, hash: string) => Promise.resolve(makeUser(hash))),
    };
    jwt = new JwtService({ secret: SECRET });
    service = new AuthService(users as unknown as UsersService, jwt);
  });

  describe('register (US03)', () => {
    it('stores a salted bcrypt hash, never the plain-text password', async () => {
      await service.register({
        email: 'alice@test.fr',
        password: 'motdepasse',
      });

      const [, storedHash] = users.create.mock.calls[0];
      expect(storedHash).not.toBe('motdepasse');
      expect(storedHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare('motdepasse', storedHash)).resolves.toBe(true);
    });

    it('produces two different hashes for the same password (salt)', async () => {
      await service.register({ email: 'a@test.fr', password: 'motdepasse' });
      await service.register({ email: 'b@test.fr', password: 'motdepasse' });

      const [[, hash1], [, hash2]] = users.create.mock.calls;
      expect(hash1).not.toBe(hash2);
    });

    it('returns a valid JWT carrying the user id and email', async () => {
      const result = await service.register({
        email: 'alice@test.fr',
        password: 'motdepasse',
      });

      expect(result.user).toEqual({
        id: makeUser('').id,
        email: 'alice@test.fr',
      });
      const payload = await jwt.verifyAsync<{ sub: string; email: string }>(result.accessToken);
      expect(payload).toMatchObject({
        sub: makeUser('').id,
        email: 'alice@test.fr',
      });
    });

    it('never returns the password hash', async () => {
      const result = await service.register({
        email: 'alice@test.fr',
        password: 'motdepasse',
      });

      expect(JSON.stringify(result)).not.toContain('$2');
    });

    it('propagates the conflict when the email is already taken', async () => {
      users.create.mockRejectedValue(new ConflictException());

      await expect(service.register({ email: 'alice@test.fr', password: 'motdepasse' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login (US04)', () => {
    // Fixture hashes use cost 4 (the minimum) to keep tests fast; the cost is stored in the hash, so bcrypt.compare works whatever the
    // value.
    it('returns a JWT when the password matches the stored hash', async () => {
      users.findByEmail.mockResolvedValue(makeUser(await bcrypt.hash('motdepasse', 4)));

      const result = await service.login({
        email: 'alice@test.fr',
        password: 'motdepasse',
      });

      await expect(jwt.verifyAsync(result.accessToken)).resolves.toMatchObject({
        email: 'alice@test.fr',
      });
    });

    it('rejects a wrong password', async () => {
      users.findByEmail.mockResolvedValue(makeUser(await bcrypt.hash('motdepasse', 4)));

      await expect(service.login({ email: 'alice@test.fr', password: 'Motdepasse' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same message as a wrong password', async () => {
      const sameError = new UnauthorizedException('Email ou mot de passe incorrect');
      users.findByEmail.mockResolvedValue(makeUser(await bcrypt.hash('motdepasse', 4)));
      await expect(service.login({ email: 'alice@test.fr', password: 'mauvais' })).rejects.toThrow(sameError);

      users.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'inconnu@test.fr', password: 'mauvais' })).rejects.toThrow(sameError);
    });
  });
});
