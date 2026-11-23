import { z } from 'zod';

import { SEATS } from '@/lib/games/snake-duel';
import { readJson } from '@/lib/read-json';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import type { PublicRoom } from '@/lib/rooms/types';
import {
  checkAdmission,
  duelFailure,
  duelName,
  NO_STORE,
} from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import { DuelError, getDuelStore } from '@/lib/snake-duel/store';

const player = {
  name: duelName,
  token: z.string().regex(TOKEN_PATTERN),
};
const bodySchema = z.discriminatedUnion('action', [
  z.object({ ...player, action: z.literal('create'), public: z.boolean() }),
  z.object({ ...player, action: z.literal('join'), code: z.string().max(16) }),
]);

export async function GET() {
  try {
    const store = getDuelStore();
    const rooms = (await store.listRooms()).map(
      (room): PublicRoom & typeof room => ({
        ...room,
        hostName: room.name,
        players: SEATS.length - 1,
        capacity: SEATS.length,
      }),
    );
    return Response.json(
      { rooms },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=4' } },
    );
  } catch (error) {
    return duelFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const store = getDuelStore();
    const parsed = bodySchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new DuelError('Data pemain tidak valid.', 400);
    const body = parsed.data;
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
