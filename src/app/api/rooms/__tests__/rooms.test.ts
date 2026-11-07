/** @jest-environment node */
import type { UnoView } from '@/lib/games/uno';

import { GET, POST } from '@/app/api/rooms/[code]/route';
import { POST as create } from '@/app/api/rooms/route';

const OLD = { ...process.env };
let ipCounter = 0;

beforeEach(() => {
  process.env = { ...OLD };
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  (globalThis as { __rooms?: unknown }).__rooms = undefined;
});
afterEach(() => {
  process.env = OLD;
});

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const post = (code: string, body: unknown) =>
  POST(
    new Request(`http://x/api/rooms/${code}`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    ctx(code),
  );
const poll = (code: string, v?: number, token?: string) =>
  GET(
    new Request(
      `http://x/api/rooms/${code}${v === undefined ? '' : `?v=${v}`}`,
      {
        headers: token ? { 'x-player-token': token } : {},
      },
    ),
    ctx(code),
  );
const make = (game: unknown = 'connect4', ip = `10.0.0.${++ipCounter}`) =>
  create(
    new Request('http://x/api/rooms', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: JSON.stringify({ game }),
    }),
  );
const move = (code: string, token: string, m: unknown) =>
  post(code, { action: 'move', token, move: m });

async function startedRoom(game = 'connect4') {
  const a = await (await make(game)).json();
  const b = await (await post(a.code, { action: 'join' })).json();
  return { code: a.code as string, A: a.token as string, B: b.token as string };
}

describe('creating', () => {
  it('returns a code and a secret for the host, without leaking secrets', async () => {
    const res = await make();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(json.you).toBe(0);
    expect(json.token).toMatch(/^[0-9a-f]{32}$/);
    expect(json.room).toMatchObject({
      game: 'connect4',
      status: 'waiting',
      seat: 0,
      capacity: 2,
    });
    expect(JSON.stringify(json.room)).not.toContain(json.token);
  });

  it.each([
    'connect4',
    'suit',
    'uno',
    'battleship',
    'gomoku',
    'checkers',
    'chess',
    'dice',
    'domino',
    'quiz',
    'pictionary',
  ])('can create a %s room', async (game) => {
    expect((await (await make(game)).json()).room.game).toBe(game);
  });

  it.each([null, '', 'poker', 5, '__proto__', 'toString'])(
    'refuses the game %p',
    async (game) => {
      expect((await make(game)).status).toBe(400);
    },
  );

  it('refuses a request without a game or with a body that is not JSON', async () => {
    const bare = (body?: string) =>
      create(
        new Request('http://x/api/rooms', {
          method: 'POST',
          headers: { 'x-forwarded-for': '198.51.100.1' },
          body,
        }),
      );
    expect((await bare()).status).toBe(400);
    expect((await bare('{}')).status).toBe(400);
    expect((await bare('nope')).status).toBe(400);
  });

  it('limits how many rooms one address can create', async () => {
    const results: number[] = [];
    for (let i = 0; i < 22; i++)
      results.push((await make('connect4', '203.0.113.9')).status);
    expect(results.filter((s) => s === 200)).toHaveLength(20);
    expect(results.slice(20)).toEqual([429, 429]);
  });

  it('says how to fix it when there is no storage in production', async () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    const res = await make();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Upstash/);
    expect((await poll('ABCDE')).status).toBe(503);
  });
});

describe('polling', () => {
  it('sends the room when it changed and a tiny answer when it did not', async () => {
    const { code, A } = await startedRoom();
    const full = await (await poll(code, 0, A)).json();
    expect(full.changed).toBe(true);
    expect(full.room.status).toBe('playing');
    expect(full.room.seat).toBe(0);

    const same = await (await poll(code, full.room.version, A)).json();
    expect(same).toEqual({ changed: false, version: full.room.version });
  });

  it('accepts a lowercase code and rejects bad or unknown ones', async () => {
    const { code } = await startedRoom();
    expect((await poll(code.toLowerCase(), 0)).status).toBe(200);
    expect((await poll('ABC', 0)).status).toBe(400);
    expect((await poll('ABCD0', 0)).status).toBe(400);
    expect((await poll('ZZZZZ', 0)).status).toBe(404);
  });

  it('tells a viewer without a valid token that they are not seated', async () => {
    const { code } = await startedRoom();
    expect((await (await poll(code, 0)).json()).room.seat).toBeNull();
    expect((await (await poll(code, 0, 'wrong')).json()).room.seat).toBeNull();
  });

  it('never puts a token in any response', async () => {
    const { code, A, B } = await startedRoom();
    for (const viewer of [A, B, undefined]) {
      const body = JSON.stringify(await (await poll(code, 0, viewer)).json());
      expect(body).not.toContain(A);
      expect(body).not.toContain(B);
    }
  });
});

