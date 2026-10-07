import { BadRequestException, PayloadTooLargeException, UnprocessableEntityException, type ExecutionContext } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firstValueFrom, of, throwError } from 'rxjs';
import { UploadErrorsInterceptor } from './upload-errors.interceptor.js';

// The 413 → 422 conversion cannot be checked end to end without sending more than 1 GB: it is tested here on the exception that
// FileInterceptor raises when multer reports the size limit.
describe('UploadErrorsInterceptor', () => {
  const interceptor = new UploadErrorsInterceptor();
  /** Minimal ExecutionContext: the interceptor only reads the HTTP request (for `request.file`). */
  const contextFor = (request: object) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
  /** Runs the interceptor around a route that fails with `error` (as multer or the controller would), and returns the outcome. */
  const run = (request: object, error: unknown) =>
    firstValueFrom(interceptor.intercept(contextFor(request), { handle: () => throwError(() => error) }));

  it('turns the 413 of a file over 1 GB into a 422 with the message of the form', async () => {
    const result = run({}, new PayloadTooLargeException('File too large'));

    await expect(result).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(result).rejects.toThrow('La taille des fichiers est limitée à 1 Go');
  });

  it('deletes the temporary file and rethrows any other error unchanged', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'upload-')), 'part');
    await writeFile(path, 'contenu');
    const error = new BadRequestException();

    await expect(run({ file: { path } }, error)).rejects.toBe(error);
    expect(existsSync(path)).toBe(false);
  });

  it('lets a successful response through', async () => {
    const response = { id: 'f1' };
    const result = await firstValueFrom(interceptor.intercept(contextFor({}), { handle: () => of(response) }));
    expect(result).toBe(response);
  });
});
