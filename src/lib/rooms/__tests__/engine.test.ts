/** @jest-environment node */
import {
  act,
  cleanName,
  join,
  kick,
  newRoom,
  rematch,
  rename,
  seated,
  seatOf,
  start,
  toView,
} from '@/lib/rooms/engine';
import { GAMES, isGameId } from '@/lib/rooms/games';
import { Room, RoomError } from '@/lib/rooms/types';

const A = 'token-a';
const B = 'token-b';
const C = 'token-c';
const D = 'token-d';
const E = 'token-e';

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RoomError ? e.status : -1;
  }
  return 0;
};

const connect4 = (): Room =>
  join(newRoom('connect4', 'ABCDE', A), undefined, B).room;
const unoRoom = (tokens: string[]) =>
  tokens
    .slice(1)
    .reduce(
      (room, t) => join(room, undefined, t).room,
      newRoom('uno', 'ABCDE', tokens[0]),
    );

describe('the registry', () => {
  it('knows these games and nothing else', () => {
    expect(Object.keys(GAMES).sort()).toEqual([
      'battleship',
      'checkers',
      'chess',
      'connect4',
      'dice',
      'domino',
      'gomoku',
      'pictionary',
      'quiz',
      'suit',
      'uno',
      'unoflip',
      'unomercy',
    ]);
    expect(isGameId('uno')).toBe(true);
    for (const bad of [
      'poker',
      '',
      null,
      undefined,
      5,
      'toString',
      '__proto__',
      'constructor',
    ]) {
      expect(isGameId(bad)).toBe(false);
    }
  });
});

describe('a new room', () => {
  it('has one seat per player slot, with the creator in seat 0', () => {
    const room = newRoom('uno', 'ABCDE', A);
    expect(room.tokens).toEqual([A, ...Array(7).fill(null)]);
    expect(newRoom('suit', 'ABCDE', A).tokens).toEqual([A, null]);
    expect([room.status, room.state, room.version]).toEqual([
      'waiting',
      null,
      1,
    ]);
  });

  it('shows the creator the waiting room without leaking any token', () => {
    const view = toView(newRoom('connect4', 'ABCDE', A), A);
    expect(view).toMatchObject({
      seat: 0,
      status: 'waiting',
      capacity: 2,
      joined: [true, false],
      state: null,
    });
    expect(JSON.stringify(view)).not.toContain(A);
  });
});

describe('joining', () => {
  it('starts two-player games as soon as the second player arrives', () => {
    const { room, you } = join(newRoom('connect4', 'ABCDE', A), undefined, B);
    expect(you).toBe(1);
    expect(room.status).toBe('playing');
    expect(room.state).not.toBeNull();
    expect(room.version).toBe(3);
  });

  it('does not start Uno until the host says so', () => {
    const room = unoRoom([A, B, C]);
    expect([room.status, room.state, seated(room)]).toEqual([
      'waiting',
      null,
      3,
    ]);
    expect(room.tokens).toEqual([A, B, C, ...Array(5).fill(null)]);
  });

  it('gives a returning player their seat back without changing the room', () => {
    const room = connect4();
    expect(join(room, A, 'new').you).toBe(0);
    expect(join(room, B, 'new').you).toBe(1);
    expect(join(room, B, 'new').room).toBe(room);
  });

  it('turns away a newcomer when full or already started', () => {
    expect(errorOf(() => join(connect4(), 'stranger', 'new'))).toBe(409);
    const full = connect4(); // two seats, both taken
    expect(errorOf(() => join(full, undefined, E))).toBe(409);
    const started = start(unoRoom([A, B]), A);
    expect(errorOf(() => join(started, undefined, C))).toBe(409);
    // but someone already seated can come back to a started game
    expect(join(started, B, 'new').you).toBe(1);
  });

  it('identifies seats', () => {
    const room = connect4();
    expect([seatOf(room, A), seatOf(room, B), seatOf(room, 'x')]).toEqual([
      0,
      1,
      null,
    ]);
    expect([
      seatOf(room, ''),
      seatOf(room, undefined),
      seatOf(room, 5),
      seatOf(room, null),
    ]).toEqual([null, null, null, null]);
  });
});

