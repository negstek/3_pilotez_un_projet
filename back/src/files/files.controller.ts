import { FILE_MESSAGES, type AuthUser, type FileHistoryItem, type FileUploadResponse } from '@datashare/shared-lib';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { ListFilesQueryDto } from './dto/list-files-query.dto.js';
import { UploadFileDto } from './dto/upload-file.dto.js';
import { FILE_NOT_FOUND_MESSAGE, FilesService } from './files.service.js';
import { UploadErrorsInterceptor } from './upload-errors.interceptor.js';

/**
 * Upload, open to visitors (US07), and files of the logged-in user (see docs/api-contract.yaml, `files` tag). The download through the
 * link is served by DownloadController.
 */
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /**
   * US01 / US07: 201 with the link to share; 422 if the file is missing, over 1 GB or forbidden, or if a field is invalid; 401 if a token
   * is sent but is invalid or expired.
   *
   * The authentication is optional: with a valid token the file belongs to the user (US01, listed in their history), without any
   * credentials it is stored with no owner (US07). Same rules and same link in both cases. The guard runs before multer, so a request
   * with a bad token is refused before its file is written.
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  // Size limit, temporary directory and extension filter: options registered with MulterModule in FilesModule.
  @UseInterceptors(UploadErrorsInterceptor, FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthUser | null,
  ): Promise<FileUploadResponse> {
    if (!file) throw new UnprocessableEntityException(FILE_MESSAGES.fileRequired);
    return this.files.upload(file, dto, user?.id ?? null);
  }

  /** US05: 200 with the user's files, active ones only unless `status` says otherwise; 422 for an unknown `status`. */
  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query() query: ListFilesQueryDto, @CurrentUser() user: AuthUser): Promise<FileHistoryItem[]> {
    // The owner always comes from the token, never from the request: a user cannot list someone else's files.
    return this.files.list(user.id, query.status);
  }

  /** US06: 204 once deleted; 403 for a file of another user; 404 for an unknown file. */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    // An id that is not a UUID cannot designate a file: 404 like any unknown id, rather than the database error it would cause.
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new NotFoundException(FILE_NOT_FOUND_MESSAGE) })) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.files.remove(id, user.id);
  }
}
