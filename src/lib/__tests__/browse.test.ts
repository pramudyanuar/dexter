import { toTarget } from '@/lib/browse';

const search = (q: string) => `search:${q}`;

describe('toTarget', () => {
  it('keeps full URLs as they are', () => {
    expect(toTarget('https://example.com/a?b=1', search)).toBe(
      'https://example.com/a?b=1',
    );
    expect(toTarget('HTTP://example.com', search)).toBe('HTTP://example.com');
  });

  it('adds https:// to bare domains, with path, port, or query', () => {
    expect(toTarget('example.com', search)).toBe('https://example.com');
    expect(toTarget('en.wikipedia.org/wiki/Rust', search)).toBe(
      'https://en.wikipedia.org/wiki/Rust',
    );
    expect(toTarget('localhost.dev:8080/x?y=1', search)).toBe(
      'https://localhost.dev:8080/x?y=1',
    );
  });

  it('searches for anything else', () => {
    expect(toTarget('belajar rust', search)).toBe('search:belajar rust');
    expect(toTarget('kucing', search)).toBe('search:kucing');
    expect(toTarget('example.com cara pakai', search)).toBe(
      'search:example.com cara pakai',
    );
  });

  it('ignores empty input', () => {
    expect(toTarget('   ', search)).toBeNull();
  });
});
