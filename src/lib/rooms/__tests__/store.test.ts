/** @jest-environment node */
import { newRoom as makeRoom } from '@/lib/rooms/engine';
import { getRoomStore } from '@/lib/rooms/store';

const newRoom = (code: string, token: string) =>
  makeRoom('connect4', code, token);

const OLD = { ...process.env };
const realFetch = global.fetch;

/** Just enough of Upstash's REST protocol: GET, and SET with NX / EX. */
function fakeUpstash() {
  const data = new Map<string, { value: string; ttl?: number }>();
  const calls: { url: string; auth: string | null; args: unknown[] }[] = [];

  global.fetch = (async (url: string, init: RequestInit) => {
    const args = JSON.parse(init.body as string) as (string | number)[];
    const auth = new Headers(init.headers).get('authorization');
    calls.push({ url, auth, args });
    if (auth !== 'Bearer secret') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    const [cmd, key, value, ...flags] = args as string[];
    if (cmd === 'GET') {
      return Response.json({ result: data.get(key)?.value ?? null });
    }
    if (cmd === 'SET') {
      if (flags.includes('NX') && data.has(key))
        return Response.json({ result: null });
      const ex = flags.indexOf('EX');
      data.set(key, {
        value,
        ttl: ex >= 0 ? Number(flags[ex + 1]) : undefined,
      });
      return Response.json({ result: 'OK' });
    }
    return Response.json({ error: `unknown command ${cmd}` }, { status: 400 });
  }) as typeof fetch;

  return { data, calls };
}

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  (globalThis as { __rooms?: unknown }).__rooms = undefined;
});

afterEach(() => {
  process.env = OLD;
  global.fetch = realFetch;
});

describe('choosing a store', () => {
  it('uses memory in development, nothing in production', () => {
    expect(getRoomStore()).not.toBeNull();
    process.env = { ...process.env, NODE_ENV: 'production' };
    expect(getRoomStore()).toBeNull();
  });

  it('uses Redis when either set of env names is present', () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://x',
      UPSTASH_REDIS_REST_TOKEN: 't',
    };
    expect(getRoomStore()).not.toBeNull();
    process.env = {
      ...process.env,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
      KV_REST_API_URL: 'https://x',
      KV_REST_API_TOKEN: 't',
    };
    expect(getRoomStore()).not.toBeNull();
  });
});

describe('memory store', () => {
  it('creates once per code, and returns copies', async () => {
    const store = getRoomStore()!;
    const room = newRoom('ABCDE', 'a');
    expect(await store.create(room)).toBe(true);
    expect(await store.create(newRoom('ABCDE', 'other'))).toBe(false);

    const loaded = (await store.get('ABCDE'))!;
    expect(loaded.tokens[0]).toBe('a');
    loaded.version = 99; // editing the copy must not touch what is stored
    expect((await store.get('ABCDE'))!.version).toBe(1);
    expect(await store.get('ZZZZZ')).toBeNull();
  });

  it('saves changes', async () => {
    const store = getRoomStore()!;
    await store.create(newRoom('ABCDE', 'a'));
    await store.save({ ...newRoom('ABCDE', 'a'), version: 5 });
    expect((await store.get('ABCDE'))!.version).toBe(5);
  });

  it('forgets rooms after their lifetime', async () => {
    const store = getRoomStore()!;
    await store.create(newRoom('ABCDE', 'a'));
    const spy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + 3 * 3600 * 1000);
    expect(await store.get('ABCDE')).toBeNull();
    spy.mockRestore();
  });
});

describe('redis store (against a fake Upstash)', () => {
  beforeEach(() => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    };
  });

  it('stores a room as JSON under room:CODE with a two hour expiry', async () => {
    const { data, calls } = fakeUpstash();
    const store = getRoomStore()!;

    expect(await store.create(newRoom('ABCDE', 'a'))).toBe(true);
    expect(calls[0]).toMatchObject({
      url: 'https://redis.test',
      auth: 'Bearer secret',
    });
    expect(calls[0].args.slice(0, 1)).toEqual(['SET']);
    expect(calls[0].args).toEqual(expect.arrayContaining(['NX', 'EX', 7200]));
    expect(data.get('room:ABCDE')?.ttl).toBe(7200);
    expect(JSON.parse(data.get('room:ABCDE')!.value).code).toBe('ABCDE');
  });

  it('refuses to overwrite on create, but save does overwrite', async () => {
    fakeUpstash();
    const store = getRoomStore()!;
    await store.create(newRoom('ABCDE', 'a'));
    expect(await store.create(newRoom('ABCDE', 'b'))).toBe(false);
    await store.save({ ...newRoom('ABCDE', 'a'), version: 3 });
    expect((await store.get('ABCDE'))!.version).toBe(3);
  });

  it('returns null for a missing room', async () => {
    fakeUpstash();
    expect(await getRoomStore()!.get('NOPE2')).toBeNull();
  });

  it('surfaces an error from Redis instead of pretending it worked', async () => {
    fakeUpstash();
    process.env.UPSTASH_REDIS_REST_TOKEN = 'wrong';
    await expect(getRoomStore()!.get('ABCDE')).rejects.toThrow(/Unauthorized/);
  });
});
