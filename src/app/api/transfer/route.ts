import { NextResponse } from 'next/server';

import { isAuthed } from '@/lib/session';
import { parsePathname } from '@/lib/transfer/naming';
import {
  getDriver,
  listFresh,
  removeFile,
  totalBytes,
  TransferError,
} from '@/lib/transfer/store';

import {
  MAX_FILE_BYTES,
  QUOTA_BYTES,
  TRANSFER_TTL_HOURS,
  TRANSFER_TTL_MS,
} from '@/constant/transfer';

const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(err: unknown) {
  if (err instanceof TransferError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: 'Terjadi kesalahan di server' },
    { status: 500 },
  );
}

export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }

  try {
    const files = await listFresh();
    return NextResponse.json(
      {
        driver: getDriver(),
        files: files.map((f) => ({
          ...f,
          expiresAt: f.uploadedAt + TRANSFER_TTL_MS,
        })),
        used: totalBytes(files),
        quota: QUOTA_BYTES,
        maxFile: MAX_FILE_BYTES,
        ttlHours: TRANSFER_TTL_HOURS,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!parsePathname(id)) {
    return NextResponse.json(
      { error: 'Nama file tidak valid' },
      { status: 400 },
    );
  }

  try {
    await removeFile(id);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return fail(err);
  }
}
