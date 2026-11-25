import { NextResponse } from 'next/server';

import { isAdminAuthed } from '@/lib/rooms/admin-auth';
import { getRoomStore } from '@/lib/rooms/store';

export async function GET(req: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isAdminAuthed(req))
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers },
    );

  const store = getRoomStore();
  if (!store)
    return NextResponse.json(
      { error: 'Penyimpanan laporan belum tersedia.' },
      { status: 503, headers },
    );

  try {
    return NextResponse.json(
      { reports: await store.listBugReports() },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: 'Gagal memuat laporan.' },
      { status: 500, headers },
    );
  }
}