describe('starting a game that waits for the host', () => {
  it('lets only the host start, and only with enough players', () => {
    const two = unoRoom([A, B]);
    expect(errorOf(() => start(two, B))).toBe(403);
    expect(errorOf(() => start(two, 'stranger'))).toBe(403);
    expect(errorOf(() => start(unoRoom([A]), A))).toBe(409);

    const started = start(two, A);
    expect(started.status).toBe('playing');
    expect(started.version).toBe(two.version + 1);
    // dealt for exactly the people who are seated
    expect((toView(started, A).state as { counts: number[] }).counts).toEqual([
      7, 7,
    ]);
  });

  it('deals for three and four players too', () => {
    expect(
      (toView(start(unoRoom([A, B, C]), A), A).state as { counts: number[] })
        .counts,
    ).toEqual([7, 7, 7]);
    expect(
      (toView(start(unoRoom([A, B, C, D]), A), A).state as { counts: number[] })
        .counts,
    ).toEqual([7, 7, 7, 7]);
  });

  it('cannot be started twice', () => {
    expect(errorOf(() => start(start(unoRoom([A, B]), A), A))).toBe(409);
  });
});

describe('acting', () => {
  it('bumps the version and keeps playing', () => {
    const room = connect4();
    const next = act(room, A, { col: 3 });
    expect([next.status, next.version]).toEqual(['playing', room.version + 1]);
  });

  it('is only for seated players, and only while a game is running', () => {
    expect(errorOf(() => act(connect4(), 'intruder', { col: 0 }))).toBe(403);
    expect(errorOf(() => act(connect4(), undefined, { col: 0 }))).toBe(403);
    expect(
      errorOf(() => act(newRoom('connect4', 'ABCDE', A), A, { col: 0 })),
    ).toBe(409);
    expect(errorOf(() => act(unoRoom([A, B]), A, { type: 'draw' }))).toBe(409); // not started
  });

  it("passes the game's own rule errors through", () => {
    expect(errorOf(() => act(connect4(), B, { col: 0 }))).toBe(409); // not B's turn
    expect(errorOf(() => act(connect4(), A, { col: 99 }))).toBe(400);
  });

  it('marks the room over when the game ends', () => {
    let room = connect4();
    for (const [token, col] of [
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
    ] as const) {
      room = act(room, token, { col });
    }
    expect(room.status).toBe('over');
    expect(errorOf(() => act(room, B, { col: 2 }))).toBe(409);
  });

  it('does not change the room it was given', () => {
    const room = connect4();
    const before = JSON.stringify(room);
    act(room, A, { col: 2 });
    expect(JSON.stringify(room)).toBe(before);
  });
});

describe('rematch', () => {
  const finished = () => {
    let room = connect4();
    for (const [token, col] of [
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
      [B, 1],
      [A, 0],
    ] as const) {
      room = act(room, token, { col });
    }
    return room;
  };

  it('restarts a finished game, and is idempotent', () => {
    const next = rematch(finished(), B);
    expect(next.status).toBe('playing');
    expect(rematch(next, A)).toBe(next); // a second click does nothing
    expect(rematch(connect4(), A)).toBeInstanceOf(Object);
  });

  it('is for players only', () => {
    expect(errorOf(() => rematch(finished(), 'intruder'))).toBe(403);
  });
});

