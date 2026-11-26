import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';

import type { Level } from '@/lib/games/minesweeper';
import { LEVELS } from '@/lib/games/minesweeper';
import { readMinesResult } from '@/lib/leaderboard/mines-proof';
import { verifySoloReplay } from '@/lib/leaderboard/replay';
import {
  getLeaderboardStore,
  getMinesLeaderboardStore,
} from '@/lib/leaderboard/store';
import {
  isLowerBetter,
  isMinesLevel,
  scoreUnit,
  sortEntries,
  VALID_GAME_IDS,
} from '@/lib/leaderboard/types';
import { readJson } from '@/lib/read-json';
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
      const [all, mines] = await Promise.all([
        store.listAll(),
        getMinesLeaderboardStore('mudah')?.list('minesweeper'),
      ]);
      const entries = sortEntries(
        [
          ...(mines ?? []),
          ...(all.minesweeper ?? []).filter((entry) => entry.meta === 'mudah'),
        ],
        'minesweeper',
      );
      if (entries.length) all.minesweeper = entries;
      else delete all.minesweeper;
      return NextResponse.json({ games: all }, { headers: NO_STORE });
    }
    let entries = await store.list(game);
    if (game === 'minesweeper') {
      const level = searchParams.get('level') ?? 'mudah';
      if (!isMinesLevel(level))
        return NextResponse.json(
          { error: 'Level tidak dikenal' },
          { status: 400 },
        );
      const ranked = await getMinesLeaderboardStore(level)?.list(game);
      entries = sortEntries(
        [...(ranked ?? []), ...entries.filter((entry) => entry.meta === level)],
        game,
      );
    }
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
  let store = getLeaderboardStore();
  if (!store) return storageUnavailable(NO_STORE_ERROR);

  const body = (await readJson(req, 256 * 1024)) as {
    game?: unknown;
    name?: unknown;
    replay?: unknown;
  } | null;

  const game = typeof body?.game === 'string' ? body.game.trim() : '';
  if (!VALID_GAME_IDS.has(game)) {
    return NextResponse.json({ error: 'Game tidak dikenal' }, { status: 400 });
  }

  const name =
    typeof body?.name === 'string' ? body.name.trim().slice(0, 24) : '';
  if (!name) {
    return NextResponse.json(
      { error: 'Nama pemain wajib diisi' },
      { status: 400 },
    );
  }

  const mine = game === 'minesweeper' ? readMinesResult(body?.replay) : null;
  const solo =
    game === 'minesweeper' ? null : verifySoloReplay(game, body?.replay);
  const verified = mine ?? solo;
  if (!verified) {
    return NextResponse.json(
      { error: 'Riwayat permainan tidak valid' },
      { status: 400, headers: NO_STORE },
    );
  }
  if (mine) store = getMinesLeaderboardStore(mine.level);
  if (!store) return storageUnavailable(NO_STORE_ERROR);
  const id =
    mine?.id ??
    createHash('sha256')
      .update(`${game}:${JSON.stringify(solo?.replay)}`)
      .digest('hex');
  try {
    const result = await store.submit(game, {
      id,
      name,
      score: verified.score,
      meta: mine?.level ?? solo?.meta,
      usedUndo: solo?.usedUndo,
      at: Date.now(),
      verified: true,
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
    if (game === 'minesweeper') {
      await Promise.all(
        (Object.keys(LEVELS) as Level[]).map((level) =>
          getMinesLeaderboardStore(level)?.clear(game),
        ),
      );
    }
    await store.clear(game);
    return NextResponse.json({ cleared: game }, { headers: NO_STORE });
  } catch {
    return storageUnavailable();
  }
}
