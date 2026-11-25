import { NextResponse } from 'next/server';

import { isAdminAuthed } from '@/lib/rooms/admin-auth';
import { CODE_PATTERN, newToken, normalizeCode } from '@/lib/rooms/codes';
import {
  join,
  kick,
  leaveRoom,
  rematch,
  rename,
  resolveMove,
  revive,
  seatOf,
  setOptions,
  start,
  sweep,
  toView,
} from '@/lib/rooms/engine';
import { mutate } from '@/lib/rooms/mutate';
import { cryptoRng } from '@/lib/rooms/rng';
import { getRoomStore } from '@/lib/rooms/store';
import { RoomError } from '@/lib/rooms/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Upstash Redis ke project ini (lihat .env.example).';

type Context = { params: Promise<{ code: string }> };

function fail(err: unknown) {
  if (err instanceof RoomError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: 'Terjadi kesalahan di server' },
    { status: 500 },
  );
}

const notFound = () =>
  NextResponse.json(
    { error: 'Room tidak ditemukan atau sudah kedaluwarsa' },
    { status: 404 },
  );

/**
 * Polled by every player. The player's token travels in a header so it stays
 * out of URLs and logs, and decides which view of the room they get.
 */
export async function GET(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store)
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode room tidak valid' },
      { status: 400 },
    );
  }

  try {
    const reqUrl = new URL(req.url);
    const spectate = reqUrl.searchParams.get('spectate') === '1';
    if (spectate && !isAdminAuthed(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let room = await store.get(code);
    if (!room) return notFound();
    const token = spectate ? null : req.headers.get('x-player-token');

    // Time passes even when nobody acts. A player who left and did not come
    // back, or one sitting on their turn, is dealt with here, by whichever
    // poll notices first. Nothing is written unless something changed.
    const seat = seatOf(room, token);
    let next = sweep(room, Date.now(), cryptoRng());
    // whoever is asking is obviously here, so they are no longer "leaving"
    if (seat !== null) next = revive(next, seat);
    if (next !== room) {
      const latest = (await store.saveIf(next, room.version))
        ? next
        : await store.get(code);
      if (!latest) return notFound();
      room = latest;
    }

    const known = Number(reqUrl.searchParams.get('v'));
    if (known === room.version) {
      return NextResponse.json(
        { changed: false, version: room.version },
        { headers: NO_STORE },
      );
    }
    const view = toView(room, token);
    return NextResponse.json(
      { changed: true, room: spectate ? { ...view, seat: -1 } : view },
      { headers: NO_STORE },
    );
  } catch (err) {
    return fail(err);
  }
}

/** Actions: join, start, move, rename, rematch. Everything but join needs the player's token. */
export async function POST(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store)
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json(
      { error: 'Kode room tidak valid' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const room = await store.get(code);
    if (!room) return notFound();

    switch (body.action) {
      case 'join': {
        const candidate = newToken();
        const rng = cryptoRng();
        const next = await mutate(store, room, (current) => {
          if (body.game !== undefined && body.game !== current.game) {
            throw new RoomError('Kode ini untuk game lain', 409);
          }
          return join(current, body.token, candidate, rng, body.name).room;
        });
        const existing = seatOf(next, body.token);
        const token = existing === null ? candidate : (body.token as string);
        return NextResponse.json(
          {
            token,
            you: existing ?? seatOf(next, candidate),
            room: toView(next, token),
          },
          { headers: NO_STORE },
        );
      }
      case 'start': {
        const next = await mutate(store, room, (r) =>
          start(r, body.token, cryptoRng()),
        );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      case 'options': {
        const next = await mutate(store, room, (r) =>
          setOptions(r, body.token, body.options),
        );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      case 'kick': {
        const next = await mutate(store, room, (r) =>
          kick(r, body.token, body.seat, cryptoRng()),
        );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      case 'leave': {
        // sent when "keluar" is pressed, and by the browser as the page closes
        await mutate(store, room, (r) => leaveRoom(r, body.token));
        return NextResponse.json({ ok: true }, { headers: NO_STORE });
      }
      case 'move': {
        let applied = false;
        const next = await mutate(store, room, (r) => {
          const result = resolveMove(r, body.token, body.move, cryptoRng());
          applied = result.applied;
          return result.room;
        });
        if (!applied)
          throw new RoomError(
            'Kondisi permainan sudah berubah. Coba lagi.',
            409,
          );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      case 'rename': {
        const next = await mutate(store, room, (r) =>
          rename(r, body.token, body.name),
        );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      case 'rematch': {
        const next = await mutate(store, room, (r) =>
          rematch(r, body.token, cryptoRng()),
        );
        return NextResponse.json(
          { room: toView(next, body.token) },
          { headers: NO_STORE },
        );
      }
      default:
        return NextResponse.json(
          { error: 'Aksi tidak dikenal' },
          { status: 400 },
        );
    }
  } catch (err) {
    return fail(err);
  }
}
