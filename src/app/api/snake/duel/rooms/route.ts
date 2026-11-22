import { z } from 'zod';

import { SEATS } from '@/lib/games/snake-duel';
import { readJson } from '@/lib/read-json';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import type { PublicRoom } from '@/lib/rooms/types';
import { RoomError } from '@/lib/rooms/types';
import {
  checkAdmission,
  duelFailure,
  duelName,
  NO_STORE,
} from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import { requireDuelStore } from '@/lib/snake-duel/store';

const player = {
  name: duelName,
  token: z.string().regex(TOKEN_PATTERN),
};
const bodySchema = z.discriminatedUnion('action', [
  z.object({ ...player, action: z.literal('create'), isPublic: z.boolean() }),
  z.object({ ...player, action: z.literal('join'), code: z.string().max(16) }),
]);

export async function GET() {
  try {
    const store = requireDuelStore();
    const rooms = (await store.listRooms()).map(
      (room): PublicRoom & typeof room => ({
        ...room,
        hostName: room.name,
        players: SEATS.length - 1,
        capacity: SEATS.length,
      }),
    );
    return Response.json({ rooms }, { headers: NO_STORE });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const store = requireDuelStore();
    const parsed = bodySchema.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new RoomError('Data pemain tidak valid.', 400);
    const body = parsed.data;
    await checkAdmission(store, request);
    let session;
    if (body.action === 'join') {
      const code = normalizeCode(body.code);
      if (!CODE_PATTERN.test(code))
        throw new RoomError('Kode room tidak valid.', 400);
      session = await store.joinRoom(code, body.name, body.token);
    } else {
      session = await store.createRoom(body.name, body.isPublic, body.token);
    }
    return Response.json({ session }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return duelFailure(error);
  }
}
