import { FILE_MESSAGES, type AuthUser, type FileUploadResponse } from '@datashare/shared-lib';
import { Body, Controller, Post, UnprocessableEntityException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UploadFileDto } from './dto/upload-file.dto.js';
import { FilesService } from './files.service.js';
import { UploadErrorsInterceptor } from './upload-errors.interceptor.js';

/** Files of the logged-in user (see docs/api-contract.yaml, `files` tag). */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /**
   * US01: 201 with the link to share; 422 if the file is missing, over 1 GB or forbidden, or if a field is invalid.
   *
   * Reserved to logged-in users for now: the guard runs before multer, so an anonymous request is refused before its file is written. US07
   * (anonymous upload) will make the authentication optional on this route.
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  // Size limit, temporary directory and extension filter: options registered with MulterModule in FilesModule.
  @UseInterceptors(UploadErrorsInterceptor, FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthUser,
  ): Promise<FileUploadResponse> {
    if (!file) throw new UnprocessableEntityException(FILE_MESSAGES.fileRequired);
    return this.files.upload(file, dto, user.id);
  }
}
