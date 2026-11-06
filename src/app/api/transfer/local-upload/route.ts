import { NextResponse } from 'next/server';
import { open, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebStream } from 'node:stream/web';

import { isAuthed } from '@/lib/session';
import { parsePathname } from '@/lib/transfer/naming';
import {
  assertRoom,
  ensureLocalDir,
  getDriver,
  localPath,
  TransferError,
} from '@/lib/transfer/store';

import { MAX_FILE_BYTES } from '@/constant/transfer';

/** Development stand-in for the Blob upload: streams the file to a local folder. */
export async function PUT(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  if (getDriver() !== 'local') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const pathname = new URL(req.url).searchParams.get('pathname') ?? '';
  if (!parsePathname(pathname) || !req.body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    await assertRoom(Number(req.headers.get('content-length')));
    await ensureLocalDir(pathname);

    let size = 0;
    const limit = new Transform({
      transform(chunk, _enc, done) {
        size += chunk.length;
        done(
          size > MAX_FILE_BYTES
            ? new TransferError('File terlalu besar', 413)
            : null,
          chunk,
        );
      },
    });

    // "wx": never overwrite an existing file, and never delete one we did not make
    const dest = localPath(pathname);
    let handle;
    try {
      handle = await open(dest, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new TransferError('File dengan nama itu sudah ada', 409);
      }
      throw err;
    }

    try {
      await pipeline(
        Readable.fromWeb(req.body as unknown as NodeWebStream),
        limit,
        handle.createWriteStream(),
      );
    } catch (err) {
      // remove only the partial file we created
      await rm(dest, { force: true });
      await rmdir(path.dirname(dest)).catch(() => undefined);
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof TransferError ? err.status : 500;
    const message =
      err instanceof TransferError ? err.message : 'Gagal menyimpan file';
    return NextResponse.json({ error: message }, { status });
  }
}
