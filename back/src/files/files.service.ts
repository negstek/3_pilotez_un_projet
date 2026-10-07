import { FILE_MESSAGES, type FilePublicMetadata, type FileUploadResponse } from '@datashare/shared-lib';
import { GoneException, Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { BCRYPT_ROUNDS } from '../auth/auth.service.js';
import { File } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UploadFileDto } from './dto/upload-file.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** File received by multer: only the fields the service needs, so tests do not have to build a full Express.Multer.File. */
export type UploadedFileInfo = Pick<Express.Multer.File, 'path' | 'originalname' | 'mimetype' | 'size'>;

/** What the controller needs to send a file back. */
export interface FileDownload {
  originalName: string;
  sizeBytes: number;
  stream: Readable;
}

/**
 * Upload (US01) and download through the link (US02). The content goes through StorageService, the metadata through Prisma.
 */
@Injectable()
export class FilesService {
  private readonly frontUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    // The shared link opens the front's download page, which then calls the API.
    this.frontUrl = config.get<string>('FRONT_URL', 'https://localhost:8080');
  }

  /**
   * Stores the file and its metadata, and returns the link to share. The password is hashed before anything is written, so a bcrypt
   * failure leaves nothing behind.
   */
  async upload(file: UploadedFileInfo, dto: UploadFileDto, ownerId: string): Promise<FileUploadResponse> {
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null;
    const storagePath = await this.storage.save(file.path);
    try {
      const created = await this.prisma.file.create({
        data: {
          ownerId,
          originalName: file.originalname,
          storagePath,
          // The type declared by the browser, for display only: the download is always sent as application/octet-stream.
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: file.size,
          passwordHash,
          // UUID v4: 122 random bits, impossible to guess or enumerate (US02: "identifiant unique non prédictible").
          downloadToken: randomUUID(),
          expiresAt: new Date(Date.now() + dto.expiresInDays * DAY_MS),
        },
      });
      return {
        id: created.id,
        downloadUrl: `${this.frontUrl}/f/${created.downloadToken}`,
        expiresAt: created.expiresAt.toISOString(),
      };
    } catch (error) {
      // Without its metadata, the stored content could never be downloaded nor purged.
      await this.storage.remove(storagePath);
      throw error;
    }
  }

  /** Metadata shown on the download page before the file is fetched (US02). */
  async getMetadata(token: string): Promise<FilePublicMetadata> {
    const file = await this.findDownloadable(token);
    return {
      originalName: file.originalName,
      sizeBytes: Number(file.sizeBytes),
      mimeType: file.mimeType,
      expiresAt: file.expiresAt.toISOString(),
      passwordProtected: file.passwordHash !== null,
    };
  }

  /**
   * Checks the password of a protected file, then opens its content.
   *
   * @throws UnprocessableEntityException (422) if the file is protected and no password is given.
   * @throws UnauthorizedException (401) if the password is wrong.
   */
  async download(token: string, password: string | undefined): Promise<FileDownload> {
    const file = await this.findDownloadable(token);
    if (file.passwordHash !== null) {
      if (!password) throw new UnprocessableEntityException(FILE_MESSAGES.downloadPasswordRequired);
      if (!(await bcrypt.compare(password, file.passwordHash))) throw new UnauthorizedException('Mot de passe incorrect');
    }
    return {
      originalName: file.originalName,
      sizeBytes: Number(file.sizeBytes),
      stream: this.storage.read(file.storagePath),
    };
  }

  /**
   * Resolves a download link. An expired file is refused as soon as its date has passed, without waiting for the daily purge (see the note
   * on the life cycle of an expired file in docs/architecture.md).
   *
   * @throws NotFoundException (404) for an unknown link or an already purged file.
   * @throws GoneException (410) for an expired link.
   */
  private async findDownloadable(token: string): Promise<File> {
    const file = await this.prisma.file.findUnique({ where: { downloadToken: token } });
    if (!file) throw new NotFoundException("Ce lien de téléchargement n'existe pas ou le fichier a été supprimé");
    if (file.expiresAt.getTime() <= Date.now()) {
      throw new GoneException("Ce fichier n'est plus disponible en téléchargement car il a expiré");
    }
    return file;
  }
}
