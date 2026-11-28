import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import {
  MAX_FILE_BYTES,
  QUOTA_BYTES,
  SUPABASE_DEFAULT_MAX_FILE_BYTES,
  TRANSFER_TTL_MS,
} from '@/features/transfer/config';
import { FILE_PREFIX, parsePathname } from '@/features/transfer/naming';
import {
  listSupabaseFiles,
  openSupabaseFile,
  removeSupabaseFiles,
  signSupabaseUpload,
} from '@/features/transfer/supabase';
import { getSupabaseState } from '@/integrations/supabase/state';

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

export type Driver = 'supabase' | 'local';

export function getDriver(): Driver | null {
  if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
    return 'supabase';
  return process.env.NODE_ENV === 'production' ? null : 'local';
}

export function maxFileBytes() {
  if (getDriver() !== 'supabase') return MAX_FILE_BYTES;
  const configured = Number(process.env.SUPABASE_TRANSFER_MAX_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, MAX_FILE_BYTES)
    : SUPABASE_DEFAULT_MAX_FILE_BYTES;
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

export function requireDriver(): Driver {
  const driver = getDriver();
  if (!driver) {
    throw new TransferError(
      'Penyimpanan file belum diatur. Hubungkan Supabase Storage ke project ini.',
      503,
    );
  }
  return driver;
}

export async function removeFile(pathname: string): Promise<void> {
  if (!parsePathname(pathname))
    throw new TransferError('Nama file tidak valid');
  if (requireDriver() === 'supabase') {
    await removeSupabaseFiles([pathname]);
  } else {
    await rm(path.dirname(localPath(pathname)), {
      recursive: true,
      force: true,
    });
  }
}

/** Files that are still within their lifetime, newest first. Expired ones are deleted. */
export async function listFresh(now = Date.now()): Promise<StoredFile[]> {
  const cloud = requireDriver() === 'supabase';
  const all = cloud ? await listSupabaseFiles() : await listLocal();
  const fresh: StoredFile[] = [];
  const expired: StoredFile[] = [];
  for (const file of all) {
    (now - file.uploadedAt >= TRANSFER_TTL_MS ? expired : fresh).push(file);
  }

  // cleanup is best effort: a failure must not hide the files that are fine
  if (cloud)
    await removeSupabaseFiles(expired.map(({ id }) => id)).catch(
      () => undefined,
    );
  else await Promise.allSettled(expired.map((file) => removeFile(file.id)));
  return fresh.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export const totalBytes = (files: StoredFile[]) =>
  files.reduce((sum, f) => sum + f.size, 0);

function assertFileSize(size: number) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new TransferError('Ukuran file tidak valid');
  }
  const maximum = maxFileBytes();
  if (size > maximum) {
    throw new TransferError(
      `File terlalu besar (maks ${maximum === MAX_FILE_BYTES ? '200 MiB' : `${maximum / 1_000_000} MB`})`,
      413,
    );
  }
}

function assertQuota(used: number, incoming: number) {
  if (used + incoming > QUOTA_BYTES) {
    throw new TransferError(
      'Penyimpanan penuh. Hapus file lama atau tunggu sampai kedaluwarsa.',
      413,
    );
  }
}

export async function assertRoom(size: number): Promise<void> {
  assertFileSize(size);
  assertQuota(totalBytes(await listFresh()), size);
}

interface UploadReservation {
  id: string;
  size: number;
  expiresAt: number;
}

export async function prepareSupabaseUpload(pathname: string, size: number) {
  assertFileSize(size);
  const files = await listFresh();
  if (files.some(({ id }) => id === pathname)) {
    throw new TransferError('File dengan nama itu sudah ada', 409);
  }
  const used = totalBytes(files);
  assertQuota(used, size);

  const state = getSupabaseState('transfer');
  if (!state) throw new Error('Supabase Storage is not configured');
  const ticket = await signSupabaseUpload(pathname);
  const existingIds = new Set(files.map(({ id }) => id));
  const key = 'upload-reservations';
  await state.transact([key], async (tx) => {
    const now = Date.now();
    const all = (await tx.read<UploadReservation[]>(key))?.value ?? [];
    const pending = all.filter(
      (entry) => entry.expiresAt > now && entry.id !== pathname,
    );
    const reserved = pending.reduce(
      (sum, entry) => sum + (existingIds.has(entry.id) ? 0 : entry.size),
      0,
    );
    const prior = all.find(
      (entry) => entry.id === pathname && entry.expiresAt > now,
    );
    const claimedSize = Math.max(size, prior?.size ?? 0);
    assertQuota(used + reserved, claimedSize);
    // Signed upload tokens are valid for two hours. Keep the reservation for that window.
    const expiresAt = now + 2 * 60 * 60 * 1000;
    pending.push({ id: pathname, size: claimedSize, expiresAt });
    tx.set(key, pending, expiresAt);
  });
  return ticket;
}

export interface OpenedFile {
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
}

export async function openFile(pathname: string): Promise<OpenedFile | null> {
  if (!parsePathname(pathname))
    throw new TransferError('Nama file tidak valid');

  if (requireDriver() === 'supabase') return openSupabaseFile(pathname);

  const file = localPath(pathname);
  const info = await stat(file).catch(() => null);
  if (!info || Date.now() - info.mtimeMs >= TRANSFER_TTL_MS) return null;
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
