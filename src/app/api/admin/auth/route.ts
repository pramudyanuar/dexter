import { NextResponse } from 'next/server';

import {
  ADMIN_COOKIE_MAX_AGE,
  ADMIN_COOKIE_NAME,
  adminAuthMode,
  createAdminCookieValue,
  isAdminAuthed,
  verifyAdminPassword,
} from '@/lib/rooms/admin-auth';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  return NextResponse.json(
    {
      authed: isAdminAuthed(req),
      mode: adminAuthMode(),
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  const mode = adminAuthMode();
  if (mode === 'dev-open') {
    return NextResponse.json({ authed: true }, { headers: NO_STORE });
  }
  if (mode === 'unconfigured') {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD belum diatur di environment server.' },
      { status: 503, headers: NO_STORE },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    password?: string;
  } | null;
  const password = String(body?.password ?? '');
  if (!verifyAdminPassword(password)) {
    return NextResponse.json(
      { error: 'Password admin salah.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const value = createAdminCookieValue();
  const res = NextResponse.json({ authed: true }, { headers: NO_STORE });
  if (value) {
    res.cookies.set(ADMIN_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ADMIN_COOKIE_MAX_AGE,
    });
  }
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ authed: false }, { headers: NO_STORE });
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
