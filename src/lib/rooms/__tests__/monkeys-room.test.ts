/** @jest-environment node */
import type { MonkeyView } from '@/lib/games/monkeys';
import {
  act,
  join,
  kick,
  leaveRoom,
  newRoom,
  rematch,
  seated,
  setOptions,
  start,
  sweep,
  toView,
} from '@/lib/rooms/engine';
import { LEAVE_GRACE_MS } from '@/lib/rooms/types';

const T = ['t0', 't1', 't2'];
const T0 = 5_000_000;

const team = () => {
  let r = newRoom('monkeys', 'ABCDE', T[0]);
  r = join(r, undefined, T[1]).room;
  r = join(r, undefined, T[2]).room;
  return setOptions(r, T[0], {
    roles: 'host',
    assign: ['blind', 'mute', 'deaf'],
  });
};
const viewOf = (r: ReturnType<typeof team>, seat: number) =>
  toView(r, T[seat], T0 + 1).state as MonkeyView;

const live = () => {
  let r = start(team(), T[0], () => 0.4, T0);
  for (const t of T) r = act(r, t, { t: 'ready' }, () => 0.4, T0);
  return r;
};

describe('a room of three monkeys', () => {
  it('has exactly three seats and does not start with fewer', () => {
    let r = newRoom('monkeys', 'ABCDE', T[0]);
    expect(r.tokens).toHaveLength(3);
    r = join(r, undefined, T[1]).room;
    expect(seated(r)).toBe(2);
    expect(() => start(r, T[0])).toThrow();
    expect(() =>
      join(join(r, undefined, T[2]).room, undefined, 'fourth'),
    ).toThrow();
  });

  it('waits for the host to start', () => {
    const r = team();
    expect(r.status).toBe('waiting');
    expect(() => start(r, T[1])).toThrow();
    expect(start(r, T[0]).status).toBe('playing');
  });

  it('lets the host change the settings only before the start', () => {
    expect(() => setOptions(live(), T[0], {})).toThrow();
  });

  it('runs the clock on the server: the bomb goes off by itself', () => {
    const r = live();
    const state = r.state as { endsAt: number };
    const after = sweep(r, state.endsAt + 1);
    expect(after.status).toBe('over');
    expect(viewOf(after, 0).cause).toBe('time');
  });
});

describe('a monkey who goes away', () => {
  it('pauses the clock, and the bomb waits however long it takes within the grace', () => {
    let r = live();
    const state = r.state as { endsAt: number };
    r = leaveRoom(r, T[1], T0 + 1000);
    r = sweep(r, T0 + 2000);
    expect((r.state as { pausedAt: number | null }).pausedAt).toBe(T0 + 2000);
    // even past the time the bomb would have gone off, nothing happens while paused
    const later = sweep(r, Math.min(T0 + LEAVE_GRACE_MS, state.endsAt + 5));
    expect(later.status).toBe('playing');
    expect(() =>
      act(r, T[0], { t: 'act', m: 0, a: 'cut', i: 0 }, undefined, T0 + 3000),
    ).toThrow();
  });

  it('carries on, with the lost time given back, when they return', () => {
    let r = live();
    const before = (r.state as { endsAt: number }).endsAt;
    r = leaveRoom(r, T[1], T0 + 1000);
    r = sweep(r, T0 + 2000);
    // coming back: any move or join clears the leaving
    r = join(r, T[1], T[1]).room;
    r = sweep(r, T0 + 6000);
    const s = r.state as { pausedAt: number | null; endsAt: number };
    expect(s.pausedAt).toBeNull();
    expect(s.endsAt).toBe(before + 4000);
    expect(r.status).toBe('playing');
  });

  it('ends the run if they do not come back in time', () => {
    let r = live();
    r = leaveRoom(r, T[2], T0 + 1000);
    r = sweep(r, T0 + 1000 + LEAVE_GRACE_MS + 1000);
    expect(r.status).toBe('over');
    expect(viewOf(r, 0).phase).toBe('abandoned');
  });

  it('ends it when the host removes a monkey in the middle of a bomb', () => {
    const r = kick(live(), T[0], 1, () => 0.4, T0 + 100);
    expect(r.status).toBe('over');
  });
});

describe('views through the room', () => {
  it('shows each seat its own role and nothing of the other roles’ material', () => {
    const r = live();
    const [blind, mute, deaf] = [0, 1, 2].map((s) => viewOf(r, s));
    expect([blind.role, mute.role, deaf.role]).toEqual([
      'blind',
      'mute',
      'deaf',
    ]);
    expect(blind.manual).toBeUndefined();
    expect(deaf.manual).toBeUndefined();
    expect(mute.blind).toBeUndefined();
    expect(mute.deaf).toBeUndefined();
    expect(blind.voice).toEqual({ peer: 2, dir: 'receive' });
    expect(deaf.voice).toEqual({ peer: 0, dir: 'send' });
    expect(mute.voice).toBeNull();
  });

  it('counts down from the moment the clock was read', () => {
    const r = live();
    const a = toView(r, T[1], T0 + 1000).state as MonkeyView;
    const b = toView(r, T[1], T0 + 31_000).state as MonkeyView;
    expect(a.remaining - b.remaining).toBe(30_000);
  });

  it('plays the next campaign level after a rematch when the bomb was defused', () => {
    let r = live();
    // cheat the win in: put the room in the state a defuse would leave
    r = {
      ...r,
      status: 'over',
      state: { ...(r.state as object), phase: 'won' },
    };
    const again = rematch(r, T[0], () => 0.4);
    expect(viewOf(again, 0).level).toBe(2);
    expect(again.status).toBe('playing');
  });
});
