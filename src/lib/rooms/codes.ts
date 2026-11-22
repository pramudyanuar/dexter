import { CODE_ALPHABET, CODE_LENGTH } from '@/lib/rooms/code-format';

export {
  CODE_LENGTH,
  CODE_PATTERN,
  normalizeCode,
} from '@/lib/rooms/code-format';

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    '',
  );
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
