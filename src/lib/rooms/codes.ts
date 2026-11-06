import { randomBytes } from 'node:crypto';

import { CODE_ALPHABET, CODE_LENGTH } from '@/lib/rooms/code-format';

export {
  CODE_LENGTH,
  CODE_PATTERN,
  normalizeCode,
} from '@/lib/rooms/code-format';

export function newCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    '',
  );
}

export const newToken = () => randomBytes(16).toString('hex');
