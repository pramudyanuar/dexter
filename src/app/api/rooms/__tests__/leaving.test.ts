/** @jest-environment node */
import { LEAVE_GRACE_MS } from '@/lib/rooms/types';

import { GET, POST as roomPost } from '@/app/api/rooms/[code]/route';
import { POST as create } from '@/app/api/rooms/route';

const OLD = { ...process.env };
let ip = 0;
let clock = 5_000_000;

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  for (const k of ['__rooms', '__chats']) {
    (globalThis as Record<string, unknown>)[k] = undefined;
  }
  clock = 5_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
});
afterEach(() => {
  process.env = OLD;
  jest.restoreAllMocks();
});

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const post = (code: string, body: unknown) =>
  roomPost(
    new Request(`http://x/api/rooms/${code}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    ctx(code),
  );
/** A poll, the way every player's page does it every second. */
const poll = async (code: string, token: string, v = 0) =>
  (
    await (
      await GET(
        new Request(`http://x/api/rooms/${code}?v=${v}`, {
          headers: { 'x-player-token': token },
        }),
        ctx(code),
      )
    ).json()
  ).room;

async function room(game = 'connect4', joiners = 1) {
  const a = await (
    await create(
      new Request('http://x/api/rooms', {
        method: 'POST',
        headers: { 'x-forwarded-for': `10.3.0.${++ip}` },
        body: JSON.stringify({ game }),
      }),
    )
  ).json();
  const tokens: string[] = [a.token];
  for (let i = 0; i < joiners; i++) {
    tokens.push((await (await post(a.code, { action: 'join' })).json()).token);
  }
  if (joiners > 1 || game === 'uno')
    await post(a.code, { action: 'start', token: a.token });
  return { code: a.code as string, tokens };
}

describe('leaving, with no one reporting it but the leaver', () => {
  it('is enough for the leaver to say it once, even without a token header (as a closing page does)', async () => {
    const { code, tokens } = await room();
    const res = await post(code, { action: 'leave', token: tokens[1] });
    expect(res.status).toBe(200);

    const v = await poll(code, tokens[0]);
    expect(v.leaving).toEqual([{ seat: 1, goneIn: 10 }]);
    expect(v.status).toBe('playing');
  });

  it('is acted on by the next poll once the grace is over, with nothing else running', async () => {
    const { code, tokens } = await room();
    await post(code, { action: 'leave', token: tokens[1] });

    clock += LEAVE_GRACE_MS - 1_000;
    expect((await poll(code, tokens[0])).status).toBe('playing');

    clock += 2_000;
    const v = await poll(code, tokens[0]);
    expect(v.status).toBe('over');
    expect(v.state.winner).toBe(0);
    expect(v.out).toEqual([false, true]);
    expect(v.outWhy).toEqual([null, 'left']);
  });

  it('is cancelled when the leaver comes back and polls', async () => {
    const { code, tokens } = await room();
    await post(code, { action: 'leave', token: tokens[1] });

    clock += 3_000;
    // a reloaded page asks for the room straight away
    const mine = await poll(code, tokens[1]);
    expect(mine.leaving).toEqual([]);

    clock += LEAVE_GRACE_MS * 3;
    const after = await poll(code, tokens[0]);
    expect(after.status).toBe('playing');
    expect(after.out).toEqual([false, false]);
  });

  it('frees the seat at once when someone leaves the waiting room', async () => {
    const a = await (
      await create(
        new Request('http://x/api/rooms', {
          method: 'POST',
          headers: { 'x-forwarded-for': `10.3.1.${++ip}` },
          body: JSON.stringify({ game: 'uno' }),
        }),
      )
    ).json();
    const b = await (await post(a.code, { action: 'join' })).json();
    const c = await (await post(a.code, { action: 'join' })).json();

    // the admin leaves: the next player takes over
    await post(a.code, { action: 'leave', token: a.token });
    const v = await poll(a.code, b.token);
    expect(v.joined.slice(0, 3)).toEqual([false, true, true]);
    expect(v.host).toBe(1);
    expect(v.hostNotice).toBeGreaterThan(0);

    // and the new admin can start the game, the old one cannot
    expect(
      (await post(a.code, { action: 'start', token: a.token })).status,
    ).toBe(403);
    expect(
      (await post(a.code, { action: 'start', token: b.token })).status,
    ).toBe(200);
    expect((await poll(a.code, c.token)).status).toBe('playing');
  });
});

describe('the admin removing a player in the middle of a game', () => {
  it('takes them out, and a two-player game goes to the admin', async () => {
    const { code, tokens } = await room();
    const res = await post(code, { action: 'kick', token: tokens[0], seat: 1 });
    expect(res.status).toBe(200);

    const v = await poll(code, tokens[0]);
    expect(v.status).toBe('over');
    expect(v.state.winner).toBe(0);
    expect(v.outWhy).toEqual([null, 'kicked']);

    const moved = await post(code, {
      action: 'move',
      token: tokens[1],
      move: { col: 0 },
    });
    expect(moved.status).toBe(403);
  });

  it('lets a bigger game go on, and tells the removed player', async () => {
    const { code, tokens } = await room('uno', 2);
    await post(code, { action: 'kick', token: tokens[0], seat: 2 });

    const others = await poll(code, tokens[1]);
    expect(others.status).toBe('playing');
    expect(others.out.slice(0, 3)).toEqual([false, false, true]);
    expect((await poll(code, tokens[2])).out[2]).toBe(true);
  });

  it('is refused for anyone but the admin, and for the admin on themselves', async () => {
    const { code, tokens } = await room('uno', 2);
    expect(
      (await post(code, { action: 'kick', token: tokens[1], seat: 2 })).status,
    ).toBe(403);
    expect(
      (await post(code, { action: 'kick', token: tokens[0], seat: 0 })).status,
    ).toBe(400);
    expect(
      (await post(code, { action: 'kick', token: 'nope', seat: 1 })).status,
    ).toBe(403);
  });

  it('passes the admin role on when the admin is the one who left a running game', async () => {
    const { code, tokens } = await room('uno', 2);
    await post(code, { action: 'leave', token: tokens[0] });
    clock += LEAVE_GRACE_MS + 1_000;
    const v = await poll(code, tokens[1]);
    expect(v.out[0]).toBe(true);
    expect(v.host).toBe(1);
    // and they can use the role
    expect(
      (await post(code, { action: 'kick', token: tokens[1], seat: 2 })).status,
    ).toBe(200);
  });
});

describe('missing turns, noticed by polls', () => {
  it('punishes a player who sits on their turn, without any other call', async () => {
    const { code, tokens } = await room();
    clock += 46_000;
    const v = await poll(code, tokens[1]);
    expect(v.strikes).toEqual([1, 0]);
    expect(v.state.moves).toBe(1);
    expect(v.state.turn).toBe(1);
    // asking again does not punish twice
    expect((await poll(code, tokens[0])).strikes).toEqual([1, 0]);
  });
});
