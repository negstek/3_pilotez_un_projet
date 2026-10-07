import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

// End-to-end tests of the upload (US01) and of the download through the link (US02): full application, test database and a dedicated
// storage directory (STORAGE_DIR from .env.test), both emptied before each test.
describe('Files (e2e) — US01 / US02', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  const storageDir = process.env.STORAGE_DIR!;
  const content = Buffer.from('contenu du fichier de test');
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Deleting the users deletes their files too (ON DELETE CASCADE).
    await prisma.user.deleteMany();
    // multer creates its temporary directory once, at startup: it is recreated after emptying the storage.
    await rm(storageDir, { recursive: true, force: true });
    await mkdir(join(storageDir, 'tmp'), { recursive: true });
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'alice@test.fr', password: 'motdepasse' })
      .expect(201);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  /**
   * POST /files as Alice, in multipart/form-data like the upload form. The request is returned without being awaited, so that each test
   * chains its own `.expect(status)`.
   *
   * @param fields Text fields of the form (`expiresInDays`, `password`), sent as strings like a browser does: the DTO converts and checks
   *   them. Omitted fields take their server-side default (7 days, no password).
   * @param fileName Name under which `content` is attached to the `file` part: it drives the extension filter and the stored
   *   `originalName`. `null` sends no file part, to test the "file required" case: a field is then added so that the body stays a
   *   multipart form (an empty request would not even reach multer), as when the form is submitted without a file.
   */
  const upload = (fields: Record<string, string> = {}, fileName: string | null = 'rapport.pdf') => {
    const req = request(app.getHttpServer()).post('/files').set('Authorization', `Bearer ${token}`);
    // `void`: field() returns the same request for chaining, nothing to await here (the request is sent by the test's `.expect()`).
    for (const [name, value] of Object.entries(fields)) void req.field(name, value);
    return fileName ? req.attach('file', content, fileName) : req.field('expiresInDays', '7');
  };
  /** GET /f/:token, public: no Authorization header, like a recipient who only has the link. */
  const metadata = (downloadToken: string) => request(app.getHttpServer()).get(`/f/${downloadToken}`);
  /** POST /f/:token/download, public; `body` carries the password of a protected file. `res.body` is the downloaded content. */
  const download = (downloadToken: string, body: object = {}) =>
    request(app.getHttpServer())
      .post(`/f/${downloadToken}/download`)
      .send(body)
      // Collects the binary body into a Buffer (superagent does not buffer application/octet-stream by default).
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
  /** Download token of a successful upload, read from the link returned to the user. */
  const tokenOf = (downloadUrl: string) => downloadUrl.split('/f/')[1];
  /** Files left in the temporary upload directory. */
  const tempFiles = async () => (existsSync(join(storageDir, 'tmp')) ? readdir(join(storageDir, 'tmp')) : []);

  describe('POST /files', () => {
    it('201: stores the file and returns a link valid for 7 days by default', async () => {
      const res = await upload().expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        downloadUrl: expect.stringMatching(/^https:\/\/localhost:8080\/f\/[0-9a-f-]{36}$/),
        expiresAt: expect.any(String),
      });
      const stored = await prisma.file.findUniqueOrThrow({ where: { id: res.body.id }, include: { owner: true } });
      expect(stored).toMatchObject({ originalName: 'rapport.pdf', sizeBytes: BigInt(content.length), passwordHash: null });
      expect(stored.owner?.email).toBe('alice@test.fr');
      expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(7 * DAY_MS - 60_000);
      expect(existsSync(join(storageDir, stored.storagePath))).toBe(true);
      expect(await tempFiles()).toEqual([]);
    });

    it('201: applies the chosen duration and hashes the password', async () => {
      const res = await upload({ expiresInDays: '3', password: 'secret1' }).expect(201);

      const stored = await prisma.file.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.passwordHash).toMatch(/^\$2b\$/);
      expect(Math.round((stored.expiresAt.getTime() - Date.now()) / DAY_MS)).toBe(3);
    });

    it('201: keeps a non-ASCII file name', async () => {
      const res = await upload({}, 'résumé été.pdf').expect(201);

      const stored = await prisma.file.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.originalName).toBe('résumé été.pdf');
    });

    it('401: refuses an anonymous upload (US07 not implemented yet)', async () => {
      await request(app.getHttpServer()).post('/files').attach('file', content, 'rapport.pdf').expect(401);

      expect(await prisma.file.count()).toBe(0);
    });

    it('422: requires a file', async () => {
      const res = await upload({}, null).expect(422);
      expect(res.body.message).toBe('Le fichier est requis');
    });

    it('422: refuses a forbidden extension, whatever its case', async () => {
      const res = await upload({}, 'SETUP.EXE').expect(422);

      expect(res.body.message).toContain("Ce type de fichier n'est pas autorisé");
      expect(await tempFiles()).toEqual([]);
    });

    it('422: refuses a password shorter than 6 characters, without leaving the file on disk', async () => {
      const res = await upload({ password: '12345' }).expect(422);

      expect(res.body.message).toBe('Le mot de passe doit contenir au moins 6 caractères');
      expect(await tempFiles()).toEqual([]);
      expect(await prisma.file.count()).toBe(0);
    });

    it('201: treats an empty password field as no password', async () => {
      const res = await upload({ password: '' }).expect(201);

      const stored = await prisma.file.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(stored.passwordHash).toBeNull();
    });

    it.each(['0', '8', 'abc'])('422: refuses an expiration of "%s" days', async (expiresInDays) => {
      const res = await upload({ expiresInDays }).expect(422);
      expect(res.body.message).toContain("La durée d'expiration doit être comprise entre 1 et 7 jours");
    });
  });

  describe('GET /f/:token', () => {
    it('200: returns the metadata, without the content', async () => {
      const { body } = await upload({ password: 'secret1' }).expect(201);

      const res = await metadata(tokenOf(body.downloadUrl)).expect(200);
      expect(res.body).toEqual({
        originalName: 'rapport.pdf',
        sizeBytes: content.length,
        mimeType: 'application/pdf',
        expiresAt: body.expiresAt,
        passwordProtected: true,
      });
    });

    it('404: rejects an unknown link', async () => {
      await metadata('00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('410: rejects an expired link that is not purged yet', async () => {
      const { body } = await upload().expect(201);
      await prisma.file.update({ where: { id: body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      const res = await metadata(tokenOf(body.downloadUrl)).expect(410);
      expect(res.body.message).toBe("Ce fichier n'est plus disponible en téléchargement car il a expiré");
    });
  });

  describe('POST /f/:token/download', () => {
    it('200: sends the content as an attachment with its original name', async () => {
      // "€" is outside latin1: Express then adds the UTF-8 encoded form of the name (RFC 6266).
      const { body } = await upload({}, 'facture 10 €.pdf').expect(201);

      const res = await download(tokenOf(body.downloadUrl)).expect(200);
      expect(res.body).toEqual(content);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toContain("filename*=UTF-8''facture%2010%20%E2%82%AC.pdf");
    });

    it('protected file: 422 without password, 401 with a wrong one, 200 with the right one', async () => {
      const { body } = await upload({ password: 'secret1' }).expect(201);
      const downloadToken = tokenOf(body.downloadUrl);

      await download(downloadToken).expect(422);
      await download(downloadToken, { password: 'mauvais' }).expect(401);
      const res = await download(downloadToken, { password: 'secret1' }).expect(200);
      expect(res.body).toEqual(content);
    });

    it('404 / 410: same checks as the metadata', async () => {
      const { body } = await upload().expect(201);
      await prisma.file.update({ where: { id: body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

      await download(tokenOf(body.downloadUrl)).expect(410);
      await download('00000000-0000-4000-8000-000000000000').expect(404);
    });
  });
});
