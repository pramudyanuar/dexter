import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';

import { readJson } from '@/lib/read-json';
import {
  BUG_DESCRIPTION_MAX,
  type BugSnapshot,
  ROOM_BUG_REPORT_ID,
} from '@/lib/rooms/bug-reports';
import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/codes';
import { seatOf, toView } from '@/lib/rooms/engine';
import { createLimiter } from '@/lib/rooms/rate-limit';
import { getRoomStore } from '@/lib/rooms/store';

const captures = createLimiter(5, 60_000);
const MAX_STATE_BYTES = 64 * 1024;
const headers = { 'Cache-Control': 'no-store' };
const bad = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = normalizeCode((await params).code);
  if (!CODE_PATTERN.test(code)) return bad('Kode room tidak valid.', 400);
  const token = req.headers.get('x-player-token');
  if (!token) return bad('Kamu harus menjadi pemain di room ini.', 403);
  const body = (await readJson(req, 16 * 1024)) as {
    action?: unknown;
    id?: unknown;
    description?: unknown;
  } | null;
  const store = getRoomStore();
  if (!store) return bad('Penyimpanan laporan belum tersedia.', 503);

  const owner = createHash('sha256').update(token).digest('hex');
  const draftKey = (id: string) => `${code}:${owner}:${id}`;

  try {
    if (body?.action === 'capture') {
      const room = await store.get(code);
      if (!room) return bad('Room sudah tidak tersedia.', 404);
      const seat = seatOf(room, token);
      if (seat === null)
        return bad('Kamu harus menjadi pemain di room ini.', 403);
      if (!captures.allow(owner))
        return bad('Tunggu sebentar sebelum membuka laporan lagi.', 429);

      const capturedAt = Date.now();
      const view = toView(room, token, capturedAt);
      const playerName = view.names[seat];
      const stateOmitted =
        Buffer.byteLength(JSON.stringify(view.state)) > MAX_STATE_BYTES;
      const snapshot: BugSnapshot = {
        capturedAt,
        browser: (req.headers.get('user-agent') ?? '').slice(0, 500),
        ...(playerName && { playerName }),
        room: {
          code: view.code,
          game: view.game,
          status: view.status,
          version: view.version,
          seat: view.seat,
          state: stateOmitted ? null : view.state,
          options: view.options,
          joined: view.joined,
          out: view.out,
          outWhy: view.outWhy,
          waiting: view.waiting,
          leaving: view.leaving,
          strikes: view.strikes,
          host: view.host,
        },
        stateOmitted,
      };
      const id = randomUUID();
      await store.saveBugDraft(draftKey(id), snapshot);
      return NextResponse.json({ id }, { headers });
    }

    if (
      body?.action !== 'submit' ||
      typeof body.id !== 'string' ||
      !ROOM_BUG_REPORT_ID.test(body.id)
    )
      return bad('Laporan tidak valid.', 400);
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    if (!description || description.length > BUG_DESCRIPTION_MAX)
      return bad(
        `Isi laporan dengan 1 sampai ${BUG_DESCRIPTION_MAX} karakter.`,
        400,
      );

    const key = draftKey(body.id);
    const snapshot = await store.getBugDraft(key);
    const expired = () =>
      bad('Catatan game kedaluwarsa. Ambil catatan baru lalu kirim lagi.', 404);
    if (!snapshot) return expired();
    if (snapshot !== 'submitted') {
      const saved = await store.submitBugReport(key, {
        ...snapshot,
        id: body.id,
        description,
        submittedAt: Date.now(),
      });
      if (!saved) return expired();
    }
    return NextResponse.json({ id: body.id }, { headers });
  } catch {
    return bad('Laporan gagal diproses. Coba lagi.', 500);
  }
}
