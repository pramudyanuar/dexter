import { z } from 'zod';

import { readJson } from '@/lib/read-json';
import { RoomError } from '@/lib/rooms/types';
import {
  checkAdmission,
  duelFailure,
  duelName,
  NO_STORE,
} from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import { requireDuelStore } from '@/lib/snake-duel/store';

const player = z.object({ name: duelName });

function ticketFrom(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const ticket = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!TOKEN_PATTERN.test(ticket))
    throw new RoomError('Tiket pencarian tidak valid.', 400);
  return ticket;
}

export async function POST(request: Request) {
  try {
    const store = requireDuelStore();
    const ticket = ticketFrom(request);
    const parsed = player.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new RoomError('Masukkan nama pemain.', 400);
    await checkAdmission(store, request);
    return Response.json(await store.queue(ticket, parsed.data.name), {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    const status = await requireDuelStore().ticket(ticketFrom(request));
    return Response.json(status ?? { status: 'expired' }, {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const status = await requireDuelStore().cancel(ticketFrom(request));
    return Response.json(status ?? { status: 'cancelled' }, {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}
