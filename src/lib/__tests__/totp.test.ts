import { base32Decode, totp, verifyTotp } from '@/lib/totp';

// RFC 6238 test secret, ASCII "12345678901234567890"
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('decodes base32', () => {
    expect(base32Decode(SECRET).toString()).toBe('12345678901234567890');
  });

  it('matches RFC 6238 vectors (last 6 digits)', () => {
    expect(totp(SECRET, 59_000)).toBe('287082');
    expect(totp(SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totp(SECRET, 1_234_567_890_000)).toBe('005924');
  });

  it('accepts one step of clock drift and rejects the rest', () => {
    const now = 1_234_567_890_000;
    expect(verifyTotp(SECRET, totp(SECRET, now), now)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, now - 90_000), now)).toBe(false);
    expect(verifyTotp(SECRET, '12345', now)).toBe(false);
    expect(verifyTotp(SECRET, 'abcdef', now)).toBe(false);
  });
});
