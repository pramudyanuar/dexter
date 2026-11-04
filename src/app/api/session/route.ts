import { NextResponse } from 'next/server';

import { isAuthed } from '@/lib/session';

export async function GET(req: Request) {
  return NextResponse.json(
    { authed: isAuthed(req) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
