import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';
import { RegisterDto } from './register.dto.js';

/**
 * Mimics the global ValidationPipe: turns a raw body into the DTO (running @Transform) then validates it. Returns the DTO and the names of
 * the invalid fields.
 */
async function errorsFor<T extends object>(cls: new () => T, body: Record<string, unknown>) {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto);
  return { dto, fields: errors.map((e) => e.property) };
}

describe('RegisterDto (US03 input rules)', () => {
  it('accepts a valid email and an 8-character password', async () => {
    const { fields } = await errorsFor(RegisterDto, {
      email: 'alice@test.fr',
      password: '12345678',
    });
    expect(fields).toEqual([]);
  });

  it.each(['alice', 'alice@', '@test.fr', 'alice test@test.fr', ''])('rejects the invalid email "%s"', async (email) => {
    const { fields } = await errorsFor(RegisterDto, {
      email,
      password: 'motdepasse',
    });
    expect(fields).toEqual(['email']);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { fields } = await errorsFor(RegisterDto, {
      email: 'alice@test.fr',
      password: '1234567',
    });
    expect(fields).toEqual(['password']);
  });

  it('accepts a 72-byte password, the limit bcrypt takes into account', async () => {
    const { fields } = await errorsFor(RegisterDto, {
      email: 'alice@test.fr',
      password: 'a'.repeat(72),
    });
    expect(fields).toEqual([]);
  });

  it('rejects a password longer than 72 bytes', async () => {
    const { fields } = await errorsFor(RegisterDto, {
      email: 'alice@test.fr',
      password: 'a'.repeat(73),
    });
    expect(fields).toEqual(['password']);
  });

  it('counts accented characters in bytes (2 bytes for "é")', async () => {
    const { fields } = await errorsFor(RegisterDto, {
      email: 'alice@test.fr',
      password: 'é'.repeat(37),
    });
    expect(fields).toEqual(['password']);
  });

  it('rejects a request with neither email nor password', async () => {
    const { fields } = await errorsFor(RegisterDto, {});
    expect(fields).toEqual(['email', 'password']);
  });

  it('normalizes the email (case and spaces) to guarantee uniqueness', async () => {
    const { dto } = await errorsFor(RegisterDto, {
      email: '  Alice@Test.FR ',
      password: 'motdepasse',
    });
    expect(dto.email).toBe('alice@test.fr');
  });
});

describe('LoginDto (US04 input rules)', () => {
  it('rejects a malformed email', async () => {
    const { fields } = await errorsFor(LoginDto, {
      email: 'alice',
      password: 'motdepasse',
    });
    expect(fields).toEqual(['email']);
  });

  it('rejects an empty password', async () => {
    const { fields } = await errorsFor(LoginDto, {
      email: 'alice@test.fr',
      password: '',
    });
    expect(fields).toEqual(['password']);
  });

  it('does not enforce a minimum length (checked at sign-up)', async () => {
    const { fields } = await errorsFor(LoginDto, {
      email: 'alice@test.fr',
      password: 'court',
    });
    expect(fields).toEqual([]);
  });
});
