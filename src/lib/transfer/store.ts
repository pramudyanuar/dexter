import { del, get, list } from '@vercel/blob';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { FILE_PREFIX, parsePathname } from '@/lib/transfer/naming';

import {
  MAX_FILE_BYTES,
  QUOTA_BYTES,
  TRANSFER_TTL_MS,
} from '@/constant/transfer';

export interface StoredFile {
  /** Full pathname, e.g. transfer/abc123def456/notes.pdf */
  id: string;
  name: string;
  size: number;
  /** ms since epoch */
  uploadedAt: number;
}

/** A problem to show the user as-is, with the HTTP status to answer with. */
export class TransferError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type Driver = 'blob' | 'local';

/**
 * Vercel Blob when its token is set. Without it, files go to a local folder,
 * for development only: serverless hosts have no persistent disk.
 */
export function getDriver(): Driver | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  return process.env.NODE_ENV === 'production' ? null : 'local';
}

export const localRoot = () =>
  process.env.TRANSFER_LOCAL_DIR ?? path.join(process.cwd(), '.data');

/** On-disk location of a validated pathname. */
export function localPath(pathname: string) {
  if (!parsePathname(pathname))
    throw new TransferError('Nama file tidak valid');
  return path.join(
    /*turbopackIgnore: true*/ localRoot(),
    ...pathname.split('/'),
  );
}

async function listLocal(): Promise<StoredFile[]> {
  const root = path.join(/*turbopackIgnore: true*/ localRoot(), FILE_PREFIX);
  const files: StoredFile[] = [];
  const ids = await readdir(/*turbopackIgnore: true*/ root).catch(
    () => [] as string[],
  );

  for (const id of ids) {
    const names = await readdir(
      /*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ root, id),
    ).catch(() => [] as string[]);
    for (const name of names) {
      const pathname = `${FILE_PREFIX}${id}/${name}`;
      if (!parsePathname(pathname)) continue;
      const info = await stat(
        /*turbopackIgnore: true*/ path.join(
          /*turbopackIgnore: true*/ root,
          id,
          name,
        ),
      );
      files.push({
        id: pathname,
        name,
        size: info.size,
        uploadedAt: info.mtimeMs,
      });
    }
  }
  return files;
}

async function listBlob(): Promise<StoredFile[]> {
  const files: StoredFile[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: FILE_PREFIX, limit: 1000, cursor });
    for (const blob of page.blobs) {
      const parsed = parsePathname(blob.pathname);
      if (!parsed) continue;
      files.push({
        id: blob.pathname,
        name: parsed.name,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt).getTime(),
      });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return files;
}

export function requireDriver(): Driver {
  const driver = getDriver();
  if (!driver) {
    throw new TransferError(
      'BLOB_READ_WRITE_TOKEN belum di-set. Buat Blob store di dashboard Vercel dan hubungkan ke project ini.',
      503,
    );
  }
  return driver;
}

export async function removeFile(pathname: string): Promise<void> {
  if (!parsePathname(pathname))
    throw new TransferError('Nama file tidak valid');
  if (requireDriver() === 'blob') {
    await del(pathname);
  } else {
    await rm(path.dirname(localPath(pathname)), {
      recursive: true,
      force: true,
    });
  }
}

/** Files that are still within their lifetime, newest first. Expired ones are deleted. */
export async function listFresh(now = Date.now()): Promise<StoredFile[]> {
  const all = requireDriver() === 'blob' ? await listBlob() : await listLocal();
  const fresh: StoredFile[] = [];
  const expired: StoredFile[] = [];
  for (const file of all) {
    (now - file.uploadedAt >= TRANSFER_TTL_MS ? expired : fresh).push(file);
  }

  // cleanup is best effort: a failure must not hide the files that are fine
  await Promise.allSettled(expired.map((file) => removeFile(file.id)));
  return fresh.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export const totalBytes = (files: StoredFile[]) =>
  files.reduce((sum, f) => sum + f.size, 0);

/** Throws a TransferError if a file of `size` bytes may not be stored now. */
export async function assertRoom(size: number): Promise<void> {
  if (!Number.isFinite(size) || size <= 0) {
    throw new TransferError('Ukuran file tidak valid');
  }
  if (size > MAX_FILE_BYTES) {
    throw new TransferError(
      `File terlalu besar (maks ${MAX_FILE_BYTES / 1024 / 1024} MB)`,
      413,
    );
  }
  if (totalBytes(await listFresh()) + size > QUOTA_BYTES) {
    throw new TransferError(
      'Penyimpanan penuh. Hapus file lama atau tunggu sampai kedaluwarsa.',
      413,
    );
  }
}

export interface OpenedFile {
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
}

export async function openFile(pathname: string): Promise<OpenedFile | null> {
  if (!parsePathname(pathname))
    throw new TransferError('Nama file tidak valid');

  if (requireDriver() === 'blob') {
    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200) return null;
    return {
      stream: blob.stream,
      size: blob.blob.size,
      contentType: blob.blob.contentType,
    };
  }

  const file = localPath(pathname);
  const info = await stat(file).catch(() => null);
  if (!info) return null;
  return {
    stream: Readable.toWeb(
      createReadStream(file),
    ) as ReadableStream<Uint8Array>,
    size: info.size,
    contentType: 'application/octet-stream',
  };
}

export async function ensureLocalDir(pathname: string) {
  await mkdir(path.dirname(localPath(pathname)), { recursive: true });
}
