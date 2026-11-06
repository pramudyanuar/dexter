/** @jest-environment node */
import { createSession } from '@/lib/session';

import { POST } from '@/app/api/transfer/upload/route';

// no network: pretend the Blob store is empty
jest.mock('@vercel/blob', () => ({
  list: jest.fn().mockResolvedValue({ blobs: [], hasMore: false }),
  del: jest.fn(),
  get: jest.fn(),
}));

const OLD = { ...process.env };
let cookie: string;

beforeEach(() => {
  process.env = {
    ...OLD,
    CHAT_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_abcdef1234_secretsecretsecret',
  };
  cookie = `dexter_session=${createSession()}`;
});
afterEach(() => {
  process.env = OLD;
});

const call = (body: unknown, authed = true) =>
  POST(
    new Request('http://localhost/api/transfer/upload', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: authed ? { cookie } : {},
    }),
  );

const tokenRequest = (pathname: string, size: unknown) => ({
  type: 'blob.generate-client-token',
  payload: {
    pathname,
    multipart: false,
    clientPayload: JSON.stringify({ size }),
  },
});

describe('/api/transfer/upload (Blob client token)', () => {
  it('needs a session', async () => {
    expect(
      (await call(tokenRequest('transfer/abcdef123456/a.txt', 10), false))
        .status,
    ).toBe(401);
  });

  it('issues a client token for a valid pathname and size', async () => {
    const res = await call(tokenRequest('transfer/abcdef123456/a.txt', 1024));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.type).toBe('blob.generate-client-token');
    expect(json.clientToken).toEqual(expect.any(String));
  });

  it.each([
    ['a pathname outside transfer/', 'other/abcdef123456/a.txt', 10],
    ['path traversal', 'transfer/abcdef123456/../x', 10],
    ['a missing size', 'transfer/abcdef123456/a.txt', undefined],
    ['a zero size', 'transfer/abcdef123456/a.txt', 0],
    ['a file over the limit', 'transfer/abcdef123456/a.txt', 201 * 1024 * 1024],
    [
      'a size that would exceed the quota',
      'transfer/abcdef123456/a.txt',
      901 * 1024 * 1024,
    ],
  ])('refuses %s', async (_label, pathname, size) => {
    const res = await call(tokenRequest(pathname, size));
    expect([400, 413]).toContain(res.status);
    expect((await res.json()).error).toEqual(expect.any(String));
  });

  it('says so when the Blob store is not configured', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const res = await call(tokenRequest('transfer/abcdef123456/a.txt', 10));
    expect(res.status).toBe(503);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await POST(
      new Request('http://localhost/api/transfer/upload', {
        method: 'POST',
        body: 'nope',
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(400);
  });
});
