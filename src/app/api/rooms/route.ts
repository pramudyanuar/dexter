import { NextResponse } from 'next/server';

import { newCode, newToken } from '@/lib/rooms/codes';
import { capacityOf, newRoom, toView } from '@/lib/rooms/engine';
import { getGameConfig } from '@/lib/rooms/game-config';
import { GAMES, isGameId } from '@/lib/rooms/games';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { getRoomStore } from '@/lib/rooms/store';

const limiter = createLimiter(20, 60 * 60 * 1000);

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Upstash Redis ke project ini (lihat .env.example).';

export async function GET(req: Request) {
  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const game = new URL(req.url).searchParams.get('game');
  if (game && !isGameId(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  const codes = await store.listCodes();
  const loaded = await Promise.all(codes.map((c) => store.get(c)));
  const openRooms = loaded
    .flatMap((r) => {
      if (!r || r.status !== 'waiting' || r.public === false) return [];
      if (game && r.game !== game) return [];
      const players = r.tokens.filter(Boolean).length;
      const capacity = capacityOf(r);
      if (players === 0 || players >= capacity) return [];
      const hostSeat = r.host ?? 0;
      const hostName = r.names?.[hostSeat]?.trim() || `Pemain ${hostSeat + 1}`;
      return [
        {
          code: r.code,
          game: r.game,
          hostName,
          players,
          capacity,
          createdAt: r.createdAt,
        },
      ];
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json({ rooms: openRooms }, { headers: NO_STORE });
}

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
    const cfg = await getGameConfig();
    const baseOpts = GAMES[game].defaultOptions;
    const gameOpts =
      game in cfg ? cfg[game as Exclude<keyof typeof cfg, 'room'>] : undefined;
    const roomOpts = {
      maxStrikes: cfg.room.maxStrikes,
      leaveGraceSeconds: cfg.room.leaveGraceSeconds,
      ...(cfg.room.turnSeconds > 0
        ? { turnSeconds: cfg.room.turnSeconds }
        : {}),
    };
    const mergedOpts = {
      ...(baseOpts && typeof baseOpts === 'object' ? baseOpts : {}),
      ...(gameOpts ?? {}),
      ...roomOpts,
    };

    // a collision is very unlikely, but a few retries cost nothing
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = newToken();
      const room = newRoom(game, newCode(), token, Date.now(), body?.name);
      room.public = body?.isPublic !== false;
      room.options = mergedOpts;
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
