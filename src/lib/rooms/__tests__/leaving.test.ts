/** @jest-environment node */
import {
  act,
  eliminate,
  hostOf,
  join,
  kick,
  leaveRoom,
  newRoom,
  rematch,
  revive,
  start,
  sweep,
  toView,
} from '@/lib/rooms/engine';
import { LEAVE_GRACE_MS, MAX_STRIKES, Room } from '@/lib/rooms/types';

const T0 = 1_000_000;
const rng = () => 0.5;

/** A room of `game` with `n` players seated and the game running. */
function running(
  game: Parameters<typeof newRoom>[0],
  n: number,
  now = T0,
): Room {
  let room = newRoom(game, 'ABCDE', 't0', now);
  for (let i = 1; i < n; i++) {
    room = join(room, undefined, `t${i}`, rng, undefined, now).room;
  }
  if (room.status === 'waiting') room = start(room, 't0', rng, now);
  return room;
}

/** A room that is still waiting for the game to start. */
function waiting(game: Parameters<typeof newRoom>[0], n: number): Room {
  let room = newRoom(game, 'ABCDE', 't0', T0);
  for (let i = 1; i < n; i++) {
    room = join(room, undefined, `t${i}`, rng, undefined, T0).room;
  }
  return room;
}

const winner = (room: Room) => (room.state as { winner: number }).winner;

describe('pressing "keluar" in the middle of a game', () => {
  it('does not remove anyone at once, so an accidental click can be undone', () => {
    const room = running('connect4', 2);
    const left = leaveRoom(room, 't1', T0 + 1000);

    expect(left.status).toBe('playing');
    expect(left.out ?? []).not.toContain(true);
    expect(left.left).toEqual([null, T0 + 1000]);
    expect(left.version).toBe(room.version + 1);
    // saying it twice changes nothing
    expect(leaveRoom(left, 't1', T0 + 2000)).toBe(left);
  });

  it('removes them once the grace is over, handing a two-player game to the other', () => {
    const left = leaveRoom(running('connect4', 2), 't1', T0);

    expect(sweep(left, T0 + LEAVE_GRACE_MS - 1, rng)).toBe(left);
    const after = sweep(left, T0 + LEAVE_GRACE_MS + 1, rng);
    expect(after.status).toBe('over');
    expect(winner(after)).toBe(0);
    expect(after.out).toEqual([false, true]);
    expect(after.why).toEqual([null, 'left']);
  });

  it('lets a bigger game carry on without them', () => {
    const left = leaveRoom(running('uno', 3), 't1', T0);
    const after = sweep(left, T0 + LEAVE_GRACE_MS + 1, rng);

    expect(after.status).toBe('playing');
    expect(after.out!.slice(0, 3)).toEqual([false, true, false]);
    expect((after.state as { dropped: number[] }).dropped).toEqual([1]);
  });

  it('is cancelled by coming back: rejoining, playing, or just asking for the room', () => {
    const left = leaveRoom(running('connect4', 2), 't1', T0);

    const rejoined = join(left, 't1', 'unused', rng, undefined, T0 + 3000);
    expect(rejoined.you).toBe(1);
    expect(rejoined.room.left).toEqual([null, null]);
    expect(sweep(rejoined.room, T0 + 20_000)).toBe(rejoined.room);

    expect(revive(left, 1).left).toEqual([null, null]);
    expect(revive(left, 0)).toBe(left); // someone who had not left: nothing to cancel

    const turnIs1 = { ...left, state: { ...(left.state as object), turn: 1 } };
    const moved = act(turnIs1, 't1', { col: 0 }, rng, T0 + 4000);
    expect(moved.left).toEqual([null, null]);
  });

  it('is shown to the others with the seconds left', () => {
    const left = leaveRoom(running('uno', 3), 't2', T0);
    const view = toView(left, 't0', T0 + 4000);
    expect(view.leaving).toEqual([{ seat: 2, goneIn: 6 }]);
    expect(toView(left, 't0', T0 + 60_000).leaving).toEqual([
      { seat: 2, goneIn: 0 },
    ]);
  });

  it('ignores people who are not in the room', () => {
    const room = running('connect4', 2);
    expect(leaveRoom(room, 'stranger', T0)).toBe(room);
    expect(leaveRoom(room, undefined, T0)).toBe(room);
  });
});

