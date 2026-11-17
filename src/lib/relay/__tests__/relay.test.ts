/**
 * @jest-environment node
 */
import { createRelay } from '@/lib/relay/handler';

const TEST_SECRET = '12345678901234567890123456789012';
const BASE_ENV = {
  RELAY_API_KEY: TEST_SECRET,
  UPSTREAM_ORIGIN: 'https://upstream.example.com',
  UPSTREAM_API_KEY: 'sk-upstream-secret',
};

describe('v1 relay handler', () => {
  it('returns 503 when relay is not configured', async () => {
    const relay = createRelay({ env: {} });
    const res = await relay(new Request('http://localhost/v1/models'));
    expect(res.status).toBe(503);
  });

  it('returns 401 when token is missing or invalid', async () => {
    const relay = createRelay({ env: BASE_ENV });
    const res = await relay(new Request('http://localhost/v1/models'));
    expect(res.status).toBe(401);

    const bad = await relay(
      new Request('http://localhost/v1/models', {
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(bad.status).toBe(401);
  });

  it('returns 404 for unknown endpoints and 405 for disallowed methods', async () => {
    const relay = createRelay({ env: BASE_ENV });
    const notFound = await relay(
      new Request('http://localhost/v1/unknown', {
        headers: { authorization: `Bearer ${TEST_SECRET}` },
      }),
    );
    expect(notFound.status).toBe(404);

    const badMethod = await relay(
      new Request('http://localhost/v1/models', {
        method: 'POST',
        headers: { authorization: `Bearer ${TEST_SECRET}` },
      }),
    );
    expect(badMethod.status).toBe(405);
  });

  it('forwards allowed requests with upstream auth and stripped cookies', async () => {
    let seenUrl = '';
    let seenAuth = '';
    let seenCookie: string | null = null;

    const fakeFetch: typeof fetch = async (input, init) => {
      seenUrl = String(input);
      const h = new Headers(init?.headers);
      seenAuth = h.get('authorization') ?? '';
      seenCookie = h.get('cookie');
      return Response.json({ data: [{ id: 'gpt-4o' }] });
    };

    const relay = createRelay({ env: BASE_ENV, fetchImpl: fakeFetch });
    const res = await relay(
      new Request('http://localhost/v1/models', {
        headers: {
          authorization: `Bearer ${TEST_SECRET}`,
          cookie: 'session=secret',
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(seenUrl).toBe('https://upstream.example.com/v1/models');
    expect(seenAuth).toBe('Bearer sk-upstream-secret');
    expect(seenCookie).toBeNull();
    const json = await res.json();
    expect(json.data[0].id).toBe('gpt-4o');
  });
});
