import { NextResponse } from 'next/server';

import {
  createSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/session';
import { verifyTotp } from '@/lib/totp';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
// Best effort: on serverless each instance keeps its own counter.
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  const secret = process.env.CHAT_TOTP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CHAT_TOTP_SECRET belum di-set. Jalankan: pnpm otp:setup' },
      { status: 500 },
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan, coba lagi nanti' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';

  let valid = false;
  try {
    valid = verifyTotp(secret, code);
  } catch {
    return NextResponse.json(
      { error: 'CHAT_TOTP_SECRET tidak valid (harus base32)' },
      { status: 500 },
    );
  }

  if (!valid) {
    const fresh = entry && entry.resetAt > now ? entry : null;
    attempts.set(ip, {
      count: (fresh?.count ?? 0) + 1,
      resetAt: fresh?.resetAt ?? now + WINDOW_MS,
    });
    return NextResponse.json({ error: 'Kode salah' }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSession()!, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
