import { NextResponse } from 'next/server';

import { isAdminAuthed } from '@/features/rooms/admin-auth';
import { DEFAULT_GAME_CONFIG } from '@/features/rooms/game-config';
import {
  getGameConfig,
  saveGameConfig,
} from '@/features/rooms/game-config-store';

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