describe('views', () => {
  it('never contain tokens, whoever is looking', () => {
    const room = start(unoRoom([A, B, C]), A);
    for (const viewer of [A, B, C, 'stranger', undefined]) {
      const json = JSON.stringify(toView(room, viewer));
      for (const token of [A, B, C]) expect(json).not.toContain(token);
    }
  });

  it('show each Uno player only their own cards', () => {
    const room = start(unoRoom([A, B, C]), A);
    const state = room.state as { hands: unknown[][] };
    const [handA, handB] = [0, 1].map((i) => JSON.stringify(state.hands[i]));
    const seenByA = JSON.stringify(toView(room, A));
    expect(seenByA).toContain(handA.slice(1, -1));
    // B's hand as a whole never appears in A's view, nor the stranger's
    expect(seenByA).not.toContain(handB);
    expect(
      (toView(room, 'stranger').state as { hand: unknown[] }).hand,
    ).toEqual([]);
    expect(toView(room, 'stranger').seat).toBeNull();
  });

  it('hide a Suit pick until both have chosen', () => {
    const room = act(join(newRoom('suit', 'ABCDE', A), undefined, B).room, A, {
      pick: 'batu',
    });
    expect(JSON.stringify(toView(room, B))).not.toContain('batu');
    expect(JSON.stringify(toView(room, 'stranger'))).not.toContain('batu');
    expect(JSON.stringify(toView(room, A))).toContain('batu');
  });
});

describe('player names', () => {
  it('cleans what players type', () => {
    expect(cleanName('  Eka   Nuar ')).toBe('Eka Nuar');
    expect(cleanName('a\u0000b\u200bc')).toBe('abc');
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(16));
    expect([cleanName('   '), cleanName(42), cleanName(undefined)]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('stores a name per seat and shows it to everyone', () => {
    let room = newRoom('uno', 'ABCDE', A, 0, 'Eka');
    room = join(room, undefined, B, undefined, 'Budi').room;
    room = join(room, undefined, C).room;
    const expected = ['Eka', 'Budi', ...Array(6).fill(null)];
    expect(toView(room, C).names).toEqual(expected);
    expect(toView(room).names).toEqual(expected);
  });

  it('lets a player rename only their own seat', () => {
    const room = join(newRoom('suit', 'ABCDE', A), undefined, B).room;
    const renamed = rename(room, B, ' Sari ');
    expect(renamed.names).toEqual([null, 'Sari']);
    expect(renamed.version).toBe(room.version + 1);
    expect(rename(renamed, B, 'Sari')).toBe(renamed);
    expect(errorOf(() => rename(room, 'stranger', 'x'))).toBe(403);
  });

  it('copes with rooms stored before names existed', () => {
    const { names: _, ...old } = connect4();
    expect(toView(old as Room, A).names).toEqual([null, null]);
    expect(rename(old as Room, A, 'Eka').names).toEqual(['Eka', null]);
  });
});

describe('host removes a waiting player', () => {
  const fill = (n: number) => {
    let room = newRoom('uno', 'ABCDE', 'host', 0, 'Host');
    const toks = ['host'];
    for (let i = 1; i < n; i++) {
      const t = `p${i}`;
      room = join(room, undefined, t, undefined, `P${i}`).room;
      toks.push(t);
    }
    return { room, toks };
  };

  it('frees the kicked seat and its name', () => {
    const { room } = fill(3);
    const next = kick(room, 'host', 1);
    expect(next.tokens).toEqual([
      'host',
      null,
      'p2',
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(next.names?.[1]).toBeNull();
    expect(next.version).toBe(room.version + 1);
    // the freed seat can be taken again
    expect(join(next, undefined, 'new').you).toBe(1);
  });

  it('only the host may kick, and not themselves or an empty/started seat', () => {
    const { room } = fill(2);
    expect(errorOf(() => kick(room, 'p1', 0))).toBe(403); // not host
    expect(errorOf(() => kick(room, 'host', 0))).toBe(400); // self
    expect(errorOf(() => kick(room, 'host', 9))).toBe(400); // no such seat
    expect(kick(room, 'host', 5)).toBe(room); // empty seat: no change
    const started = start(room, 'host');
    // in the middle of a game it takes the player out of the game instead
    expect(kick(started, 'host', 1).out?.[1]).toBe(true);
  });

  it('uno seats up to eight players', () => {
    expect(GAMES.uno.maxPlayers).toBe(8);
    expect(newRoom('uno', 'ABCDE', 'host').tokens).toHaveLength(8);
  });
});
