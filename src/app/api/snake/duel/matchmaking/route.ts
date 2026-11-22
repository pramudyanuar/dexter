import { z } from 'zod';

import { readJson } from '@/lib/read-json';
import {
  checkAdmission,
  duelFailure,
  duelName,
  NO_STORE,
} from '@/lib/snake-duel/http';
import { TOKEN_PATTERN } from '@/lib/snake-duel/protocol';
import {
  DUEL_UNAVAILABLE,
  DuelError,
  getDuelStore,
} from '@/lib/snake-duel/store';

const player = z.object({ name: duelName });

function ticketFrom(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const ticket = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!TOKEN_PATTERN.test(ticket))
    throw new DuelError('Tiket pencarian tidak valid.', 400);
  return ticket;
}

function requireStore() {
  const store = getDuelStore();
  if (!store) throw new DuelError(DUEL_UNAVAILABLE, 503);
  return store;
}

export async function POST(request: Request) {
  try {
    const store = requireStore();
    const ticket = ticketFrom(request);
    const parsed = player.safeParse(await readJson(request, 4096));
    if (!parsed.success) throw new DuelError('Masukkan nama pemain.', 400);
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
    const status = await requireStore().ticket(ticketFrom(request));
    return Response.json(status ?? { status: 'expired' }, {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const status = await requireStore().cancel(ticketFrom(request));
    return Response.json(status ?? { status: 'cancelled' }, {
      headers: NO_STORE,
    });
  } catch (error) {
    return duelFailure(error);
  }
}
