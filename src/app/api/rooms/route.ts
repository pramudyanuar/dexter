import { NextResponse } from 'next/server';

import { newCode, newToken } from '@/lib/rooms/codes';
import { newRoom, toView } from '@/lib/rooms/engine';
import { isGameId } from '@/lib/rooms/games';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { getRoomStore } from '@/lib/rooms/store';

const limiter = createLimiter(20, 60 * 60 * 1000);

const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Upstash Redis ke project ini (lihat .env.example).';

export async function POST(req: Request) {
  const store = getRoomStore();
  if (!store)
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });

  const body = await req.json().catch(() => null);
  const game = body?.game;
  if (!isGameId(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (!limiter.allow(ip)) {
    return NextResponse.json(
      { error: 'Terlalu banyak room dibuat, coba lagi nanti' },
      { status: 429 },
    );
  }

  try {
    // a collision is very unlikely, but a few retries cost nothing
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = newToken();
      const room = newRoom(game, newCode(), token);
      if (await store.create(room)) {
        return NextResponse.json(
          { code: room.code, token, you: 0, room: toView(room, token) },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }
    throw new Error('no free code');
  } catch {
    return NextResponse.json({ error: 'Gagal membuat room' }, { status: 500 });
  }
}
