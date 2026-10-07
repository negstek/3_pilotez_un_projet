import type { DownloadRequest } from '@datashare/shared-lib';
import { IsOptional, IsString } from 'class-validator';

/** Body of POST /f/{token}/download (US02). Whether the password is required depends on the file, so FilesService checks it. */
export class DownloadFileDto implements DownloadRequest {
  @IsOptional()
  @IsString()
  password?: string;
}
