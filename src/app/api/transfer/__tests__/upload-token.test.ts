/** @jest-environment node */
import { POST } from '@/app/api/transfer/upload/route';
import { createSession } from '@/features/auth/session';
import { supabaseTestEnv } from '@/test/fixtures/supabase-state';

const OLD = { ...process.env };
let cookie: string;

beforeEach(() => {
  process.env = {
    ...OLD,
    ...supabaseTestEnv,
    CHAT_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    SUPABASE_TRANSFER_MAX_BYTES: '',
  };
  cookie = `dexter_session=${createSession()}`;
});
afterEach(() => {
  jest.restoreAllMocks();
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

describe('/api/transfer/upload', () => {
  it('needs a session', async () => {
    expect(
      (await call({ pathname: 'transfer/abcdef123456/a.txt', size: 10 }, false))
        .status,
    ).toBe(401);
  });

  it('signs a private object and preserves Unicode in the transfer name', async () => {
    const pathname = 'transfer/abcdef123456/catatan 日本.txt';
    const key = Buffer.from(pathname).toString('base64url');
    const request = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json({
          url: `/object/upload/sign/dexter-transfer/${key}?token=signature`,
        }),
      )
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json(true));

    const res = await call({ pathname, size: 1024 });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      signedUrl: `https://test.supabase.co/storage/v1/object/upload/sign/dexter-transfer/${key}?token=signature`,
      resumableUrl:
        'https://test.storage.supabase.co/storage/v1/upload/resumable/sign',
      token: 'signature',
      bucket: 'dexter-transfer',
      objectKey: key,
    });
    const [url, init] = request.mock.calls[1];
    expect(String(url)).toContain(`/object/upload/sign/dexter-transfer/${key}`);
    expect(new Headers(init?.headers).get('x-upsert')).not.toBe('true');
    expect(String(request.mock.calls[3][0])).toContain(
      '/rpc/dexter_commit_state',
    );
  });

  it.each([
    ['a pathname outside transfer/', 'other/abcdef123456/a.txt', 10],
    ['path traversal', 'transfer/abcdef123456/../x', 10],
    ['a missing size', 'transfer/abcdef123456/a.txt', undefined],
    ['a zero size', 'transfer/abcdef123456/a.txt', 0],
    [
      'a file over the default limit',
      'transfer/abcdef123456/a.txt',
      50_000_001,
    ],
  ])('refuses %s before contacting Storage', async (_label, pathname, size) => {
    const request = jest.spyOn(globalThis, 'fetch');
    const res = await call({ pathname, size });
    expect([400, 413]).toContain(res.status);
    expect((await res.json()).error).toEqual(expect.any(String));
    expect(request).not.toHaveBeenCalled();
  });

  it('checks stored bytes against the quota', async () => {
    const pathname = 'transfer/abcdef123456/a.txt';
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json([
        {
          name: Buffer.from(pathname).toString('base64url'),
          id: 'object-id',
          metadata: { size: 900 * 1024 * 1024 },
          created_at: new Date().toISOString(),
        },
      ]),
    );
    const res = await call({
      pathname: 'transfer/aaaaaa112233/b.txt',
      size: 1,
    });
    expect(res.status).toBe(413);
  });

  it('says so when Supabase Storage is not configured', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    expect(
      (await call({ pathname: 'transfer/abcdef123456/a.txt', size: 10 }))
        .status,
    ).toBe(503);
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
