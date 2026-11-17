import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { getLeaderboardStore } from '@/lib/leaderboard/store';
import {
  isLowerBetter,
  scoreUnit,
  VALID_GAME_IDS,
} from '@/lib/leaderboard/types';
import { isAdminAuthed } from '@/lib/rooms/admin-auth';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan leaderboard belum diatur. Hubungkan Upstash Redis ke project ini.';

export async function GET(req: Request) {
  const store = getLeaderboardStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const game = (searchParams.get('game') ?? '').trim();

  if (!game) {
    const all = await store.listAll();
    return NextResponse.json({ games: all }, { headers: NO_STORE });
  }

  if (!VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  const entries = await store.list(game);
  return NextResponse.json(
    {
      game,
      entries,
      lowerIsBetter: isLowerBetter(game),
      unit: scoreUnit(game),
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: Request) {
  const store = getLeaderboardStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as {
    game?: string;
    name?: string;
    score?: number;
    meta?: string;
  } | null;

  const game = String(body?.game ?? '').trim();
  if (!VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  const name = String(body?.name ?? '')
    .trim()
    .slice(0, 24);
  if (!name) {
    return NextResponse.json(
      { error: 'Nama pemain wajib diisi' },
      { status: 400 },
    );
  }

  const score = Number(body?.score);
  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: 'Skor tidak valid' }, { status: 400 });
  }

  const meta = body?.meta ? String(body.meta).trim().slice(0, 40) : undefined;
  const result = await store.submit(game, {
    id: randomUUID(),
    name,
    score: Math.round(score),
    meta,
    at: Date.now(),
  });

  return NextResponse.json(
    {
      game,
      rank: result.rank,
      entries: result.entries,
    },
    { status: 201, headers: NO_STORE },
  );
}

export async function DELETE(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = getLeaderboardStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const game = (searchParams.get('game') ?? '').trim();
  if (!VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  await store.clear(game);
  return NextResponse.json({ cleared: game }, { headers: NO_STORE });
}
