export type PasteTtl = '10m' | '1h' | '24h';

export interface PasteMemo {
  id: string;
  subject: string;
  content: string;
  createdAt: number;
  expiresAt: number;
}

export const PASTE_TTL_SECONDS: Record<PasteTtl, number> = {
  '10m': 10 * 60,
  '1h': 60 * 60,
  '24h': 24 * 60 * 60,
};

export const MAX_MEMOS = 25;
export const MAX_CONTENT_BYTES = 100_000;
export const MAX_SUBJECT_LEN = 120;
export const PASTE_CODE_PATTERN = /^\d{6}$/;

export function normalizePasteCode(raw: string): string {
  return raw.replace(/[\s-]+/g, '').trim();
}

export function generatePasteCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}
