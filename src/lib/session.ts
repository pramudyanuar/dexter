import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'dexter_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/**
 * Stateless sessions: the cookie holds an expiry and an HMAC of it, keyed from
 * CHAT_TOTP_SECRET. Rotating that secret logs everyone out.
 */
function sign(exp: string): string | null {
  const secret = process.env.CHAT_TOTP_SECRET;
  if (!secret) return null;
  const key = createHmac('sha256', secret).update('session-cookie').digest();
  return createHmac('sha256', key).update(exp).digest('base64url');
}

export function createSession(): string | null {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  const sig = sign(exp);
  return sig ? `${exp}.${sig}` : null;
}

export function isAuthed(req: Request): boolean {
  const cookie = req.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!cookie) return false;

  const [exp, sig] = cookie.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;

  const expected = sign(exp);
  if (!expected || expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

const PROXY_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Short-lived token for /api/proxy. Pages shown through the proxy run in a
 * sandbox without our cookies, so their requests carry this in the URL.
 */
export function createProxyToken(): string | null {
  const exp = String(Math.floor(Date.now() / 1000) + PROXY_TOKEN_TTL_SECONDS);
  const sig = sign(`proxy:${exp}`);
  return sig ? `${exp}.${sig}` : null;
}

export function isProxyToken(token: string): boolean {
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;

  const expected = sign(`proxy:${exp}`);
  if (!expected || expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
