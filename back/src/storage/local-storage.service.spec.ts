import type { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { LocalStorageService } from './local-storage.service.js';

// Runs against a real temporary directory: the service is only a thin layer over the file system.
describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
    storage = new LocalStorageService({ get: () => dir } as unknown as ConfigService);
    await storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** Stands for a file just written by multer; created in the same directory, so that save() is a rename as in production. */
  const tempFile = async (content: string) => {
    const path = join(dir, `upload-${Math.random()}`);
    await writeFile(path, content);
    return path;
  };

  it('moves the upload under a random key, then reads it back', async () => {
    const tempPath = await tempFile('contenu');

    const key = await storage.save(tempPath);

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(existsSync(tempPath)).toBe(false);
    expect(await readFile(join(dir, key), 'utf8')).toBe('contenu');
    expect(await text(storage.read(key))).toBe('contenu');
  });

  it('removes the content, and accepts an already removed one', async () => {
    const key = await storage.save(await tempFile('contenu'));

    await storage.remove(key);
    expect(existsSync(join(dir, key))).toBe(false);
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });
});
