import { randomBytes, randomUUID } from 'node:crypto';

import { readJson } from '@/lib/read-json';

import {
  readMinesRound,
  signMinesProof,
} from '@/features/leaderboard/mines-proof';
import { verifyMinesReplay } from '@/features/leaderboard/replay';
import { isMinesLevel } from '@/features/leaderboard/types';

const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const body = (await readJson(request, 256 * 1024)) as {
    action?: unknown;
    level?: unknown;
    ticket?: unknown;
    moves?: unknown;
  } | null;
  const now = Date.now();
  if (body?.action === 'start' && isMinesLevel(body.level)) {
    const seed = randomBytes(4).readUInt32LE();
    const ticket = signMinesProof({
      id: randomUUID(),
      level: body.level,
      seed,
      startedAt: now,
    });
    return Response.json({ seed, ticket }, { headers });
  }
  if (body?.action === 'finish') {
    const round = readMinesRound(body.ticket);
    if (round && verifyMinesReplay(round.level, round.seed, body.moves)) {
      const score = Math.max(1, Math.round((now - round.startedAt) / 1000));
      return Response.json(
        {
          score,
          receipt: signMinesProof({ ...round, score }),
        },
        { headers },
      );
    }
  }
  return Response.json(
    { error: 'Riwayat Minesweeper tidak valid' },
    { headers, status: 400 },
  );
}