describe('leaving before or after a game', () => {
  it('frees the seat of someone leaving the waiting room', () => {
    const room = waiting('uno', 3);
    const after = leaveRoom(room, 't1', T0);
    expect(after.tokens.slice(0, 3)).toEqual(['t0', null, 't2']);
    expect(after.names!.slice(0, 3)[1]).toBeNull();
    // a newcomer can take the seat
    expect(join(after, undefined, 'new', rng, undefined, T0).you).toBe(1);
  });

  it('frees the seat of someone leaving after the game', () => {
    let room = running('connect4', 2);
    room = eliminate(room, 1, rng, T0); // ends the game
    expect(room.status).toBe('over');
    const after = leaveRoom(room, 't0', T0);
    expect(after.tokens).toEqual([null, 't1']);
    expect(hostOf(after)).toBe(1);
  });

  it('frees the seat of someone who was already removed from the game', () => {
    let room = running('uno', 3);
    room = eliminate(room, 1, rng, T0, 'idle');
    const after = leaveRoom(room, 't1', T0 + 1);
    expect(after.tokens[1]).toBeNull();
    expect(after.status).toBe('playing');
  });
});

describe('the admin', () => {
  it('is the creator at first, and only the admin can start the game', () => {
    const room = waiting('uno', 2);
    expect(hostOf(room)).toBe(0);
    expect(() => start(room, 't1', rng, T0)).toThrow(/admin/);
    expect(start(room, 't0', rng, T0).status).toBe('playing');
  });

  it('passes to the next player when the admin leaves the waiting room', () => {
    const room = waiting('uno', 3);
    const after = leaveRoom(room, 't0', T0 + 500);

    expect(hostOf(after)).toBe(1);
    expect(after.hostAt).toBe(T0 + 500);
    expect(() => start(after, 't0', rng, T0)).toThrow(/admin/);
    expect(start(after, 't1', rng, T0).status).toBe('playing');
    // the new admin is announced for a few seconds
    expect(toView(after, 't2', T0 + 2000).hostNotice).toBeGreaterThan(0);
    expect(toView(after, 't2', T0 + 60_000).hostNotice).toBe(0);
  });

  it('passes on to someone who is still here, not someone also on the way out', () => {
    let room = running('uno', 4);
    room = leaveRoom(room, 't1', T0);
    const after = eliminate(leaveRoom(room, 't0', T0), 0, rng, T0 + 1, 'left');
    expect(hostOf(after)).toBe(2); // seat 1 is leaving too, seat 2 is the first still here
  });

  it('passes to the other player when the admin is removed from a running game', () => {
    const room = running('uno', 3);
    const after = eliminate(room, 0, rng, T0 + 5, 'idle');
    expect(hostOf(after)).toBe(1);
    expect(toView(after, 't1', T0 + 6).host).toBe(1);
  });

  it('passes on when the admin does not come back from "keluar"', () => {
    const left = leaveRoom(running('uno', 3), 't0', T0);
    const after = sweep(left, T0 + LEAVE_GRACE_MS + 1, rng);
    expect(after.out![0]).toBe(true);
    expect(hostOf(after)).toBe(1);
  });

  it('makes the next arrival the admin when the room was left empty', () => {
    let room = waiting('connect4', 1);
    room = leaveRoom(room, 't0', T0);
    expect(room.tokens).toEqual([null, null]);
    const joined = join(room, undefined, 'fresh', rng, undefined, T0 + 9);
    expect(hostOf(joined.room)).toBe(joined.you);
  });

  it('keeps the role when seats are closed up for the next game', () => {
    let room = running('uno', 4);
    room = eliminate(room, 0, rng, T0, 'kicked'); // admin moves to seat 1
    room = { ...room, status: 'over' };
    const next = rematch(room, 't1', rng, T0 + 1);
    // seat 0 is gone, so everyone moves up: t1 is now seat 0 and still the admin
    expect(next.tokens.slice(0, 4)).toEqual(['t1', 't2', 't3', null]);
    expect(hostOf(next)).toBe(0);
  });
});

