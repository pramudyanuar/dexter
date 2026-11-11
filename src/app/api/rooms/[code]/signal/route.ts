import { NextResponse } from 'next/server';

import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/codes';
import { seatOf, voiceOf } from '@/lib/rooms/engine';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { getRoomStore } from '@/lib/rooms/store';
import { Signal, SIGNAL_MAX_BYTES } from '@/lib/rooms/types';

/**
 * Where two players set up a voice call. The audio itself goes straight
 * between their browsers (WebRTC); this only carries the offer, the answer and
 * the network candidates, and only between the two seats the game connects.
 */

const NO_STORE = { 'Cache-Control': 'no-store' };
const KINDS = ['hello', 'offer', 'answer', 'ice'] as const;

/** Candidates come in bursts; this is generous for a call and tight for abuse. */
const limiter = createLimiter(80, 10_000);

type Context = { params: Promise<{ code: string }> };

const bad = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/** What the room says about this player's call, and the messages meant for them. */
export async function GET(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store) return bad('Penyimpanan room belum diatur.', 503);
  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) return bad('Kode room tidak valid', 400);

  try {
    const room = await store.get(code);
    if (!room) return bad('Room tidak ditemukan', 404);
    const seat = seatOf(room, req.headers.get('x-player-token'));
    const voice = voiceOf(room, seat);
    if (seat === null || !voice)
      return NextResponse.json(
        { voice: null, signals: [] },
        { headers: NO_STORE },
      );

    const after = new URL(req.url).searchParams.get('after');
    const all = await store.signalList(code);
    const known = after ? all.findIndex((s) => s.id === after) : -1;
    const signals = all
      .slice(known + 1)
      .filter((s) => s.to === seat && s.from === voice.peer);
    return NextResponse.json(
      { voice, signals, last: all.at(-1)?.id ?? null },
      { headers: NO_STORE },
    );
  } catch {
    return bad('Terjadi kesalahan di server', 500);
  }
}

export async function POST(req: Request, { params }: Context) {
  const store = getRoomStore();
  if (!store) return bad('Penyimpanan room belum diatur.', 503);
  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) return bad('Kode room tidak valid', 400);

  const body = await req.json().catch(() => null);
  const kind = KINDS.find((k) => k === body?.kind);
  const data = typeof body?.data === 'string' ? body.data : '';
  if (!kind || data.length > SIGNAL_MAX_BYTES)
    return bad('Pesan tidak valid', 400);

  try {
    const room = await store.get(code);
    if (!room) return bad('Room tidak ditemukan', 404);
    const seat = seatOf(room, req.headers.get('x-player-token'));
    const voice = voiceOf(room, seat);
    // only the two seats the game connects may talk to each other
    if (seat === null || !voice)
      return bad('Tidak ada panggilan suara untukmu', 403);
    if (!limiter.allow(`${code}:${seat}`)) return bad('Terlalu cepat', 429);

    const signal: Signal = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      from: seat,
      to: voice.peer,
      kind,
      data,
      at: Date.now(),
    };
    await store.signalAdd(code, signal);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return bad('Terjadi kesalahan di server', 500);
  }
}
