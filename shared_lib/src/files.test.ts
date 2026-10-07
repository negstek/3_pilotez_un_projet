import { describe, expect, it } from 'vitest';
import { isForbiddenFileName } from './files.js';

describe('isForbiddenFileName (US01)', () => {
  it.each(['setup.exe', 'SETUP.EXE', 'script.sh', 'archive.tar.ps1', 'app.Jar'])('rejects "%s"', (name) => {
    expect(isForbiddenFileName(name)).toBe(true);
  });

  it.each(['photo.jpg', 'rapport.pdf', 'exe', 'notes.sh.txt', 'sans-extension'])('accepts "%s"', (name) => {
    expect(isForbiddenFileName(name)).toBe(false);
  });
});
