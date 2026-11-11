import { NextResponse } from 'next/server';

import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/codes';
import { chatPolicy, seatOf } from '@/lib/rooms/engine';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { getRoomStore } from '@/lib/rooms/store';
import { CHAT_MAX_LENGTH, ChatMsg } from '@/lib/rooms/types';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Upstash Redis ke project ini (lihat .env.example).';

/** A few lines every ten seconds per player is plenty for a chat. */
const limiter = createLimiter(8, 10_000);

type Context = { params: Promise<{ code: string }> };

const bad = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/** New lines after the one the client already has (or everything, if unknown). */
export async function GET(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store) return bad(NO_STORE_ERROR, 503);

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) return bad('Kode room tidak valid', 400);

  try {
    const all = await store.chatList(code);
    // some games keep parts of the chat private (werewolves at night, the dead)
    const room = await store.get(code);
    const seat = room ? seatOf(room, req.headers.get('x-player-token')) : null;
    const policy = room
      ? chatPolicy(room, seat)
      : { send: null, read: ['all'] };
    const lines = all.filter((l) => policy.read.includes(l.channel ?? 'all'));
    const after = new URL(req.url).searchParams.get('after');
    // "after" may name a line this reader cannot see: look in the full list
    const known = after ? all.findIndex((l) => l.id === after) : -1;
    const fresh =
      known === -1
        ? lines
        : all
            .slice(known + 1)
            .filter((l) => policy.read.includes(l.channel ?? 'all'));
    return NextResponse.json(
      { messages: fresh, channel: policy.send },
      { headers: NO_STORE },
    );
  } catch {
    return bad('Terjadi kesalahan di server', 500);
  }
}

export async function POST(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store) return bad(NO_STORE_ERROR, 503);

  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) return bad('Kode room tidak valid', 400);

  const body = await req.json().catch(() => null);
  const text =
    typeof body?.text === 'string'
      ? body.text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH)
      : '';
  if (!text) return bad('Pesan kosong', 400);

  try {
    const room = await store.get(code);
    if (!room) return bad('Room tidak ditemukan atau sudah kedaluwarsa', 404);

    // only people sitting at the table can talk
    const seat = seatOf(room, req.headers.get('x-player-token'));
    if (seat === null) return bad('Kamu bukan pemain di room ini', 403);

    // some games say who may talk, and where
    const policy = chatPolicy(room, seat);
    if (!policy.send) return bad('Kamu tidak bisa mengobrol sekarang', 403);

    if (!limiter.allow(`${code}:${seat}`))
      return bad('Terlalu cepat, tunggu sebentar', 429);

    // the same line twice in a row is spam
    const recent = (await store.chatList(code)).slice(-6);
    if (
      recent.some(
        (l) => l.seat === seat && l.text === text && Date.now() - l.at < 8000,
      )
    ) {
      return bad('Pesan yang sama baru saja dikirim', 429);
    }

    const message: ChatMsg = {
      // time first so ids sort by arrival; the suffix keeps simultaneous lines apart
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      seat,
      text,
      at: Date.now(),
      ...(policy.send === 'all' ? {} : { channel: policy.send }),
    };
    await store.chatAdd(code, message);
    return NextResponse.json({ message }, { headers: NO_STORE });
  } catch {
    return bad('Terjadi kesalahan di server', 500);
  }
}