describe('removing a player with kick', () => {
  it('works in the middle of a game: the player is out, and a two-player game goes to the other', () => {
    const room = running('connect4', 2);
    const after = kick(room, 't0', 1, rng, T0 + 1);

    expect(after.status).toBe('over');
    expect(winner(after)).toBe(0);
    expect(after.why).toEqual([null, 'kicked']);
    expect(() => act(after, 't1', { col: 0 })).toThrow(/dikeluarkan/);
  });

  it('lets a bigger game carry on, passing their turn', () => {
    const room = running('uno', 4);
    const target = (room.state as { turn: number }).turn === 2 ? 3 : 2;
    const after = kick(room, 't0', target, rng, T0 + 1);
    expect(after.status).toBe('playing');
    expect(after.out![target]).toBe(true);
    expect(after.strikes![target]).toBe(0);
  });

  it('frees the seat before the game starts', () => {
    const room = waiting('uno', 3);
    const after = kick(room, 't0', 2, rng, T0);
    expect(after.tokens.slice(0, 3)).toEqual(['t0', 't1', null]);
  });

  it('is only for the admin, never on yourself, and only for real seats', () => {
    const room = running('uno', 3);
    expect(() => kick(room, 't1', 2, rng, T0)).toThrow(/admin/);
    expect(() => kick(room, 'stranger', 2, rng, T0)).toThrow(/admin/);
    expect(() => kick(room, 't0', 0, rng, T0)).toThrow(/dirinya sendiri/);
    expect(() => kick(room, 't0', 99, rng, T0)).toThrow(/tidak ada/);
    expect(() => kick(room, 't0', 'x', rng, T0)).toThrow(/tidak ada/);
    expect(kick(room, 't0', 7, rng, T0)).toBe(room); // an empty seat
  });

  it('removes the seat of a player who was already out, instead of removing them twice', () => {
    let room = running('uno', 3);
    room = eliminate(room, 1, rng, T0, 'idle');
    const after = kick(room, 't0', 1, rng, T0 + 1);
    expect(after.tokens[1]).toBeNull();
    expect(after.why![1]).toBeNull();
  });

  it('can be done by an admin who took over', () => {
    let room = waiting('uno', 3);
    room = leaveRoom(room, 't0', T0);
    room = start(room, 't1', rng, T0);
    // seats closed up when the game began: t2 now sits in seat 1
    expect(room.tokens.slice(0, 3)).toEqual(['t1', 't2', null]);
    expect(kick(room, 't1', 1, rng, T0 + 1).out![1]).toBe(true);
  });
});

describe('why someone is out', () => {
  it('is told to everyone', () => {
    let room = running('uno', 4);
    room = eliminate(room, 1, rng, T0, 'idle');
    room = kick(room, 't0', 2, rng, T0 + 1);
    room = sweep(
      leaveRoom(room, 't3', T0 + 2),
      T0 + 2 + LEAVE_GRACE_MS + 1,
      rng,
    );
    expect(toView(room, 't0').outWhy.slice(0, 4)).toEqual([
      null,
      'idle',
      'kicked',
      'left',
    ]);
  });
});

