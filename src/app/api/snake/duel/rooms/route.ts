import { z } from 'zod';

import { readJson } from '@/lib/read-json';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import { checkAdmission, duelFailure, NO_STORE } from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import {
  DUEL_UNAVAILABLE,
  DuelError,
  getDuelStore,
} from '@/lib/snake-duel/store';

const player = {
  name: z.string().trim().min(1).max(16),
  token: z.string().regex(TOKEN_PATTERN),
};
const bodySchema = z.discriminatedUnion('action', [
  z.object({ ...player, action: z.literal('create'), public: z.boolean() }),
  z.object({ ...player, action: z.literal('join'), code: z.string().max(16) }),
]);

export async function GET() {
  const store = getDuelStore();
  if (!store) return duelFailure(new DuelError(DUEL_UNAVAILABLE, 503));
  try {
    return Response.json(
      { rooms: await store.listRooms() },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=4' } },
    );
  } catch (error) {
    return duelFailure(error);
  }
}

export async function POST(request: Request) {
  const store = getDuelStore();
  if (!store) return duelFailure(new DuelError(DUEL_UNAVAILABLE, 503));
  const parsed = bodySchema.safeParse(await readJson(request, 4096));
  if (!parsed.success)
    return duelFailure(new DuelError('Data pemain tidak valid.', 400));
  const body = parsed.data;

  try {
    await checkAdmission(store, request);
    const code = body.action === 'join' ? normalizeCode(body.code) : null;
    if (code !== null && !CODE_PATTERN.test(code))
      throw new DuelError('Kode room tidak valid.', 400);
    const session =
      body.action === 'join'
        ? await store.joinRoom(code!, body.name, body.token)
        : await store.createRoom(body.name, body.public, body.token);
    return Response.json({ session }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return duelFailure(error);
  }
}
