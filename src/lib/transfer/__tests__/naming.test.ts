import {
  buildPathname,
  newFileId,
  parsePathname,
  sanitizeName,
} from '@/lib/transfer/naming';

describe('sanitizeName', () => {
  it('keeps ordinary names, including unicode and dotfiles', () => {
    expect(sanitizeName('laporan akhir (v2).pdf')).toBe(
      'laporan akhir (v2).pdf',
    );
    expect(sanitizeName('foto liburan 🌴.jpg')).toBe('foto liburan 🌴.jpg');
    expect(sanitizeName('.env')).toBe('.env');
  });

  it('replaces characters that are unsafe in a path', () => {
    expect(sanitizeName('a/b\\c:d*e?f"g<h>i|j.txt')).toBe(
      'a_b_c_d_e_f_g_h_i_j.txt',
    );
    expect(sanitizeName('x\u0000y\ny')).toBe('x_y_y');
  });

  it('never returns an empty or dot-only name', () => {
    for (const bad of ['', '   ', '.', '..'])
      expect(sanitizeName(bad)).toBe('file');
  });

  it('shortens long names but keeps the extension', () => {
    const name = sanitizeName(`${'a'.repeat(400)}.tar.gz`);
    expect(name.length).toBeLessThanOrEqual(150);
    expect(name.endsWith('.gz')).toBe(true);
  });
});

describe('pathnames', () => {
  it('builds and parses what it builds', () => {
    const id = newFileId();
    expect(id).toMatch(/^[a-z0-9]{12}$/);
    const pathname = buildPathname(id, 'cat.png');
    expect(parsePathname(pathname)).toEqual({ id, name: 'cat.png' });
  });

  it('makes ids that differ', () => {
    expect(new Set(Array.from({ length: 200 }, newFileId)).size).toBe(200);
  });

  it.each([
    'transfer/../../etc/passwd',
    'transfer/abc12345/../x',
    'transfer/abc12345/..',
    'transfer/abc12345/.',
    'transfer/abc12345/a/b',
    'transfer/abc12345/a\\b',
    'transfer/ABC12345/file',
    'transfer/abc/file',
    'other/abc12345def0/file',
    '/transfer/abc12345def0/file',
    'transfer/abc12345def0/',
    'transfer/abc12345def0/bad\u0000name',
    `transfer/abc12345def0/${'x'.repeat(201)}`,
  ])('rejects %j', (pathname) => {
    expect(parsePathname(pathname)).toBeNull();
  });
});
