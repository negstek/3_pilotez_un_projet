import type { Readable } from 'node:stream';

/**
 * Storage of file contents, behind which the back never touches the disk directly (see docs/architecture.md): the MVP stores files on the
 * local file system, and switching to S3 would only mean providing another implementation in StorageModule.
 *
 * An abstract class rather than an interface, because Nest injects by class: interfaces do not exist at runtime.
 */
export abstract class StorageService {
  /**
   * Moves an uploaded file (written to the temporary upload directory by multer) into the storage.
   *
   * @returns The key under which the content is stored, to keep in `file.storage_path`.
   */
  abstract save(tempPath: string): Promise<string>;

  /** Opens the stored content for streaming to the client. */
  abstract read(key: string): Readable;

  /** Deletes the stored content; succeeds if it is already gone. */
  abstract remove(key: string): Promise<void>;
}
