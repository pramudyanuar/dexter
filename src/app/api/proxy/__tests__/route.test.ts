/** @jest-environment node */
import {
  createProxyToken,
  createSession,
  isAuthed,
  isProxyToken,
} from '@/lib/session';

import { GET } from '@/app/api/proxy/route';

const call = (query: string) =>
  GET(new Request(`http://localhost/api/proxy?${query}`));

beforeAll(() => {
  process.env.CHAT_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
});

describe('/api/proxy', () => {
  it('rejects requests without a valid token', async () => {
    expect((await call('url=https%3A%2F%2Fexample.com')).status).toBe(401);
    expect(
      (await call('t=9999999999.abc&url=https%3A%2F%2Fexample.com')).status,
    ).toBe(401);
  });

  it('says why POST forms are refused, without needing a token', async () => {
    const res = await call('__unsupported=1');
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('POST');
  });

  it('refuses internal addresses even with a valid token', async () => {
    const t = createProxyToken()!;
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/',
      'http://[::1]/',
      'file:///etc/passwd',
    ]) {
      const res = await call(`t=${t}&url=${encodeURIComponent(url)}`);
      expect([400, 403]).toContain(res.status);
    }
  });

  it('locks every response down with a CSP', async () => {
    const res = await call('__unsupported=1');
    expect(res.headers.get('content-security-policy')).toContain(
      "default-src 'none'",
    );
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
  });
});

describe('proxy tokens vs session cookies', () => {
  it('are not interchangeable', () => {
    const session = createSession()!;
    const proxy = createProxyToken()!;
    expect(isProxyToken(proxy)).toBe(true);
    expect(isProxyToken(session)).toBe(false);
    const asCookie = new Request('http://x', {
      headers: { cookie: `dexter_session=${proxy}` },
    });
    expect(isAuthed(asCookie)).toBe(false);
  });
});
