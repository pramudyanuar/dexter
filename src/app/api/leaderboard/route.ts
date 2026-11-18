import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { MAX_SNAKE_SCORE } from '@/lib/games/snake';
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

function storageUnavailable(
  error = 'Leaderboard sedang tidak tersedia. Coba lagi.',
) {
  return NextResponse.json({ error }, { status: 503, headers: NO_STORE });
}

export async function GET(req: Request) {
  const store = getLeaderboardStore();
  if (!store) return storageUnavailable(NO_STORE_ERROR);

  const { searchParams } = new URL(req.url);
  const game = (searchParams.get('game') ?? '').trim();

  if (game && !VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  try {
    if (!game) {
      const all = await store.listAll();
      return NextResponse.json({ games: all }, { headers: NO_STORE });
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
  } catch {
    return storageUnavailable();
  }
}

export async function POST(req: Request) {
  const store = getLeaderboardStore();
  if (!store) return storageUnavailable(NO_STORE_ERROR);

  const body = (await req.json().catch(() => null)) as {
    game?: string;
    name?: string;
    score?: number;
    meta?: string;
    submissionId?: string;
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
  if (
    !Number.isFinite(score) ||
    score < 0 ||
    (game === 'snake' && (!Number.isInteger(score) || score > MAX_SNAKE_SCORE))
  ) {
    return NextResponse.json({ error: 'Skor tidak valid' }, { status: 400 });
  }

  const meta = body?.meta ? String(body.meta).trim().slice(0, 40) : undefined;
  const id =
    typeof body?.submissionId === 'string' &&
    /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(body.submissionId)
      ? body.submissionId
      : randomUUID();
  try {
    const result = await store.submit(game, {
      id,
      name,
      score: Math.round(score),
      meta,
      at: Date.now(),
    });
    return NextResponse.json(
      { game, rank: result.rank, entries: result.entries },
      { status: 201, headers: NO_STORE },
    );
  } catch {
    return storageUnavailable();
  }
}

export async function DELETE(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const store = getLeaderboardStore();
  if (!store) return storageUnavailable(NO_STORE_ERROR);

  const { searchParams } = new URL(req.url);
  const game = (searchParams.get('game') ?? '').trim();
  if (!VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  try {
    await store.clear(game);
    return NextResponse.json({ cleared: game }, { headers: NO_STORE });
  } catch {
    return storageUnavailable();
  }
}
