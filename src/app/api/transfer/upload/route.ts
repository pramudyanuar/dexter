import { NextResponse } from 'next/server';

import { readJson } from '@/lib/read-json';

import { isAuthed } from '@/features/auth/session';
import { parsePathname } from '@/features/transfer/naming';
import {
  getDriver,
  prepareSupabaseUpload,
  TransferError,
} from '@/features/transfer/store';

export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  if (getDriver() !== 'supabase') {
    return NextResponse.json(
      { error: 'Supabase Storage belum diatur' },
      { status: 503 },
    );
  }

  const body = (await readJson(req, 4096)) as {
    pathname?: unknown;
    size?: unknown;
  } | null;
  if (
    typeof body?.pathname !== 'string' ||
    !parsePathname(body.pathname) ||
    typeof body.size !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Nama atau ukuran file tidak valid' },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await prepareSupabaseUpload(body.pathname, body.size),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (err) {
    if (err instanceof TransferError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: 'Gagal menyiapkan unggahan' },
      { status: 503 },
    );
  }
}
