// Safe for the browser: no server-only imports here.

// no 0/O or 1/I: codes get read aloud and typed on phones
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

/** Accepts what people type: any case, stray spaces. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}
