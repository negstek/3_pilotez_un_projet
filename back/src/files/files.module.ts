import { FILE_MAX_SIZE_BYTES, FILE_MESSAGES, isForbiddenFileName } from '@datashare/shared-lib';
import { Module, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { uploadTempDir } from '../storage/local-storage.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { DownloadController } from './download.controller.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

/** Upload and download of files (US01, US02). */
@Module({
  imports: [
    AuthModule,
    StorageModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Streamed to disk while it is received, never held in memory (up to 1 GB). multer creates the directory if needed.
        dest: uploadTempDir(config),
        // Exceeding the size stops the reception and deletes the partial file; UploadErrorsInterceptor turns the 413 into a 422.
        limits: { fileSize: FILE_MAX_SIZE_BYTES, files: 1 },
        // Decodes non-ASCII file names ("résumé.pdf") as UTF-8, as browsers send them, instead of busboy's latin1 default.
        defParamCharset: 'utf8',
        // Checked on the part's headers, before any byte of the file is written.
        fileFilter: (_req, file, callback) => {
          if (isForbiddenFileName(file.originalname)) {
            callback(new UnprocessableEntityException(FILE_MESSAGES.fileForbidden), false);
          } else {
            callback(null, true);
          }
        },
      }),
    }),
  ],
  controllers: [FilesController, DownloadController],
  providers: [FilesService],
})
export class FilesModule {}
