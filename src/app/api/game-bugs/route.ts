import { createHash } from 'node:crypto';

import { getBugReportStore } from '@/lib/game-bugs/store';
import { BUG_DESCRIPTION_LIMIT, getBugReportGame } from '@/lib/game-bugs/types';
import { readJson } from '@/lib/read-json';
import { cleanName } from '@/lib/rooms/player-name';
import { createLimiter } from '@/lib/rooms/rate-limit';

const limiter = createLimiter(10, 10 * 60_000);

export async function POST(req: Request) {
  const body = (await readJson(req, 16 * 1024)) as {
    pathname?: unknown;
    description?: unknown;
    requestId?: unknown;
    playerName?: unknown;
  } | null;
  const game =
    typeof body?.pathname === 'string' ? getBugReportGame(body.pathname) : null;
  const description =
    typeof body?.description === 'string' ? body.description.trim() : '';
  const requestId = body?.requestId;
  if (
    !game ||
    !description ||
    description.length > BUG_DESCRIPTION_LIMIT ||
    typeof requestId !== 'string' ||
    !/^\d{1,10}(?:-\d{1,10}){3}$/.test(requestId)
  ) {
    return Response.json(
      { error: 'Laporan bug tidak valid.' },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (!limiter.allow(ip)) {
    return Response.json(
      { error: 'Terlalu banyak laporan. Coba lagi nanti.' },
      { status: 429 },
    );
  }

  try {
    const store = getBugReportStore();
    if (!store) throw new Error('Bug report storage is unavailable');
    const playerName = cleanName(body?.playerName);
    const fingerprint = [requestId, game.pathname, description];
    if (playerName) fingerprint.push(playerName);
    const id = createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
    await store.save({
      id,
      ...game,
      description,
      ...(playerName && { playerName }),
    });
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json(
      { error: 'Laporan belum dapat disimpan. Coba lagi.' },
      { status: 503 },
    );
  }
}
