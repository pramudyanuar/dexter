import { NextResponse } from 'next/server';

import { CODE_PATTERN, newToken, normalizeCode } from '@/lib/rooms/codes';
import {
  act,
  join,
  kick,
  leaveRoom,
  rematch,
  rename,
  revive,
  seatOf,
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
    let room = await store.get(code);
    if (!room) return notFound();
    const token = req.headers.get('x-player-token');

    // Time passes even when nobody acts. A player who left and did not come
    // back, or one sitting on their turn, is dealt with here, by whichever
    // poll notices first. Nothing is written unless something changed.
    const seat = seatOf(room, token);
    let next = sweep(room, Date.now(), cryptoRng());
    // whoever is asking is obviously here, so they are no longer "leaving"
    if (seat !== null) next = revive(next, seat);
    if (next !== room) {
      room = (await store.saveIf(next, room.version))
        ? next
        : ((await store.get(code)) ?? room);
    }

    const known = Number(new URL(req.url).searchParams.get('v'));
    if (known === room.version) {
      return NextResponse.json(
        { changed: false, version: room.version },
        { headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { changed: true, room: toView(room, token) },
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
        const joined = join(room, body.token, newToken(), undefined, body.name);
        if (joined.room !== room) {
          await store.save(joined.room);
          // two people joining at once: only the one that really got the seat stays
          const check = await store.get(code);
          if (!check || seatOf(check, joined.token) === null) {
            throw new RoomError('Room sudah penuh', 409);
          }
        }
        return NextResponse.json(
          {
            token: joined.token,
            you: joined.you,
            room: toView(joined.room, joined.token),
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
        const next = await mutate(store, room, (r) =>
          act(r, body.token, body.move, cryptoRng()),
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
