/** @jest-environment node */
import { getRoomStore } from '@/lib/rooms/store';
import { CHAT_KEEP } from '@/lib/rooms/types';

import { GET, POST } from '@/app/api/rooms/[code]/chat/route';
import { POST as roomPost } from '@/app/api/rooms/[code]/route';
import { POST as create } from '@/app/api/rooms/route';

const OLD = { ...process.env };
const realFetch = global.fetch;
let ip = 0;

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  (globalThis as { __rooms?: unknown }).__rooms = undefined;
  (globalThis as { __chats?: unknown }).__chats = undefined;
});
afterEach(() => {
  process.env = OLD;
  global.fetch = realFetch;
});

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const say = (code: string, token: string | null, text: unknown) =>
  POST(
    new Request(`http://x/api/rooms/${code}/chat`, {
      method: 'POST',
      headers: token ? { 'x-player-token': token } : {},
      body: JSON.stringify({ text }),
    }),
    ctx(code),
  );
const read = (code: string, after?: string) =>
  GET(
    new Request(
      `http://x/api/rooms/${code}/chat${after ? `?after=${after}` : ''}`,
    ),
    ctx(code),
  );

async function room() {
  const a = await (
    await create(
      new Request('http://x/api/rooms', {
        method: 'POST',
        headers: { 'x-forwarded-for': `10.1.0.${++ip}` },
        body: JSON.stringify({ game: 'connect4' }),
      }),
    )
  ).json();
  const b = await (
    await roomPost(
      new Request(`http://x/api/rooms/${a.code}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'join' }),
      }),
      ctx(a.code),
    )
  ).json();
  return { code: a.code as string, A: a.token as string, B: b.token as string };
}

describe('chat', () => {
  it('delivers lines in order, tagged with the sender seat', async () => {
    const { code, A, B } = await room();
    expect((await say(code, A, 'halo')).status).toBe(200);
    expect((await say(code, B, 'hai juga')).status).toBe(200);

    const { messages } = await (await read(code)).json();
    expect(messages.map((m: { text: string }) => m.text)).toEqual([
      'halo',
      'hai juga',
    ]);
    expect(messages.map((m: { seat: number }) => m.seat)).toEqual([0, 1]);
    // the secret never travels with a message
    expect(JSON.stringify(messages)).not.toContain(A);
  });

  it('returns only what is new after a known line', async () => {
    const { code, A } = await room();
    const first = (await (await say(code, A, 'satu')).json()).message;
    await say(code, A, 'dua');
    await say(code, A, 'tiga');

    const next = await (await read(code, first.id)).json();
    expect(next.messages.map((m: { text: string }) => m.text)).toEqual([
      'dua',
      'tiga',
    ]);
    const last = next.messages[1].id;
    expect((await (await read(code, last)).json()).messages).toEqual([]);
    // an unknown id (trimmed away) gets everything again
    expect((await (await read(code, 'nope')).json()).messages).toHaveLength(3);
  });

  it('only lets seated players talk', async () => {
    const { code } = await room();
    expect((await say(code, null, 'halo')).status).toBe(403);
    expect((await say(code, 'wrongtoken', 'halo')).status).toBe(403);
    expect((await say('ZZZZZ', 'x', 'halo')).status).toBe(404);
    expect((await (await read(code)).json()).messages).toEqual([]);
  });

  it('cleans up and limits the text, and refuses empty lines', async () => {
    const { code, A } = await room();
    expect((await say(code, A, '   ')).status).toBe(400);
    expect((await say(code, A, 42)).status).toBe(400);

    await say(code, A, '  satu\n\n  dua   tiga  ');
    await say(code, A, 'x'.repeat(500));
    const { messages } = await (await read(code)).json();
    expect(messages[0].text).toBe('satu dua tiga');
    expect(messages[1].text).toHaveLength(200);
  });

  it('slows down someone flooding the chat', async () => {
    const { code, A, B } = await room();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++)
      statuses.push((await say(code, A, `m${i}`)).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(8);
    expect(statuses.at(-1)).toBe(429);
    // the other player has their own allowance
    expect((await say(code, B, 'masih bisa')).status).toBe(200);
  });

  it('keeps only the latest lines', async () => {
    const { code } = await room();
    const store = getRoomStore()!;
    for (let i = 0; i < CHAT_KEEP + 5; i++) {
      await store.chatAdd(code, {
        id: `id${i}`,
        seat: 0,
        text: `m${i}`,
        at: i,
      });
    }
    const lines = await store.chatList(code);
    expect(lines).toHaveLength(CHAT_KEEP);
    expect(lines[0].text).toBe('m5');
  });

  it('works against Redis too (list commands)', async () => {
    process.env = {
      ...process.env,
      UPSTASH_REDIS_REST_URL: 'https://redis.test',
      UPSTASH_REDIS_REST_TOKEN: 'secret',
    };
    const calls: unknown[][] = [];
    const list: string[] = [];
    global.fetch = (async (_url: string, init: RequestInit) => {
      const args = JSON.parse(init.body as string) as (string | number)[];
      calls.push(args);
      if (args[0] === 'RPUSH') list.push(args[2] as string);
      if (args[0] === 'LTRIM')
        list.splice(0, Math.max(0, list.length - CHAT_KEEP));
      if (args[0] === 'LRANGE') return Response.json({ result: list });
      return Response.json({ result: 'OK' });
    }) as typeof fetch;

    const store = getRoomStore()!;
    await store.chatAdd('ABCDE', { id: 'a', seat: 1, text: 'hi', at: 1 });
    expect(calls.map((c) => c[0])).toEqual(['RPUSH', 'LTRIM', 'EXPIRE']);
    expect(calls[0][1]).toBe('room:ABCDE:chat');
    expect(await store.chatList('ABCDE')).toEqual([
      { id: 'a', seat: 1, text: 'hi', at: 1 },
    ]);
  });
});
