/** @jest-environment node */
import { GET } from '@/app/api/define/route';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

const ask = (qs: string, ip = '9.9.9.9') =>
  GET(
    new Request(`http://x/api/define?${qs}`, {
      headers: { 'x-forwarded-for': ip },
    }),
  );

const upstream = (data: unknown, status = 200) =>
  jest.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => data,
  })) as unknown as typeof fetch;

describe('/api/define', () => {
  it('rejects anything that is not a 5-letter word in a known language', async () => {
    for (const qs of [
      'word=ab&lang=en',
      'word=abcdef&lang=en',
      'word=rum4h&lang=id',
      'word=rumah&lang=fr',
      'lang=id',
      'word=../../&lang=id',
    ]) {
      expect((await ask(qs)).status).toBe(400);
    }
  });

  it('answers with plain-text definitions, cached for a long time', async () => {
    global.fetch = upstream([
      {
        meanings: [
          { partOfSpeech: 'noun', definitions: [{ definition: 'A fighter.' }] },
        ],
      },
    ]);
    const res = await ask('word=BOXER&lang=en');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      word: 'boxer',
      defLang: 'en',
      entries: [{ pos: 'noun', definitions: ['A fighter.'] }],
    });
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=604800/);
  });

  it('identifies itself to Wikimedia', async () => {
    const fetchMock = upstream({});
    global.fetch = fetchMock;
    await ask('word=rumah&lang=id', '8.8.8.1');
    const init = (fetchMock as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(
      /dexter-games/,
    );
  });

  it('never caches a failure, and caches "unknown word" only briefly', async () => {
    global.fetch = upstream({}, 429);
    const failed = await ask('word=boxer&lang=en', '8.8.8.2');
    expect((await failed.json()).failed).toBe(true);
    expect(failed.headers.get('cache-control')).toBe('no-store');

    global.fetch = upstream({}, 404);
    const unknown = await ask('word=boxer&lang=en', '8.8.8.3');
    expect(unknown.headers.get('cache-control')).toMatch(/max-age=300/);
  });

  it('slows down someone asking too often', async () => {
    global.fetch = upstream({}, 404);
    const codes: number[] = [];
    for (let i = 0; i < 45; i++)
      codes.push((await ask('word=boxer&lang=en', '7.7.7.7')).status);
    expect(codes.filter((c) => c === 200)).toHaveLength(40);
    expect(codes.at(-1)).toBe(429);
    expect((await ask('word=boxer&lang=en', '7.7.7.8')).status).toBe(200);
  });
});