describe('missing turns', () => {
  it('does nothing before the time is up', () => {
    const room = running('connect4', 2);
    expect(sweep(room, T0 + 44_000, rng)).toBe(room);
  });

  it('gives a strike and plays for the idle player once time is up', () => {
    const room = running('connect4', 2);
    const now = T0 + 46_000;
    const next = sweep(room, now, rng);

    expect(next.strikes).toEqual([1, 0]);
    expect(next.status).toBe('playing');
    const state = next.state as { turn: number; moves: number };
    expect(state.moves).toBe(1);
    expect(state.turn).toBe(1);
    expect(next.stamp).toBe(now);
  });

  it('counts strikes for whoever is up, game after game of turns', () => {
    let room = running('uno', 3);
    let now = T0;
    for (let i = 0; i < MAX_STRIKES; i++) {
      now += 41_000;
      room = sweep(room, now, rng);
    }
    expect(room.strikes!.reduce((a, b) => a + b, 0)).toBe(MAX_STRIKES);
  });

  it('removes a player who keeps being the one who is too slow', () => {
    let room = running('connect4', 2);
    let now = T0;
    for (let i = 0; i < MAX_STRIKES; i++) {
      now += 46_000;
      room = sweep(room, now, rng);
      if (
        room.status === 'playing' &&
        (room.state as { turn: number }).turn === 1
      ) {
        room = act(room, 't1', { col: i }, rng, now);
      }
    }
    expect(room.status).toBe('over');
    expect(room.out).toEqual([true, false]);
    expect(room.why).toEqual(['idle', null]);
    expect(winner(room)).toBe(1);
  });

  it('only waits for players who have not answered yet (simultaneous games)', () => {
    const room = running('suit', 2);
    expect(toView(room, 't0', T0 + 5_000).waiting).toEqual({
      seats: [0, 1],
      remaining: 20,
      seconds: 25,
    });

    const one = act(room, 't0', { pick: 'batu' }, rng, T0 + 5_000);
    expect(toView(one, 't0', T0 + 6_000).waiting?.seats).toEqual([1]);

    const next = sweep(one, T0 + 5_000 + 26_000, rng);
    expect(next.strikes).toEqual([0, 1]);
    expect((next.state as { last: unknown }).last).not.toBeNull();
  });

  it('puts the countdown in the view', () => {
    const room = running('connect4', 2);
    expect(toView(room, 't0', T0 + 10_000).waiting).toEqual({
      seats: [0],
      remaining: 35,
      seconds: 45,
    });
    expect(toView(room, 't0', T0 + 99_000).waiting?.remaining).toBe(0);
    expect(toView(eliminate(room, 1, rng, T0), 't0').waiting).toBeNull();
  });
});

describe('another round after someone was removed', () => {
  it('waits for a new opponent in a two-player game', () => {
    const over = eliminate(running('connect4', 2), 1, rng, T0 + 1);

    expect(() => rematch(over, 't1', rng, T0 + 2)).toThrow(/dikeluarkan/);
    const again = rematch(over, 't0', rng, T0 + 2);
    expect(again.status).toBe('waiting');
    expect(again.tokens).toEqual(['t0', null]);

    const joined = join(again, undefined, 'new', rng, undefined, T0 + 3);
    expect(joined.room.status).toBe('playing');
    expect(joined.you).toBe(1);
  });

  it('keeps going when enough players remain', () => {
    let room = eliminate(running('uno', 4), 3, rng, T0);
    room = { ...room, status: 'over' };
    const again = rematch(room, 't0', rng, T0 + 1);
    expect(again.status).toBe('playing');
    expect((again.state as { players: number }).players).toBe(3);
    expect(again.tokens.slice(0, 4)).toEqual(['t0', 't1', 't2', null]);
  });
});

describe('starting after seats were freed', () => {
  it('closes the gaps so every seat has a hand', () => {
    let room = waiting('uno', 3);
    room = kick(room, 't0', 1, rng, T0);
    const started = start(room, 't0', rng, T0);
    expect(started.tokens.slice(0, 3)).toEqual(['t0', 't2', null]);
    expect((started.state as { players: number }).players).toBe(2);
    expect(toView(started, 't2').seat).toBe(1);
  });
});
