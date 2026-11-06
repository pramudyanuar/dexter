import { NextResponse } from 'next/server';

import { isAuthed } from '@/lib/session';
import { parsePathname } from '@/lib/transfer/naming';
import { openFile, TransferError } from '@/lib/transfer/store';

// large files stream through this function, so give it time
export const maxDuration = 60;

/** `filename*` carries the real name, the plain one is an ASCII fallback. */
function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  const parsed = parsePathname(id);
  if (!parsed) {
    return NextResponse.json(
      { error: 'Nama file tidak valid' },
      { status: 400 },
    );
  }

  try {
    const file = await openFile(id);
    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 404 },
      );
    }
    return new Response(file.stream, {
      headers: {
        // always a download, never rendered: the content is whatever was uploaded
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': contentDisposition(parsed.name),
        'Content-Length': String(file.size),
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof TransferError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: 'Terjadi kesalahan di server' },
      { status: 500 },
    );
  }
}
