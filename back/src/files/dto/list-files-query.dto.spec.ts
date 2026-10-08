// @IsIn() relies on reflect-metadata, which Nest loads in the application but not in a bare unit test.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListFilesQueryDto } from './list-files-query.dto.js';

/** Mimics the global ValidationPipe on the query string (always strings). */
async function errorsFor(query: Record<string, string>) {
  const dto = plainToInstance(ListFilesQueryDto, query);
  const errors = await validate(dto);
  return { dto, fields: errors.map((e) => e.property) };
}

describe('ListFilesQueryDto (US05 filter)', () => {
  it('shows only the active files by default (US06)', async () => {
    const { dto, fields } = await errorsFor({});
    expect(fields).toEqual([]);
    expect(dto.status).toBe('active');
  });

  it.each(['active', 'expired', 'all'])('accepts status=%s', async (status) => {
    expect((await errorsFor({ status })).fields).toEqual([]);
  });

  it.each(['ACTIVE', 'deleted', ''])('rejects status="%s"', async (status) => {
    expect((await errorsFor({ status })).fields).toEqual(['status']);
  });
});