describe('joining', () => {
  it('seats the second player, lets them rejoin, and refuses a third', async () => {
    const a = await (await make()).json();
    const first = await (await post(a.code, { action: 'join' })).json();
    expect(first.you).toBe(1);
    expect(first.room.status).toBe('playing');

    const back = await (
      await post(a.code, { action: 'join', token: first.token })
    ).json();
    expect([back.you, back.token]).toEqual([1, first.token]);
    const creator = await (
      await post(a.code, { action: 'join', token: a.token })
    ).json();
    expect(creator.you).toBe(0);

    expect((await post(a.code, { action: 'join' })).status).toBe(409);
  });

  it('never leaves the second seat unusable when two people join at once', async () => {
    const a = await (await make()).json();
    const [x, y] = await Promise.all([
      post(a.code, { action: 'join' }),
      post(a.code, { action: 'join' }),
    ]);
    const joined = [x, y].filter((r) => r.status === 200);
    expect(joined.length).toBeGreaterThanOrEqual(1);
    expect(
      [x, y].filter((r) => r.status !== 200).every((r) => r.status === 409),
    ).toBe(true);

    // the host opens; afterwards exactly one of the "successful" joiners can answer
    await move(a.code, a.token, { col: 0 });
    let answered = 0;
    for (const res of joined) {
      const { token } = await res.json();
      if ((await move(a.code, token, { col: 1 })).status === 200) answered++;
    }
    expect(answered).toBe(1);
  });
});

describe('connect4 through the API', () => {
  it('plays a full game to a win, and then a rematch', async () => {
    const { code, A, B } = await startedRoom();
    let last: { room: { status: string; state: { winner: number } } } | null =
      null;
    for (const [token, col] of [
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
    ] as const) {
      const res = await move(code, token, { col });
      expect(res.status).toBe(200);
      last = await res.json();
    }
    expect(last!.room.status).toBe('over');
    expect(last!.room.state.winner).toBe(0);
    expect((await move(code, B, { col: 2 })).status).toBe(409);

    const again = await (
      await post(code, { action: 'rematch', token: B })
    ).json();
    expect(again.room.status).toBe('playing');
    expect(again.room.state).toMatchObject({ moves: 0, turn: 1 }); // the other player opens
  });

  it('enforces turns, tokens, and valid columns', async () => {
    const { code, A, B } = await startedRoom();
    expect((await move(code, B, { col: 0 })).status).toBe(409);
    expect((await move(code, 'nope', { col: 0 })).status).toBe(403);
    expect(
      (await post(code, { action: 'move', move: { col: 0 } })).status,
    ).toBe(403);
    expect((await move(code, A, { col: 9 })).status).toBe(400);
    expect((await move(code, A, { col: '2' })).status).toBe(400);
    expect((await move(code, A, null)).status).toBe(400);
    expect((await move(code, A, { col: 2 })).status).toBe(200);
  });

  it('cannot be played before the opponent joins', async () => {
    const a = await (await make()).json();
    expect((await move(a.code, a.token, { col: 0 })).status).toBe(409);
  });

  it('shows each move to the other player on their next poll', async () => {
    const { code, A, B } = await startedRoom();
    const before = (await (await poll(code, 0, B)).json()).room.version;
    await move(code, A, { col: 4 });
    const seen = await (await poll(code, before, B)).json();
    expect(seen.changed).toBe(true);
    expect(seen.room.state.board[5][4]).toBe(1);
    expect(seen.room.state.turn).toBe(1);
  });
});

describe('suit through the API', () => {
  it('hides a pick from the opponent until both are in, then reveals both', async () => {
    const { code, A, B } = await startedRoom('suit');

    await move(code, A, { pick: 'batu' });
    const forB = await (await poll(code, 0, B)).json();
    expect(JSON.stringify(forB)).not.toContain('batu');
    expect(forB.room.state).toMatchObject({
      myPick: null,
      opponentPicked: true,
    });
    const forStranger = await (await poll(code, 0)).json();
    expect(JSON.stringify(forStranger)).not.toContain('batu');
    const forA = await (await poll(code, 0, A)).json();
    expect(forA.room.state.myPick).toBe('batu');

    expect((await move(code, A, { pick: 'kertas' })).status).toBe(409); // already picked
    const res = await (await move(code, B, { pick: 'gunting' })).json();
    expect(res.room.state.last).toEqual({
      picks: ['batu', 'gunting'],
      winner: 0,
    });
    expect(res.room.state.scores).toEqual([1, 0]);
  });

  it('plays a whole match and offers a rematch', async () => {
    const { code, A, B } = await startedRoom('suit');
    await move(code, A, { pick: 'batu' });
    await move(code, B, { pick: 'gunting' }); // A scores: 1-0
    await move(code, A, { pick: 'kertas' });
    const end = await (await move(code, B, { pick: 'gunting' })).json(); // B scores: 1-1
    expect(end.room.status).toBe('playing');
    expect(end.room.state.scores).toEqual([1, 1]);
    await move(code, A, { pick: 'batu' });
    const won = await (await move(code, B, { pick: 'gunting' })).json();
    expect(won.room.status).toBe('over');
    expect(won.room.state.winner).toBe(0);
    const again = await (
      await post(code, { action: 'rematch', token: A })
    ).json();
    expect(again.room.state).toMatchObject({
      scores: [0, 0],
      winner: null,
      round: 1,
    });
  });
});

