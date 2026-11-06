/** @jest-environment node */
import {
  mkdir,
  mkdtemp,
  rm,
  truncate,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  assertRoom,
  getDriver,
  listFresh,
  localPath,
  openFile,
  removeFile,
  TransferError,
} from '@/lib/transfer/store';

import {
  MAX_FILE_BYTES,
  QUOTA_BYTES,
  TRANSFER_TTL_MS,
} from '@/constant/transfer';

let dir: string;
const OLD = { ...process.env };

async function put(
  id: string,
  name: string,
  content: string | Buffer,
  ageMs = 0,
) {
  const file = localPath(`transfer/${id}/${name}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  const when = new Date(Date.now() - ageMs);
  await utimes(file, when, when);
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'transfer-'));
  process.env = { ...OLD, TRANSFER_LOCAL_DIR: dir };
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

afterEach(async () => {
  process.env = OLD;
  await rm(dir, { recursive: true, force: true });
});

describe('driver', () => {
  it('uses the local folder in development and nothing in production', () => {
    expect(getDriver()).toBe('local');
    process.env = { ...process.env, NODE_ENV: 'production' };
    expect(getDriver()).toBeNull();
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x_y';
    expect(getDriver()).toBe('blob');
  });

  it('explains how to fix a production deploy without a Blob store', async () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    await expect(listFresh()).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
    await expect(listFresh()).rejects.toMatchObject({ status: 503 });
  });
});

describe('listing', () => {
  it('lists files newest first with size and name', async () => {
    await put('aaaaaaaa1111', 'old.txt', 'hello', 60_000);
    await put('bbbbbbbb2222', 'new.txt', 'hello world');

    const files = await listFresh();
    expect(files.map((f) => f.name)).toEqual(['new.txt', 'old.txt']);
    expect(files[0]).toMatchObject({
      id: 'transfer/bbbbbbbb2222/new.txt',
      size: 11,
    });
  });

  it('is empty before anything was uploaded', async () => {
    expect(await listFresh()).toEqual([]);
  });

  it('deletes files past their lifetime and keeps the rest', async () => {
    await put('aaaaaaaa1111', 'expired.txt', 'x', TRANSFER_TTL_MS + 1000);
    await put('bbbbbbbb2222', 'fresh.txt', 'y', TRANSFER_TTL_MS - 60_000);

    expect((await listFresh()).map((f) => f.name)).toEqual(['fresh.txt']);
    // the expired one is really gone, not just hidden
    await expect(
      openFile('transfer/aaaaaaaa1111/expired.txt'),
    ).resolves.toBeNull();
  });
});

describe('open and remove', () => {
  it('streams back exactly what was stored', async () => {
    const payload = Buffer.from(
      Array.from({ length: 5000 }, (_, i) => i % 256),
    );
    await put('aaaaaaaa1111', 'data.bin', payload);

    const file = await openFile('transfer/aaaaaaaa1111/data.bin');
    expect(file?.size).toBe(5000);
    const chunks: Uint8Array[] = [];
    const reader = file!.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(Buffer.concat(chunks).equals(payload)).toBe(true);
  });

  it('returns null for a missing file and rejects invalid paths', async () => {
    expect(await openFile('transfer/aaaaaaaa1111/nope.txt')).toBeNull();
    await expect(openFile('transfer/../../etc/passwd')).rejects.toBeInstanceOf(
      TransferError,
    );
    await expect(removeFile('../../x')).rejects.toBeInstanceOf(TransferError);
  });

  it('removes the file and its folder', async () => {
    await put('aaaaaaaa1111', 'a.txt', 'a');
    await removeFile('transfer/aaaaaaaa1111/a.txt');
    expect(await listFresh()).toEqual([]);
  });
});

describe('assertRoom', () => {
  it('accepts a normal file', async () => {
    await expect(assertRoom(1024)).resolves.toBeUndefined();
  });

  it.each([0, -5, NaN, Infinity])(
    'rejects an invalid size %p',
    async (size) => {
      await expect(assertRoom(size)).rejects.toThrow('Ukuran file tidak valid');
    },
  );

  it('rejects a file over the per-file limit', async () => {
    await expect(assertRoom(MAX_FILE_BYTES + 1)).rejects.toMatchObject({
      status: 413,
    });
  });

  it('rejects a file that would exceed the quota', async () => {
    // sparse files report their full size without using the disk
    for (const id of [
      'aaaaaaaa1111',
      'bbbbbbbb2222',
      'cccccccc3333',
      'dddddddd4444',
    ]) {
      await put(id, 'big.bin', '');
      await truncate(localPath(`transfer/${id}/big.bin`), 190 * 1024 * 1024);
    }
    // 760 MB stored: 100 MB still fits, 150 MB does not
    await expect(assertRoom(100 * 1024 * 1024)).resolves.toBeUndefined();
    await expect(assertRoom(150 * 1024 * 1024)).rejects.toThrow(/penuh/);
    expect(QUOTA_BYTES).toBe(900 * 1024 * 1024);
  });
});
