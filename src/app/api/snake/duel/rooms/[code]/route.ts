import { z } from 'zod';

import { Dir, isDirection } from '@/lib/games/snake';
import { readJson } from '@/lib/read-json';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import { RoomError } from '@/lib/rooms/types';
import { duelFailure, NO_STORE } from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import { requireDuelStore } from '@/lib/snake-duel/store';

type Context = { params: Promise<{ code: string }> };

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ready'), ready: z.boolean() }),
  z.object({
    action: z.literal('move'),
    move: z.object({
      roundId: z.string().regex(TOKEN_PATTERN),
      seq: z.int().positive(),
      dir: z.custom<Dir>(isDirection),
    }),
  }),
  z.object({ action: z.literal('leave') }),
]);

async function readRoomRequest(request: Request, { params }: Context) {
  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code))
    throw new RoomError('Kode room tidak valid.', 400);
  const token = request.headers.get('x-player-token') ?? '';
  if (!TOKEN_PATTERN.test(token))
    throw new RoomError('Token pemain tidak valid.', 403);
  const version = Number(new URL(request.url).searchParams.get('v'));
  return { code, token, version };
}

export async function GET(request: Request, context: Context) {
  try {
    const store = requireDuelStore();
    const { code, token, version } = await readRoomRequest(request, context);
    return Response.json(await store.poll(code, token, version), {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const store = requireDuelStore();
    const { code, token, version } = await readRoomRequest(request, context);
    const parsed = bodySchema.safeParse(await readJson(request, 1024));
    if (!parsed.success) throw new RoomError('Aksi tidak valid.', 400);
    const body = parsed.data;
    switch (body.action) {
      case 'move':
        return Response.json(
          await store.poll(code, token, version, body.move),
          {
            headers: NO_STORE,
          },
        );
      case 'ready':
        await store.ready(code, token, body.ready);
        break;
      case 'leave':
        await store.leave(code, token);
        break;
    }
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (error) {
    return duelFailure(error);
  }
}
