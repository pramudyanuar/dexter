/** @jest-environment node */
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createSession } from '@/lib/session';

import { GET as download } from '@/app/api/transfer/download/route';
import { PUT as localUpload } from '@/app/api/transfer/local-upload/route';
import { DELETE, GET as list } from '@/app/api/transfer/route';

let dir: string;
const OLD = { ...process.env };
let cookie: string;

const req = (url: string, init: RequestInit = {}, authed = true) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: { ...(authed ? { cookie } : {}), ...(init.headers ?? {}) },
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'transfer-routes-'));
  process.env = {
    ...OLD,
    TRANSFER_LOCAL_DIR: dir,
    CHAT_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  };
  delete process.env.BLOB_READ_WRITE_TOKEN;
  cookie = `dexter_session=${createSession()}`;
});

afterEach(async () => {
  process.env = OLD;
  await rm(dir, { recursive: true, force: true });
});

describe('authentication', () => {
  it('turns every transfer route away without a session', async () => {
    const id = encodeURIComponent('transfer/aaaaaaaa1111/a.txt');
    expect((await list(req('/api/transfer', {}, false))).status).toBe(401);
    expect(
      (await DELETE(req(`/api/transfer?id=${id}`, { method: 'DELETE' }, false)))
        .status,
    ).toBe(401);
    expect(
      (await download(req(`/api/transfer/download?id=${id}`, {}, false)))
        .status,
    ).toBe(401);
    expect(
      (
        await localUpload(
          req(
            `/api/transfer/local-upload?pathname=${id}`,
            { method: 'PUT', body: 'x' },
            false,
          ),
        )
      ).status,
    ).toBe(401);
  });
});

describe('upload, list, download, delete', () => {
  const pathname = 'transfer/abcdef123456/hello world.txt';
  const content = 'isi file untuk device lain';

  async function upload(name = pathname, body: BodyInit = content) {
    return localUpload(
      req(`/api/transfer/local-upload?pathname=${encodeURIComponent(name)}`, {
        method: 'PUT',
        body,
        headers: {
          'content-length': String(Buffer.byteLength(body as string)),
        },
      }),
    );
  }

  it('round-trips a file through the API', async () => {
    expect((await upload()).status).toBe(200);

    const listed = await (await list(req('/api/transfer'))).json();
    expect(listed.driver).toBe('local');
    expect(listed.files).toHaveLength(1);
    expect(listed.files[0]).toMatchObject({
      id: pathname,
      name: 'hello world.txt',
      size: Buffer.byteLength(content),
    });
    expect(listed.used).toBe(Buffer.byteLength(content));
    expect(listed.files[0].expiresAt).toBeGreaterThan(
      listed.files[0].uploadedAt,
    );

    const res = await download(
      req(`/api/transfer/download?id=${encodeURIComponent(pathname)}`),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(content);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('content-disposition')).toContain(
      "filename*=UTF-8''hello%20world.txt",
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');

    expect(
      (
        await DELETE(
          req(`/api/transfer?id=${encodeURIComponent(pathname)}`, {
            method: 'DELETE',
          }),
        )
      ).status,
    ).toBe(200);
    expect((await (await list(req('/api/transfer'))).json()).files).toEqual([]);
  });

  it('refuses to overwrite an existing file', async () => {
    expect((await upload()).status).toBe(200);
    const again = await upload(pathname, 'different');
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/sudah ada/);
    const res = await download(
      req(`/api/transfer/download?id=${encodeURIComponent(pathname)}`),
    );
    expect(await res.text()).toBe(content);
  });

  it('rejects path traversal and malformed ids everywhere', async () => {
    const evil = encodeURIComponent(
      'transfer/abcdef123456/../../../etc/passwd',
    );
    expect(
      (await download(req(`/api/transfer/download?id=${evil}`))).status,
    ).toBe(400);
    expect(
      (await DELETE(req(`/api/transfer?id=${evil}`, { method: 'DELETE' })))
        .status,
    ).toBe(400);
    expect(
      (
        await localUpload(
          req(`/api/transfer/local-upload?pathname=${evil}`, {
            method: 'PUT',
            body: 'x',
          }),
        )
      ).status,
    ).toBe(400);
    expect((await download(req('/api/transfer/download'))).status).toBe(400);
  });

  it('answers 404 for a file that does not exist', async () => {
    const id = encodeURIComponent('transfer/abcdef123456/missing.txt');
    expect(
      (await download(req(`/api/transfer/download?id=${id}`))).status,
    ).toBe(404);
  });

  it('drops files after 24 hours when listing', async () => {
    expect((await upload()).status).toBe(200);
    const file = path.join(dir, ...pathname.split('/'));
    const past = new Date(Date.now() - 25 * 3_600_000);
    await utimes(file, past, past);
    expect((await (await list(req('/api/transfer'))).json()).files).toEqual([]);
  });

  it('cannot reach the local upload route when Blob is configured', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x_y';
    const res = await localUpload(
      req(
        `/api/transfer/local-upload?pathname=${encodeURIComponent(pathname)}`,
        { method: 'PUT', body: 'x' },
      ),
    );
    expect(res.status).toBe(404);
  });
});

it('keeps unrelated files in the data folder out of the list', async () => {
  await mkdir(path.join(dir, 'transfer', 'not valid id!'), { recursive: true });
  await writeFile(path.join(dir, 'transfer', 'not valid id!', 'x'), 'x');
  expect((await (await list(req('/api/transfer'))).json()).files).toEqual([]);
});
