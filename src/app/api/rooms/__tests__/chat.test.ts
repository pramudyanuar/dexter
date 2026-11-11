/** @jest-environment node */
import { getRoomStore } from '@/lib/rooms/store';
import { CHAT_KEEP } from '@/lib/rooms/types';

import { GET, POST } from '@/app/api/rooms/[code]/chat/route';
import { GET as roomGet, POST as roomPost } from '@/app/api/rooms/[code]/route';
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

describe('chat in a game with private channels (Werewolf)', () => {
  const sendAs = (code: string, token: string, text: string) =>
    POST(
      new Request(`http://x/api/rooms/${code}/chat`, {
        method: 'POST',
        headers: { 'x-player-token': token },
        body: JSON.stringify({ text }),
      }),
      ctx(code),
    );
  const readAs = (code: string, token: string, after?: string) =>
    GET(
      new Request(
        `http://x/api/rooms/${code}/chat${after ? `?after=${after}` : ''}`,
        {
          headers: { 'x-player-token': token },
        },
      ),
      ctx(code),
    );
  const call = (code: string, body: unknown) =>
    roomPost(
      new Request(`http://x/api/rooms/${code}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
      ctx(code),
    );

  async function nightRoom() {
    const a = await (
      await create(
        new Request('http://x/api/rooms', {
          method: 'POST',
          headers: { 'x-forwarded-for': `10.2.0.${++ip}` },
          body: JSON.stringify({ game: 'werewolf' }),
        }),
      )
    ).json();
    const tokens: string[] = [a.token];
    for (let i = 1; i < 5; i++) {
      const j = await (await call(a.code, { action: 'join' })).json();
      tokens.push(j.token);
    }
    await call(a.code, { action: 'start', token: a.token });
    // the role reveal is quiet; end it by the room's own store clock
    const store = getRoomStore()!;
    const room = (await store.get(a.code))!;
    const state = room.state as { deadline: number; roles: string[] };
    state.deadline = Date.now() - 1;
    await store.save({ ...room, state, version: room.version + 1 });
    // a look at the room is all it takes for the moderator to move on
    await roomGet(
      new Request(`http://x/api/rooms/${a.code}`, {
        headers: { 'x-player-token': a.token },
      }),
      ctx(a.code),
    );
    const after = (await store.get(a.code))!;
    return {
      code: a.code as string,
      tokens,
      roles: (after.state as { roles: string[]; phase: string }).roles,
      phase: (after.state as { phase: string }).phase,
    };
  }

  it('lets only the werewolves talk at night, in their own channel', async () => {
    // find a room whose roles we can use (any deal has a wolf and a villager)
    const { code, tokens, roles } = await nightRoom();
    const wolf = roles.indexOf('werewolf');
    const villager = roles.indexOf('villager');
    expect((await sendAs(code, tokens[villager], 'hello?')).status).toBe(403);
    const pack = await sendAs(code, tokens[wolf], 'take the baker');
    expect(pack.status).toBe(200);
    expect((await pack.json()).message.channel).toBe('wolves');
  });

  it("shows the werewolves' lines to werewolves only", async () => {
    const { code, tokens, roles } = await nightRoom();
    const wolf = roles.indexOf('werewolf');
    const seer = roles.indexOf('seer');
    const villager = roles.indexOf('villager');
    await sendAs(code, tokens[wolf], 'take the baker');
    const wolfView = await (await readAs(code, tokens[wolf])).json();
    expect(wolfView.messages.map((m: { text: string }) => m.text)).toContain(
      'take the baker',
    );
    expect(wolfView.channel).toBe('wolves');
    for (const who of [seer, villager]) {
      const body = await (await readAs(code, tokens[who])).json();
      expect(JSON.stringify(body)).not.toContain('take the baker');
      expect(body.channel).toBeNull();
    }
    // someone who is not sitting at the table sees nothing private either
    const stranger = await (await readAs(code, 'nobody')).json();
    expect(JSON.stringify(stranger)).not.toContain('take the baker');
  });

  it('does not let the same line be sent twice in a row', async () => {
    const { code, tokens, roles } = await nightRoom();
    const wolf = roles.indexOf('werewolf');
    expect((await sendAs(code, tokens[wolf], 'again')).status).toBe(200);
    expect((await sendAs(code, tokens[wolf], 'again')).status).toBe(429);
  });
});
