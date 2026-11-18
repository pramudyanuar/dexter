import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  canSubmitDaily,
  DAILY_RULES_VERSION,
  dailyChallenge,
  readSnakeReplay,
  replayDaily,
} from '@/lib/games/snake-daily';
import { getDailyLeaderboardStore } from '@/lib/leaderboard/store';
import { readJson } from '@/lib/read-json';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_BODY_BYTES = 64 * 1024;
const unavailable = 'Peringkat Harian sedang tidak tersedia.';
const submission = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  version: z.literal(DAILY_RULES_VERSION),
  playerId: z.uuid(),
  name: z.string().trim().min(1).max(24),
  replay: z.unknown(),
});

export async function GET() {
  const challenge = dailyChallenge();
  const store = getDailyLeaderboardStore(challenge.day, challenge.version);
  const entries = (await store?.list('snake').catch(() => null)) ?? null;
  return Response.json(
    { ...challenge, entries: entries ?? [], available: entries !== null },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const body = submission.safeParse(await readJson(request, MAX_BODY_BYTES));
  if (!body.success) {
    return Response.json(
      { error: 'Data permainan tidak valid.' },
      { status: 400 },
    );
  }
  const { day, version, playerId, name } = body.data;
  const now = Date.now();
  if (!canSubmitDaily(day, now)) {
    return Response.json(
      { error: 'Waktu kirim skor untuk tanggal ini sudah lewat.' },
      { status: 409 },
    );
  }
  const store = getDailyLeaderboardStore(day, version);
  if (!store) return Response.json({ error: unavailable }, { status: 503 });

  const replay = readSnakeReplay(body.data.replay);
  const score = replay ? replayDaily(day, replay) : null;
  if (score === null) {
    return Response.json(
      { error: 'Riwayat permainan tidak valid.' },
      { status: 400 },
    );
  }
  const id = createHash('sha256')
    .update(`${day}:${playerId.toLowerCase()}`)
    .digest('hex');
  try {
    const result = await store.submit('snake', { id, name, score, at: now });
    return Response.json(
      { day, ...result },
      { status: 201, headers: NO_STORE },
    );
  } catch {
    return Response.json({ error: unavailable }, { status: 503 });
  }
}
