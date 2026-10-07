import type { FilePublicMetadata } from '@datashare/shared-lib';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { DownloadFileDto } from './dto/download-file.dto.js';
import { FilesService } from './files.service.js';

/**
 * Public download routes (US02): anyone holding the link can use them while it is valid, without an account. The link carries the
 * unpredictable download token, never the file's id.
 */
@Controller('f')
export class DownloadController {
  constructor(private readonly files: FilesService) {}

  /** 200 with the metadata; 404 unknown link; 410 expired link. */
  @Get(':token')
  getMetadata(@Param('token') token: string): Promise<FilePublicMetadata> {
    return this.files.getMetadata(token);
  }

  /**
   * 200 with the content; 401 wrong password; 422 missing password for a protected file; 404 / 410 as above.
   *
   * POST rather than GET so that the password travels in the body, never in a URL (which ends up in history and server logs).
   */
  @Post(':token/download')
  // POST defaults to 201 in Nest, but downloading creates no resource.
  @HttpCode(HttpStatus.OK)
  async download(
    @Param('token') token: string,
    @Body() dto: DownloadFileDto,
    // `passthrough`: the response is only used to set headers; Nest still sends the returned StreamableFile and applies its filters.
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.files.download(token, dto.password);
    // Content-Disposition with the original name, encoded by Express for non-ASCII characters. The type is forced to a neutral binary one
    // whatever the declared type, so the browser never renders an uploaded file (HTML, SVG…) as a page of the API's origin.
    res.attachment(file.originalName);
    res.type('application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file.stream, { length: file.sizeBytes });
  }
}
