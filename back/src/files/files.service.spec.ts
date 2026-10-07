import { GoneException, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { Readable } from 'node:stream';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { FilesService } from './files.service.js';

// Unit tests of FilesService. Prisma and the storage are mocked: the HTTP layer, multer and the real database are covered by
// test/files.e2e-spec.ts.
describe('FilesService', () => {
  // Only the Prisma methods the service calls (prisma.file.create / findUnique), and the three StorageService methods.
  const create = vi.fn();
  const findUnique = vi.fn();
  const storage = { save: vi.fn(), read: vi.fn(), remove: vi.fn() };
  const service = new FilesService(
    { file: { create, findUnique } } as unknown as PrismaService,
    storage as unknown as StorageService,
    { get: () => 'https://datashare.test' } as unknown as ConfigService,
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  /** File as received by multer (UploadedFileInfo): already written to its temporary path. */
  const upload = { path: '/tmp/upload-1', originalname: 'rapport.pdf', mimetype: 'application/pdf', size: 42 };
  /** Stored file, valid for one more day unless overridden. */
  const stored = (overrides: object = {}) => ({
    id: 'f1',
    originalName: 'rapport.pdf',
    storagePath: 'key-1',
    mimeType: 'application/pdf',
    sizeBytes: 42n,
    passwordHash: null,
    downloadToken: 'token-1',
    expiresAt: new Date(Date.now() + DAY_MS),
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    storage.save.mockResolvedValue('key-1');
    // Like Prisma, returns the created row: the data sent, plus the generated id.
    create.mockImplementation(({ data }: { data: object }) => Promise.resolve({ id: 'f1', ...data }));
  });

  describe('upload (US01)', () => {
    it('stores the content, then returns a link to the front with an unpredictable token', async () => {
      const result = await service.upload(upload, { expiresInDays: 7 }, 'u1');

      expect(storage.save).toHaveBeenCalledWith('/tmp/upload-1');
      const { data } = create.mock.calls[0][0];
      expect(data).toMatchObject({ ownerId: 'u1', originalName: 'rapport.pdf', storagePath: 'key-1', sizeBytes: 42, passwordHash: null });
      expect(data.downloadToken).toMatch(/^[0-9a-f-]{36}$/);
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
});
