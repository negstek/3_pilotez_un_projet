import { ForbiddenException, GoneException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { Readable } from 'node:stream';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { FilesService } from './files.service.js';

// Unit tests of FilesService. Prisma and the storage are mocked: the HTTP layer, multer and the real database are covered by
// test/files.e2e-spec.ts.
describe('FilesService', () => {
  // Only the Prisma methods the service calls (prisma.file.*), and the three StorageService methods.
  const create = vi.fn();
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const deleteMany = vi.fn();
  const storage = { save: vi.fn(), read: vi.fn(), remove: vi.fn() };
  const service = new FilesService(
    { file: { create, findUnique, findMany, deleteMany } } as unknown as PrismaService,
    storage as unknown as StorageService,
    { get: () => 'https://datashare.test' } as unknown as ConfigService,
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  /** File as received by multer (UploadedFileInfo): already written to its temporary path. */
  const upload = { path: '/tmp/upload-1', originalname: 'rapport.pdf', mimetype: 'application/pdf', size: 42 };
  /** Stored file, valid for one more day unless overridden. */
  const stored = (overrides: object = {}) => ({
    id: 'f1',
    ownerId: 'u1',
    originalName: 'rapport.pdf',
    storagePath: 'key-1',
    mimeType: 'application/pdf',
    sizeBytes: 42n,
    passwordHash: null,
    downloadToken: 'token-1',
    expiresAt: new Date(Date.now() + DAY_MS),
    createdAt: new Date(Date.now() - DAY_MS),
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    storage.save.mockResolvedValue('key-1');
    // Like Prisma, returns the created row: the data sent, plus the generated id.
    create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'f1', ...data }));
  });

  describe('upload (US01 / US07)', () => {
    it('stores the content, then returns a link to the front with an unpredictable token', async () => {
      const result = await service.upload(upload, { expiresInDays: 7 }, 'u1');

      expect(storage.save).toHaveBeenCalledWith('/tmp/upload-1');
      const { data } = create.mock.calls[0][0];
      expect(data).toMatchObject({ ownerId: 'u1', originalName: 'rapport.pdf', storagePath: 'key-1', sizeBytes: 42, passwordHash: null });
      expect(data.downloadToken).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.downloadUrl).toBe(`https://datashare.test/f/${data.downloadToken}`);
    });

    it('stores an anonymous upload without owner, with the same link as any other (US07)', async () => {
      const result = await service.upload(upload, { expiresInDays: 7 }, null);

      const { data } = create.mock.calls[0][0];
      expect(data).toMatchObject({ ownerId: null, originalName: 'rapport.pdf', storagePath: 'key-1' });
      expect(result.downloadUrl).toBe(`https://datashare.test/f/${data.downloadToken}`);
    });

    it('computes the expiry date from the chosen duration', async () => {
      const result = await service.upload(upload, { expiresInDays: 2 }, 'u1');

      expect(Date.parse(result.expiresAt) - Date.now()).toBeGreaterThan(2 * DAY_MS - 1000);
      expect(Date.parse(result.expiresAt) - Date.now()).toBeLessThanOrEqual(2 * DAY_MS);
    });

    it('stores a bcrypt hash of the password, never the password itself', async () => {
      await service.upload(upload, { expiresInDays: 7, password: 'secret1' }, 'u1');

      const { passwordHash } = create.mock.calls[0][0].data;
      expect(passwordHash).not.toBe('secret1');
      expect(await bcrypt.compare('secret1', passwordHash)).toBe(true);
    });

    it('removes the stored content if the metadata cannot be saved', async () => {
      const error = new Error('base indisponible');
      create.mockRejectedValue(error);

      await expect(service.upload(upload, { expiresInDays: 7 }, 'u1')).rejects.toBe(error);
      expect(storage.remove).toHaveBeenCalledWith('key-1');
    });
  });

  describe('getMetadata (US02)', () => {
    it('returns the public metadata, without the storage key nor the hash', async () => {
      findUnique.mockResolvedValue(stored({ passwordHash: 'hash' }));

      const metadata = await service.getMetadata('token-1');
      expect(metadata).toEqual({
        originalName: 'rapport.pdf',
        sizeBytes: 42,
        mimeType: 'application/pdf',
        expiresAt: expect.any(String),
        passwordProtected: true,
      });
    });

    it('rejects an unknown link with a 404', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.getMetadata('inconnu')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an expired link with a 410, without waiting for the purge', async () => {
      findUnique.mockResolvedValue(stored({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.getMetadata('token-1')).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe('download (US02)', () => {
    const stream = Readable.from(['contenu']);

    it('opens the content of an unprotected file', async () => {
      findUnique.mockResolvedValue(stored());
      storage.read.mockReturnValue(stream);

      const file = await service.download('token-1', undefined);
      expect(storage.read).toHaveBeenCalledWith('key-1');
      expect(file).toEqual({ originalName: 'rapport.pdf', sizeBytes: 42, stream });
    });

    it('checks the password of a protected file', async () => {
      findUnique.mockResolvedValue(stored({ passwordHash: await bcrypt.hash('secret1', 4) }));
      storage.read.mockReturnValue(stream);

      await expect(service.download('token-1', undefined)).rejects.toBeInstanceOf(UnprocessableEntityException);
      await expect(service.download('token-1', 'mauvais')).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(service.download('token-1', 'secret1')).resolves.toMatchObject({ stream });
      // The content is only opened once the password is accepted.
      expect(storage.read).toHaveBeenCalledTimes(1);
    });
  });

  describe('list (US05)', () => {
    it('filters on the owner and, by default, on the files not expired yet (US06), most recent first', async () => {
      findMany.mockResolvedValue([]);

      await service.list('u1', 'active');

      const { where, orderBy } = findMany.mock.calls[0][0];
      expect(where).toEqual({ ownerId: 'u1', expiresAt: { gt: expect.any(Date) } });
      expect(orderBy).toEqual({ createdAt: 'desc' });
    });

    it('filters on the expired files, or not at all', async () => {
      findMany.mockResolvedValue([]);

      await service.list('u1', 'expired');
      await service.list('u1', 'all');

      expect(findMany.mock.calls[0][0].where).toEqual({ ownerId: 'u1', expiresAt: { lte: expect.any(Date) } });
      expect(findMany.mock.calls[1][0].where).toEqual({ ownerId: 'u1' });
    });

    it('returns the history fields with the link, without the storage key nor the hash', async () => {
      const expired = stored({ id: 'f2', passwordHash: 'hash', downloadToken: 'token-2', expiresAt: new Date(Date.now() - 1000) });
      findMany.mockResolvedValue([stored(), expired]);

      const [active, old] = await service.list('u1', 'all');

      expect(active).toEqual({
        id: 'f1',
        originalName: 'rapport.pdf',
        sizeBytes: 42,
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
        status: 'active',
        passwordProtected: false,
        downloadUrl: 'https://datashare.test/f/token-1',
      });
      expect(old).toMatchObject({ status: 'expired', passwordProtected: true });
    });
  });

  describe('remove (US06)', () => {
    it('deletes the metadata, then the content', async () => {
      findUnique.mockResolvedValue(stored());
      deleteMany.mockResolvedValue({ count: 1 });

      await service.remove('f1', 'u1');

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(storage.remove).toHaveBeenCalledWith('key-1');
      expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(storage.remove.mock.invocationCallOrder[0]);
    });

    it('refuses with a 403 the file of another user, or an anonymous upload, and leaves it untouched', async () => {
      for (const ownerId of ['u2', null]) {
        findUnique.mockResolvedValue(stored({ ownerId }));
        await expect(service.remove('f1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(deleteMany).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('rejects an unknown file with a 404, including one deleted meanwhile by another request', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.remove('inconnu', 'u1')).rejects.toBeInstanceOf(NotFoundException);

      findUnique.mockResolvedValue(stored());
      deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove('f1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });
});
