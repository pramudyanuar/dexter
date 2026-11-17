import { NextResponse } from 'next/server';

import { isAdminAuthed } from '@/lib/rooms/admin-auth';
import {
  DEFAULT_GAME_CONFIG,
  getGameConfig,
  saveGameConfig,
} from '@/lib/rooms/game-config';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await getGameConfig();
  return NextResponse.json({ config }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const config = await saveGameConfig(body?.config ?? body);
  return NextResponse.json({ config }, { headers: NO_STORE });
}

export async function DELETE(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const config = await saveGameConfig(DEFAULT_GAME_CONFIG);
  return NextResponse.json({ config }, { headers: NO_STORE });
}
