import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end tests of the authentication routes: the full Nest application (validation pipe, guards, Prisma, PostgreSQL) is called over
// HTTP, and every status code of docs/api-contract.yaml for these routes is checked.
describe('Authentication (e2e) — US03 / US04', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = { email: 'alice@test.fr', password: 'motdepasse' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same global configuration as main.ts, otherwise validation (422) would not be exercised.
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  // Each test starts from an empty table, so tests do not depend on each other's accounts (and the order in which they run).
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = (body: object) => request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) => request(app.getHttpServer()).post('/auth/login').send(body);
  const me = (token?: string) => {
    const req = request(app.getHttpServer()).get('/auth/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  describe('POST /auth/register', () => {
    it('201: creates the account and returns a JWT', async () => {
      const res = await register(credentials).expect(201);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        user: { id: expect.any(String), email: 'alice@test.fr' },
      });
      const stored = await prisma.user.findUniqueOrThrow({
        where: { email: 'alice@test.fr' },
      });
      expect(stored.passwordHash).not.toBe(credentials.password);
    });

    it('409: rejects an email already taken, whatever its case', async () => {
      await register(credentials).expect(201);

      const res = await register({
        ...credentials,
        email: 'ALICE@test.fr',
      }).expect(409);
      expect(res.body.message).toBe('Cet email est déjà utilisé');
    });

    it('422: rejects an invalid email', async () => {
      await register({ ...credentials, email: 'alice' }).expect(422);
    });

    it('422: rejects a password shorter than 8 characters', async () => {
      const res = await register({
        ...credentials,
        password: '1234567',
      }).expect(422);
      expect(res.body.message).toContain('8 caractères');
    });

    it('422: rejects a password longer than 72 bytes', async () => {
      const res = await register({
        ...credentials,
        password: 'a'.repeat(73),
      }).expect(422);
      expect(res.body.message).toContain('72 caractères maximum');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register(credentials).expect(201);
    });

    it('200: returns a JWT for valid credentials', async () => {
      const res = await login(credentials).expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe('alice@test.fr');
    });

    it('401: rejects a wrong password', async () => {
      await login({ ...credentials, password: 'mauvais-mdp' }).expect(401);
    });

    it('401: rejects an unregistered user', async () => {
      await login({ ...credentials, email: 'bob@test.fr' }).expect(401);
    });

    it('422: rejects a malformed email', async () => {
      await login({ ...credentials, email: 'alice' }).expect(422);
    });
  });

  describe('GET /auth/me (route protected by JwtAuthGuard)', () => {
    it('200: authenticates the request with the token received at login', async () => {
      const { body } = await register(credentials).expect(201);

      const res = await me(body.accessToken).expect(200);
      expect(res.body).toEqual(body.user);
    });

    it('401: rejects a request without a token', async () => {
      await me().expect(401);
    });

    it('401: rejects a forged token', async () => {
      const { body } = await register(credentials).expect(201);
      // Altering the signature is enough: the token decodes fine, but no longer matches the server secret.
      const forged = `${body.accessToken.slice(0, -2)}xx`;

      await me(forged).expect(401);
    });
  });
});
