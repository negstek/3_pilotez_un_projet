import { FILE_MESSAGES } from '@datashare/shared-lib';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { rm } from 'node:fs/promises';
import { catchError, Observable } from 'rxjs';

/**
 * Wraps the upload route, around FileInterceptor (it must be listed before it in @UseInterceptors):
 * - converts multer's 413 for a file over the size limit into the 422 of every other input check, with the message of the form (see the
 *   note on HTTP error codes in docs/architecture.md);
 * - deletes the temporary file when the request fails after multer has written it (invalid fields, database error…), so a rejected upload
 *   never stays on disk. multer itself cleans up when it is the one failing.
 */
@Injectable()
export class UploadErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Read before multer runs, but it is the same object: `request.file`, set by multer afterwards, is visible in catchError.
    const request = context.switchToHttp().getRequest<Request>();
    // next.handle() runs FileInterceptor (multer), then the controller; a success goes through untouched.
    return next.handle().pipe(
      // async: catchError accepts the returned promise, so the file is deleted before the error reaches the exception filter.
      catchError(async (error: unknown) => {
        // `force`: the file may already have been moved to the storage (failure after the save).
        if (request.file) await rm(request.file.path, { force: true });
        if (error instanceof PayloadTooLargeException) throw new UnprocessableEntityException(FILE_MESSAGES.fileTooLarge);
        throw error;
      }),
    );
  }
}
