import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { StorageService } from './storage.service.js';

/** Directory of the stored files, relative to the working directory of the API unless absolute (STORAGE_DIR). */
export function storageDir(config: ConfigService): string {
  return resolve(config.get<string>('STORAGE_DIR', 'storage'));
}

/**
 * Directory where multer writes uploads while they are received. Inside the storage directory, hence on the same disk, so that saving a
 * file is an instant rename rather than a copy of up to 1 GB.
 */
export function uploadTempDir(config: ConfigService): string {
  return join(storageDir(config), 'tmp');
}

/**
 * MVP implementation of StorageService: one file per upload in STORAGE_DIR, named with a random UUID. The original name stays in the
 * database only, so a client-supplied name (`../../etc/passwd`, reserved characters) never reaches the file system.
 */
@Injectable()
export class LocalStorageService extends StorageService implements OnModuleInit {
  private readonly dir: string;

  constructor(config: ConfigService) {
    super();
    this.dir = storageDir(config);
  }

  /** Creates STORAGE_DIR at startup, so that the first save does not fail on a fresh install. */
  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
  }

  async save(tempPath: string): Promise<string> {
    // The key is generated here, independently of the download token: knowing one never reveals the other.
    const key = randomUUID();
    await rename(tempPath, this.path(key));
    return key;
  }

  read(key: string): Readable {
    return createReadStream(this.path(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  /** Absolute path of a stored content. The key always comes from save() (a UUID), never from the client. */
  private path(key: string): string {
    return join(this.dir, key);
  }
}
