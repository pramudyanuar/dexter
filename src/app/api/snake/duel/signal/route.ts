import { z } from 'zod';

import { readJson } from '@/lib/read-json';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import { duelFailure, NO_STORE } from '@/lib/snake-duel/http';
import { DuelSession, TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import { DuelError, getDuelStore } from '@/lib/snake-duel/store';

const id = z.string().regex(TOKEN_PATTERN);
const signal = z.union([
  z.object({
    guest: id,
    attempt: id,
    sdp: z.string().min(1).max(12000).startsWith('v=0'),
  }),
  z.object({ paired: id }),
]);

function sessionFrom(request: Request): DuelSession {
  const search = new URL(request.url).searchParams;
  const code = normalizeCode(search.get('room') ?? '');
  const seat = search.get('seat');
  const token = request.headers.get('x-player-token') ?? '';
  if (
    !CODE_PATTERN.test(code) ||
    (seat !== '0' && seat !== '1') ||
    !TOKEN_PATTERN.test(token)
  ) {
    throw new DuelError('Sesi duel tidak valid.', 400);
  }
  return { code, seat: seat === '0' ? 0 : 1, token };
}

export async function GET(request: Request) {
  try {
    const session = sessionFrom(request);
    return Response.json(await getDuelStore().exchangeSignal(session), {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = sessionFrom(request);
    const parsed = signal.safeParse(await readJson(request, 16_384));
    if (!parsed.success)
      throw new DuelError('Data koneksi WebRTC tidak valid.', 400);
    return Response.json(
      await getDuelStore().exchangeSignal(session, parsed.data),
      { headers: NO_STORE },
    );
  } catch (error) {
    return duelFailure(error);
  }
}
