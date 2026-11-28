import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'dexter_admin';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sha256(val: string): Buffer {
  return createHash('sha256').update(val).digest();
}

function getSecret(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

function sign(exp: number, secret: string): string {
  return createHmac('sha256', secret).update(String(exp)).digest('hex');
}

export function createAdminCookieValue(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  return `${exp}.${sign(exp, secret)}`;
}

export function verifyAdminPassword(input: string): boolean {
  const secret = getSecret();
  if (!secret || !input) return false;
  return timingSafeEqual(sha256(input), sha256(secret));
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function adminAuthMode(): 'dev-open' | 'password' | 'unconfigured' {
  if (getSecret()) return 'password';
  return process.env.NODE_ENV === 'production' ? 'unconfigured' : 'dev-open';
}

export function isAdminAuthed(req: Request): boolean {
  const secret = getSecret();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(exp, secret);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
