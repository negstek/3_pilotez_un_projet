import {
  FILE_MESSAGES,
  type FileHistoryItem,
  type FilePublicMetadata,
  type FileStatusFilter,
  type FileUploadResponse,
} from '@datashare/shared-lib';
import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { BCRYPT_ROUNDS } from '../auth/auth.service.js';
import { File, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UploadFileDto } from './dto/upload-file.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 404 of DELETE /files/{id}, also used by the controller for an id that is not a UUID. */
export const FILE_NOT_FOUND_MESSAGE = "Ce fichier n'existe pas ou a déjà été supprimé";

/** File received by multer: only the fields the service needs, so tests do not have to build a full Express.Multer.File. */
export type UploadedFileInfo = Pick<Express.Multer.File, 'path' | 'originalname' | 'mimetype' | 'size'>;

/** What the controller needs to send a file back. */
export interface FileDownload {
  originalName: string;
  sizeBytes: number;
  stream: Readable;
}

/**
 * Upload (US01), download through the link (US02), history (US05) and deletion (US06). The content goes through StorageService, the
 * metadata through Prisma.
 */
@Injectable()
export class FilesService {
  private readonly frontUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    // Base of the links to share (linkTo): the front's public URL.
    this.frontUrl = config.get<string>('FRONT_URL', 'https://localhost:8080');
  }

  /**
   * Stores the file and its metadata, and returns the link to share. The password is hashed before anything is written, so a bcrypt
   * failure leaves nothing behind.
   */
  async upload(file: UploadedFileInfo, dto: UploadFileDto, ownerId: string | null): Promise<FileUploadResponse> {
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
      return { id: created.id, downloadUrl: this.linkTo(created.downloadToken), expiresAt: created.expiresAt.toISOString() };
    } catch (error) {
      // Without its metadata, the stored content could never be downloaded nor purged.
      await this.storage.remove(storagePath);
      throw error;
    }
  }

  /**
   * History of the owner's files (US05), most recent first. A file is expired as soon as its date has passed, like for the download link,
   * and stays listed with this status until the daily purge deletes it (see the note on the life cycle of an expired file).
   */
  async list(ownerId: string, status: FileStatusFilter): Promise<FileHistoryItem[]> {
    // One reference time for the filter and the status, so that a file expiring during the request cannot be filtered as active and shown
    // as expired.
    const now = new Date();
    const where: Prisma.FileWhereInput = { ownerId };
    if (status === 'active') where.expiresAt = { gt: now };
    if (status === 'expired') where.expiresAt = { lte: now };
    const files = await this.prisma.file.findMany({ where, orderBy: { createdAt: 'desc' } });
    return files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      sizeBytes: Number(file.sizeBytes),
      createdAt: file.createdAt.toISOString(),
      expiresAt: file.expiresAt.toISOString(),
      status: file.expiresAt > now ? 'active' : 'expired',
      passwordProtected: file.passwordHash !== null,
      downloadUrl: this.linkTo(file.downloadToken),
    }));
  }

  /**
   * Deletes a file of the user, metadata and content, irreversibly (US06). Expired files can be deleted too: the purge would do it anyway.
   *
   * @throws NotFoundException (404) for an unknown or already deleted file.
   * @throws ForbiddenException (403) for a file of another user, or an anonymous upload (US07), which has no owner.
   */
  async remove(id: string, userId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException(FILE_NOT_FOUND_MESSAGE);
    if (file.ownerId !== userId) throw new ForbiddenException('Vous ne pouvez supprimer que vos propres fichiers');
    // The metadata first: once it is gone, the link answers 404 at once. The reverse order could leave, on failure, a link whose content no
    // longer exists. deleteMany rather than delete, which throws when a concurrent request has just deleted the same file.
    const { count } = await this.prisma.file.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException(FILE_NOT_FOUND_MESSAGE);
    await this.storage.remove(file.storagePath);
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

  /** Link to share: the front's download page, which then calls the API. */
  private linkTo(downloadToken: string): string {
    return `${this.frontUrl}/f/${downloadToken}`;
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
