/** @jest-environment node */
import {
  CODE_PATTERN,
  newCode,
  newToken,
  normalizeCode,
} from '@/lib/rooms/codes';
import { createLimiter } from '@/lib/rooms/rate-limit';

describe('room codes', () => {
  it('are 5 unambiguous characters', () => {
    for (let i = 0; i < 500; i++) {
      const code = newCode();
      expect(code).toMatch(CODE_PATTERN);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('rarely repeat', () => {
    expect(new Set(Array.from({ length: 300 }, newCode)).size).toBeGreaterThan(
      295,
    );
  });

  it('normalize what people type', () => {
    expect(normalizeCode(' ab cd2 ')).toBe('ABCD2');
    expect(CODE_PATTERN.test(normalizeCode('k7m2p'))).toBe(true);
    expect(CODE_PATTERN.test('ABCD0')).toBe(false);
    expect(CODE_PATTERN.test('ABCD')).toBe(false);
  });

  it('make long, distinct tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, newToken));
    expect(tokens.size).toBe(100);
    for (const t of tokens) expect(t).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit per key within the window, then resets', () => {
    const limiter = createLimiter(3, 1000);
    expect([1, 2, 3, 4].map(() => limiter.allow('a', 0))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(limiter.allow('b', 0)).toBe(true); // other keys are separate
    expect(limiter.allow('a', 999)).toBe(false);
    expect(limiter.allow('a', 1001)).toBe(true);
  });
});
