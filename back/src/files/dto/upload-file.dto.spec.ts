// @Type() relies on reflect-metadata, which Nest loads in the application but not in a bare unit test.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadFileDto } from './upload-file.dto.js';

/** Mimics the global ValidationPipe on the text fields of the multipart body (always strings). */
async function errorsFor(body: Record<string, string>) {
  const dto = plainToInstance(UploadFileDto, body);
  const errors = await validate(dto);
  return { dto, fields: errors.map((e) => e.property) };
}

describe('UploadFileDto (US01 input rules)', () => {
  it('defaults to 7 days without password', async () => {
    const { dto, fields } = await errorsFor({});
    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ expiresInDays: 7, password: undefined });
  });

  it('converts the duration sent as text', async () => {
    const { dto, fields } = await errorsFor({ expiresInDays: '1' });
    expect(fields).toEqual([]);
    expect(dto.expiresInDays).toBe(1);
  });

  it.each(['0', '8', '2.5', 'abc'])('rejects a duration of "%s" days', async (expiresInDays) => {
    const { fields } = await errorsFor({ expiresInDays });
    expect(fields).toEqual(['expiresInDays']);
  });

  it('accepts a 6-character password and rejects a shorter one', async () => {
    expect((await errorsFor({ password: '123456' })).fields).toEqual([]);
    expect((await errorsFor({ password: '12345' })).fields).toEqual(['password']);
  });

  it('rejects a password over 72 bytes, accents counting double', async () => {
    expect((await errorsFor({ password: 'é'.repeat(36) })).fields).toEqual([]);
    expect((await errorsFor({ password: 'é'.repeat(37) })).fields).toEqual(['password']);
  });

  it('treats an empty password as no password', async () => {
    const { dto, fields } = await errorsFor({ password: '' });
    expect(fields).toEqual([]);
    expect(dto.password).toBeUndefined();
  });
});
