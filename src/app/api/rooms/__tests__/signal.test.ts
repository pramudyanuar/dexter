/** @jest-environment node */
import type { MonkeyView } from '@/lib/games/monkeys';

import { GET as roomGet, POST as roomPost } from '@/app/api/rooms/[code]/route';
import {
  GET as signalGet,
  POST as signalPost,
} from '@/app/api/rooms/[code]/signal/route';
import { POST as create } from '@/app/api/rooms/route';

const OLD = { ...process.env };
let ip = 0;

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  (globalThis as { __rooms?: unknown }).__rooms = undefined;
  (globalThis as { __signals?: unknown }).__signals = undefined;
});
afterEach(() => {
  process.env = OLD;
});

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const act = (code: string, body: unknown, token?: string) =>
  roomPost(
    new Request(`http://x/api/rooms/${code}`, {
      method: 'POST',
      body: JSON.stringify({ ...(body as object), token }),
    }),
    ctx(code),
  );
const send = (code: string, token: string | null, kind: string, data = '') =>
  signalPost(
    new Request(`http://x/api/rooms/${code}/signal`, {
      method: 'POST',
      headers: token ? { 'x-player-token': token } : {},
      body: JSON.stringify({ kind, data }),
    }),
    ctx(code),
  );
const poll = (code: string, token: string | null, after?: string) =>
  signalGet(
    new Request(
      `http://x/api/rooms/${code}/signal${after ? `?after=${after}` : ''}`,
      { headers: token ? { 'x-player-token': token } : {} },
    ),
    ctx(code),
  );

/** Three monkeys, roles fixed: seat 0 blind, 1 mute, 2 deaf. */
async function team(start = true) {
  const a = await (
    await create(
      new Request('http://x/api/rooms', {
        method: 'POST',
        headers: { 'x-forwarded-for': `10.2.0.${++ip}` },
        body: JSON.stringify({ game: 'monkeys' }),
      }),
    )
  ).json();
  const tokens = [a.token as string];
  for (let i = 0; i < 2; i++) {
    const j = await (await act(a.code, { action: 'join' })).json();
    tokens.push(j.token);
  }
  await act(
    a.code,
    {
      action: 'options',
      options: { roles: 'host', assign: ['blind', 'mute', 'deaf'] },
    },
    tokens[0],
  );
  if (start) await act(a.code, { action: 'start' }, tokens[0]);
  return { code: a.code as string, tokens };
}

describe('the voice call set-up', () => {
  it('only connects the Blind and Deaf Monkeys', async () => {
    const { code, tokens } = await team();
    const [blind, mute, deaf] = tokens;

    expect((await send(code, blind, 'hello')).status).toBe(200);
    expect((await send(code, mute, 'hello')).status).toBe(403);
    expect((await send(code, null, 'hello')).status).toBe(403);

    const forDeaf = await (await poll(code, deaf)).json();
    expect(forDeaf.voice).toEqual({ peer: 0, dir: 'send' });
    expect(forDeaf.signals.map((s: { kind: string }) => s.kind)).toEqual([
      'hello',
    ]);

    const forMute = await (await poll(code, mute)).json();
    expect(forMute.voice).toBeNull();
    expect(forMute.signals).toEqual([]);
    const forBlind = await (await poll(code, blind)).json();
    expect(forBlind.signals).toEqual([]);
  });

  it('carries an offer and an answer back and forth, and only what is new', async () => {
    const { code, tokens } = await team();
    const [blind, , deaf] = tokens;
    await send(code, blind, 'hello');
    await send(code, deaf, 'offer', '{"sdp":"x"}');
    const first = await (await poll(code, blind)).json();
    expect(first.signals).toHaveLength(1);
    expect(first.signals[0]).toMatchObject({
      kind: 'offer',
      from: 2,
      to: 0,
      data: '{"sdp":"x"}',
    });
    await send(code, blind, 'answer', '{"sdp":"y"}');
    const again = await (await poll(code, blind, first.signals[0].id)).json();
    expect(again.signals).toEqual([]);
    const forDeaf = await (await poll(code, deaf)).json();
    expect(forDeaf.signals.map((s: { kind: string }) => s.kind)).toEqual([
      'hello',
      'answer',
    ]);
  });

  it('is closed before the game starts, and to games without voice', async () => {
    const { code, tokens } = await team(false);
    expect((await send(code, tokens[0], 'hello')).status).toBe(403);
    const room = await (
      await create(
        new Request('http://x/api/rooms', {
          method: 'POST',
          headers: { 'x-forwarded-for': `10.2.0.${++ip}` },
          body: JSON.stringify({ game: 'connect4' }),
        }),
      )
    ).json();
    expect((await send(room.code, room.token, 'hello')).status).toBe(403);
  });

  it('refuses nonsense and oversized messages', async () => {
    const { code, tokens } = await team();
    expect((await send(code, tokens[0], 'launch')).status).toBe(400);
    expect((await send(code, tokens[0], 'ice', 'x'.repeat(9000))).status).toBe(
      400,
    );
  });
});

describe('the room as each monkey sees it', () => {
  it('sends each player only their own slice of the bomb', async () => {
    const { code, tokens } = await team();
    const views = await Promise.all(
      tokens.map(async (t) => {
        const res = await roomGet(
          new Request(`http://x/api/rooms/${code}`, {
            headers: { 'x-player-token': t },
          }),
          ctx(code),
        );
        const body = await res.json();
        return {
          raw: JSON.stringify(body),
          view: body.room.state as MonkeyView,
        };
      }),
    );
    expect(views.map((v) => v.view.role)).toEqual(['blind', 'mute', 'deaf']);
    expect(views[0].view.blind).toBeDefined();
    expect(views[0].view.manual).toBeUndefined();
    expect(views[0].view.deaf).toBeUndefined();
    expect(views[1].view.manual).toBeDefined();
    expect(views[1].view.blind).toBeUndefined();
    expect(views[1].view.deaf).toBeUndefined();
    expect(views[2].view.deaf).toBeDefined();
    expect(views[2].view.manual).toBeUndefined();
    expect(views[2].view.blind).toBeUndefined();
    // the Blind Monkey's whole response has no colour names in it
    expect(views[0].raw).not.toMatch(/"(colors|labels|lamp|plan|lit|dark)"/);
  });

  it('will not start with fewer than three', async () => {
    const a = await (
      await create(
        new Request('http://x/api/rooms', {
          method: 'POST',
          headers: { 'x-forwarded-for': `10.2.0.${++ip}` },
          body: JSON.stringify({ game: 'monkeys' }),
        }),
      )
    ).json();
    await act(a.code, { action: 'join' });
    const res = await act(a.code, { action: 'start' }, a.token);
    expect(res.status).toBe(409);
  });
});
