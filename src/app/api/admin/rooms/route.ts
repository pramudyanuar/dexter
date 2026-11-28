import { NextResponse } from 'next/server';

import { AdminRoomSummary, summarizeRoom } from '@/features/rooms/admin';
import { isAdminAuthed } from '@/features/rooms/admin-auth';
import { getRoomStore } from '@/features/rooms/store';

const NO_STORE = { 'Cache-Control': 'no-store' };
const NO_STORE_ERROR =
  'Penyimpanan room belum diatur. Hubungkan Supabase ke project ini (lihat .env.example).';

export async function GET(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const codes = await store.listCodes();
  const loaded = await Promise.all(codes.map((c) => store.get(c)));
  const summaries: AdminRoomSummary[] = loaded
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(summarizeRoom)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  const byGame: Record<string, number> = {};
  let waiting = 0;
  let playing = 0;
  let over = 0;
  let totalPlayers = 0;

  for (const r of summaries) {
    if (r.status === 'waiting') waiting++;
    else if (r.status === 'playing') playing++;
    else over++;
    totalPlayers += r.activeCount;
    byGame[r.game] = (byGame[r.game] ?? 0) + 1;
  }

  return NextResponse.json(
    {
      summary: {
        total: summaries.length,
        waiting,
        playing,
        over,
        totalPlayers,
        byGame,
      },
      rooms: summaries,
    },
    { headers: NO_STORE },
  );
}

export async function DELETE(req: Request) {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = getRoomStore();
  if (!store) {
    return NextResponse.json({ error: NO_STORE_ERROR }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') === 'all' ? 'all' : 'cleanup';

  const codes = await store.listCodes();
  let deleted = 0;

  if (scope === 'all') {
    await Promise.all(codes.map((c) => store.delete(c)));
    deleted = codes.length;
  } else {
    const loaded = await Promise.all(codes.map((c) => store.get(c)));
    const targets = loaded
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(summarizeRoom)
      .filter((r) => r.activeCount === 0 || r.status === 'over')
      .map((r) => r.code);
    await Promise.all(targets.map((c) => store.delete(c)));
    deleted = targets.length;
  }

  return NextResponse.json({ scope, deleted }, { headers: NO_STORE });
}
