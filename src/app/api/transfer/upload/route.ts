import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { isAuthed } from '@/lib/session';
import { parsePathname } from '@/lib/transfer/naming';
import { assertRoom, getDriver, TransferError } from '@/lib/transfer/store';

import { MAX_FILE_BYTES } from '@/constant/transfer';

/**
 * Hands the browser a short-lived token to upload straight to Vercel Blob.
 * The file itself never passes through this server, which is what gets around
 * the 4.5 MB request limit on Vercel functions.
 */
export async function POST(req: Request) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  if (getDriver() !== 'blob') {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN belum di-set' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!parsePathname(pathname)) {
          throw new TransferError('Nama file tidak valid');
        }
        let size = NaN;
        try {
          size = Number(JSON.parse(clientPayload ?? '{}').size);
        } catch {
          // handled below as an invalid size
        }
        await assertRoom(size);

        return {
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof TransferError ? err.status : 400;
    const message =
      err instanceof Error ? err.message : 'Gagal menyiapkan unggahan';
    return NextResponse.json({ error: message }, { status });
  }
}
