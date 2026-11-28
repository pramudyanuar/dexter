import { NextResponse } from 'next/server';

import { createProxyToken, isAuthed } from '@/features/auth/session';

export async function GET(req: Request) {
  const token = isAuthed(req) ? createProxyToken() : null;
  if (!token) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  return NextResponse.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