describe('uno through the API', () => {
  async function unoRoom(players: number) {
    const host = await (await make('uno')).json();
    const tokens = [host.token as string];
    for (let i = 1; i < players; i++) {
      tokens.push(
        (await (await post(host.code, { action: 'join' })).json()).token,
      );
    }
    return { code: host.code as string, tokens };
  }

  it('waits in the lobby until the host starts it', async () => {
    const { code, tokens } = await unoRoom(3);
    const lobby = await (await poll(code, 0, tokens[0])).json();
    expect(lobby.room).toMatchObject({
      status: 'waiting',
      joined: [true, true, true, false],
      capacity: 4,
      minPlayers: 2,
      state: null,
    });

    expect(
      (await post(code, { action: 'start', token: tokens[1] })).status,
    ).toBe(403);
    expect((await post(code, { action: 'start' })).status).toBe(403);
    expect((await move(code, tokens[0], { type: 'draw' })).status).toBe(409); // not started

    const started = await (
      await post(code, { action: 'start', token: tokens[0] })
    ).json();
    expect(started.room.status).toBe('playing');
    expect(started.room.state.counts).toEqual([7, 7, 7]);
    expect(
      (await post(code, { action: 'start', token: tokens[0] })).status,
    ).toBe(409);
    expect((await post(code, { action: 'join' })).status).toBe(409); // closed once started
  });

  it('needs at least two players to start', async () => {
    const { code, tokens } = await unoRoom(1);
    const res = await post(code, { action: 'start', token: tokens[0] });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/minimal 2/);
  });

  it('gives every player only their own hand, through every endpoint', async () => {
    const { code, tokens } = await unoRoom(3);
    const started = await (
      await post(code, { action: 'start', token: tokens[0] })
    ).json();
    const hands = [] as UnoView['hand'][];
    for (const t of tokens) {
      const view = (await (await poll(code, 0, t)).json()).room
        .state as UnoView;
      expect(view.hand).toHaveLength(7);
      hands.push(view.hand);
      expect(Object.keys(view)).not.toEqual(
        expect.arrayContaining(['hands', 'draw', 'discard']),
      );
    }
    // each seat's cards appear in that seat's response and not in the others'
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        const theirs = JSON.stringify(
          (await (await poll(code, 0, tokens[j])).json()).room.state.hand,
        );
        expect(theirs).not.toBe(JSON.stringify(hands[i]));
      }
    }
    // the response to the host's own start call is the host's view too
    expect(started.room.state.hand).toEqual(hands[0]);
    // an unseated viewer sees no cards at all
    expect((await (await poll(code, 0)).json()).room.state.hand).toEqual([]);
  });

  it('lets the player whose turn it is act, and nobody else', async () => {
    const { code, tokens } = await unoRoom(2);
    await post(code, { action: 'start', token: tokens[0] });
    expect((await move(code, tokens[1], { type: 'draw' })).status).toBe(409);
    const res = await move(code, tokens[0], { type: 'draw' });
    expect(res.status).toBe(200);
    const room = (await res.json()).room;
    expect(room.state.counts[0]).toBe(8);
  });

  it('answers a bad move with a clear error and changes nothing', async () => {
    const { code, tokens } = await unoRoom(2);
    await post(code, { action: 'start', token: tokens[0] });
    const before = (await (await poll(code, 0, tokens[0])).json()).room.version;
    expect(
      (await move(code, tokens[0], { type: 'play', index: 99 })).status,
    ).toBe(400);
    expect((await move(code, tokens[0], { type: 'nonsense' })).status).toBe(
      400,
    );
    expect((await move(code, tokens[0], null)).status).toBe(400);
    expect(
      (await poll(code, before, tokens[0]).then((r) => r.json())).changed,
    ).toBe(false);
  });
});

describe('bad requests', () => {
  it('rejects non-JSON, non-objects, and unknown actions', async () => {
    const { code } = await startedRoom();
    expect((await post(code, 'not json')).status).toBe(400);
    expect((await post(code, 'null')).status).toBe(400);
    expect((await post(code, { action: 'explode' })).status).toBe(400);
    expect((await post('ZZZZZ', { action: 'join' })).status).toBe(404);
    expect((await post('bad', { action: 'join' })).status).toBe(400);
  });
});
