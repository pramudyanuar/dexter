import { type Course, courseAt } from '../content';
import {
  assembledCourse,
  demolitionTargets,
  itemIds,
  ITEMS,
  type Part,
  partyBase,
  previewPlacement,
  startPositions,
} from '../items';
import {
  CRATE_OPEN_TICK,
  dispatchMatch,
  type Match,
  newMatch,
  scoreRound,
  scoreTotal,
  tickParty,
} from '../match';
import {
  advanceBolts,
  type Direction,
  fanForce,
  type Gadget,
  pistonReach,
  swingWeight,
  windup,
} from '../mechanisms';
import { type Input, newRun, stepRun } from '../movement';

const rules = {
  seats: 2,
  rounds: 10,
  target: 600,
  doubleDraft: false,
} as const;
const neutral: Input = {
  direction: 0,
  sprint: false,
  jumpPressed: false,
  jumpHeld: false,
};
const open = (state: Match) => {
  let next = state;
  while (next.phase !== 'draft' || next.left > CRATE_OPEN_TICK)
    next = tickParty(next);
  return next;
};
const expire = (state: Match) => tickParty({ ...state, left: 1 });
const surface = { id: 'floor', x: 0, y: 1, w: 31, h: 1, type: 'wood' as const };
const course: Course = {
  start: { x: 5, y: 2 },
  goal: { x: 29, y: 2, w: 1, h: 2 },
  surfaces: [surface],
  saws: [],
};
const gadget = (
  kind: Gadget['kind'],
  x: number,
  y: number,
  turn: Direction = 0,
): Gadget => ({ id: kind, kind, x, y, turn, owner: 1 });

test('one shared seeded crate, atomic claim, stale or cloned duplicates are rejected', () => {
  const start = newMatch(rules, 321);
  const m = open(start);
  expect(m.offers).toEqual(open(newMatch(rules, 321)).offers);
  expect(new Set(m.offers.map((token) => token.id)).size).toBe(4);
  const action = {
    type: 'claim' as const,
    serial: m.serial,
    seat: 0,
    token: m.offers[0].id,
  };
  expect(
    dispatchMatch({ ...m, left: CRATE_OPEN_TICK + 1 }, action).picks[0],
  ).toBe('pending');
  const claimed = dispatchMatch(m, action);
  expect(claimed.picks[0]).toEqual(m.offers[0]);
  const clone = JSON.parse(JSON.stringify(claimed)) as Match;
  expect(dispatchMatch(clone, { ...action, seat: 1 })).toBe(clone);
  expect(dispatchMatch(claimed, { ...action, token: m.offers[1].id })).toBe(
    claimed,
  );
  expect(
    dispatchMatch(claimed, { ...action, serial: m.serial - 1, seat: 1 }),
  ).toBe(claimed);
});

test('build commits once, persists to the next round, and leaves concurrent blocked picks available', () => {
  const m = open(newMatch(rules, 8));
  const build = {
    ...m,
    phase: 'build' as const,
    picks: [
      { id: 'a', item: 'plank' as const },
      { id: 'b', item: 'steel' as const },
    ],
    done: [false, false],
  };
  const action = {
    type: 'place' as const,
    serial: m.serial,
    seat: 0,
    position: { x: 12, y: 13, turn: 0 as const },
  };
  const placed = dispatchMatch(build, action);
  expect(placed.board[0]).toMatchObject({ item: 'plank', owner: 0 });
  expect(dispatchMatch(placed, action)).toBe(placed);
  expect(dispatchMatch(placed, { ...action, seat: 1 })).toBe(placed);
  const countdown = dispatchMatch(placed, {
    ...action,
    seat: 1,
    position: null,
  });
  expect(countdown.phase).toBe('countdown');
  const result = expire(expire(countdown));
  expect(result.phase).toBe('result');
  const next = expire(expire(result));
  expect(next.round).toBe(2);
  expect(next.board).toEqual(placed.board);
});

test('two-player double draft repeats once, all phase deadlines resolve, and tied games finish after two attempts', () => {
  let m = open(newMatch({ ...rules, doubleDraft: true, rounds: 1 }, 11));
  m = expire(m);
  expect([m.phase, m.box]).toEqual(['draft', 2]);
  m = expire(m);
  for (const expected of [
    'race',
    'result',
    'score',
    'countdown',
    'race',
    'countdown',
    'race',
    'victory',
  ]) {
    m = expire(m);
    expect(m.phase).toBe(expected);
  }
  expect(m.winners).toEqual([0, 1]);
  expect(newMatch(m.rules, 12).board).toEqual([]);
});

test.each([2, 3, 4] as const)(
  'all-finish and all-fail score zero for %i seats',
  (count) => {
    for (const finish of [null, 22]) {
      const result = scoreRound(
        Array.from({ length: count }, () => ({ finish, killer: 1, coins: 1 })),
        Array(count).fill(2),
        3,
      );
      expect(result.outcome).toBe(finish ? 'all' : 'none');
      expect(result.awards.map(scoreTotal)).toEqual(Array(count).fill(0));
    }
  },
);

test('mixed, first, solo, distinct trap victims, coin and comeback score as one ledger', () => {
  const mixed = scoreRound(
    [
      { finish: 10, coins: 0 },
      { finish: 12, coins: 0 },
      { finish: null, killer: 2, coins: 1 },
      { finish: null, killer: 2, coins: 0 },
    ],
    [0, 0, 0, 0],
    3,
  );
  expect(mixed.awards.map(scoreTotal)).toEqual([120, 100, 20, 0]);
  const solo = scoreRound(
    [
      { finish: 10, coins: 1 },
      { finish: null, killer: 0, coins: 1 },
    ],
    [2, 0],
    4,
  );
  expect(solo.awards.map(scoreTotal)).toEqual([240, 0]);
  expect(solo.streaks).toEqual([0, 1]);
});

test.each(itemIds.filter((item) => item !== 'bomb' && item !== 'spikes'))(
  '%s commits its physical footprint when rotated as supported',
  (item) => {
    for (const turn of ITEMS[item].turns) {
      const placement = previewPlacement([], item, { x: 9.24, y: 12.16, turn });
      expect(placement.error).toBeUndefined();
      expect(placement.point).toEqual({ x: 9, y: 12, turn });
      const part = { ...placement.point, id: 'one', item, owner: 0 };
      const built = assembledCourse([part]);
      const added =
        built.surfaces.some((s) => s.id === 'one') ||
        built.saws.length > partyBase.saws.length ||
        built.gadgets?.some((g) => g.id === 'one');
      expect(added).toBe(true);
    }
  },
);

test('spawn and goal are protected, including all four spawn positions', () => {
  for (const point of [...startPositions(partyBase, 4), partyBase.goal]) {
    expect(previewPlacement([], 'saw', { ...point, turn: 0 }).error).toBe(
      'protected',
    );
  }
  expect(previewPlacement([], 'plank', { x: -1, y: 5, turn: 0 }).error).toBe(
    'bounds',
  );
  expect(previewPlacement([], 'shelf', { x: 10, y: 5, turn: 1 }).error).toBe(
    'turn',
  );
});

test('mounted spikes and launcher follow a lift, and demolition removes its children atomically', () => {
  const lift: Part = {
    id: 'part-lift',
    item: 'lift',
    x: 10,
    y: 12,
    turn: 0,
    owner: 0,
  };
  expect(previewPlacement([], 'spikes', { x: 10, y: 13, turn: 0 }).error).toBe(
    'mount',
  );
  const spikes = previewPlacement([lift], 'spikes', {
    x: 10,
    y: 12.5,
    turn: 0,
  });
  expect(spikes.mount).toBe('part-lift');
  expect(spikes.error).toBeUndefined();
  const rail: Part = {
    id: 'spikes',
    item: 'spikes',
    ...spikes.point,
    mount: spikes.mount,
    owner: 1,
  };
  const arrow: Part = {
    id: 'arrow',
    item: 'arrow',
    x: 10.95,
    y: 12.75,
    turn: 0,
    mount: 'part-lift',
    owner: 0,
  };
  const built = assembledCourse([lift, rail, arrow]);
  const high = courseAt(built, 120);
  expect(high.gadgets.find((g) => g.id === 'spikes')?.y).toBeCloseTo(
    spikes.point.y + 2.5,
  );
  expect(high.surfaces.find((s) => s.id === 'arrow')?.y).toBeCloseTo(14.75);
  expect(
    demolitionTargets([lift, rail, arrow], { x: 10, y: 10.4 }).sort(),
  ).toEqual(['arrow', 'part-lift', 'spikes']);
  expect(previewPlacement([], 'bomb', { x: 2, y: 3, turn: 0 }).error).toBe(
    'empty',
  );
});

test('moving saw overlap leaves its danger lane available while hard bodies block', () => {
  const saw: Part = {
    id: 'rail',
    item: 'rail',
    x: 10,
    y: 12,
    turn: 0,
    owner: 0,
  };
  expect(
    previewPlacement([saw], 'steel', { x: 11.5, y: 12, turn: 0 }).error,
  ).toBeUndefined();
  expect(
    previewPlacement([saw], 'steel', { x: 10, y: 12, turn: 0 }).error,
  ).toBe('blocked');
});

test('all four launcher orientations animate and destroy a bolt at shielding', () => {
  for (const turn of [0, 1, 2, 3] as const) {
    const launcher = gadget('arrow', 8, 5, turn);
    expect(windup(launcher, 50)).toBe(true);
    expect(advanceBolts([launcher], [], 59, [])).toEqual([]);
    const [bolt] = advanceBolts([launcher], [], 60, []);
    const moved = advanceBolts([], [], 61, [bolt])[0];
    expect(Math.hypot(moved.x - bolt.x, moved.y - bolt.y)).toBeCloseTo(0.2);
    const shield = {
      ...surface,
      x: (bolt.x + moved.x) / 2 - 0.06,
      y: (bolt.y + moved.y) / 2 - 0.06,
      w: 0.12,
      h: 0.12,
    };
    const stopped = advanceBolts([], [shield], 61, [bolt]);
    expect(stopped[0].stopped).toBe(true);
    expect(advanceBolts([], [shield], 62, stopped)).toEqual([]);
  }
});

test('piston only hits with its moving pad; spike teeth, a swing weight and a bolt attribute the owner', () => {
  const specs: [Gadget, number, { x: number; y: number }][] = [
    [gadget('piston', 4, 2.4), 64, { x: 6.1, y: 2 }],
    [gadget('spikes', 5, 2.25), 1, { x: 5, y: 2 }],
    [gadget('swing', 5, 4.7), 1, { x: 5, y: 2 }],
    [gadget('arrow', 4.3, 2.4), 61, { x: 5.1, y: 2 }],
  ];
  for (const [fixture, tick, start] of specs) {
    const stage = { ...course, gadgets: [fixture], start };
    const frame = newRun(stage);
    const before = courseAt(stage, tick - 1);
    const state = stepRun(
      stage,
      { ...frame, tick: tick - 1, layout: before },
      neutral,
    );
    expect([fixture.kind, state.player.pose, state.player.killer]).toEqual([
      fixture.kind,
      'dead',
      1,
    ]);
  }
  expect(pistonReach(41)).toBe(0);
  expect(swingWeight(specs[2][0], 1).x).not.toBe(
    swingWeight(specs[2][0], 65).x,
  );
});

test('fan force stacks with a spring and reverses with its orientation', () => {
  const left = gadget('fan', 6.5, 2.7, 2);
  expect(fanForce([left], { x: 5, y: 2.7 }).x).toBeLessThan(0);
  const plain: Course = {
    ...course,
    surfaces: [{ ...surface, type: 'spring' }],
  };
  const wind: Course = { ...plain, gadgets: [gadget('fan', 5, 1.7, 1)] };
  const arc = (stage: Course) => {
    let frame = newRun(stage);
    let highest = frame.player.y;
    for (let i = 0; i < 36; i++) {
      frame = stepRun(stage, frame, neutral);
      highest = Math.max(highest, frame.player.y);
    }
    return highest;
  };
  expect(arc(wind)).toBeGreaterThan(arc(plain) + 0.25);
});

test.each([
  {
    turn: 1,
    start: { x: 4.68, y: 2.3 },
    velocity: { vx: 8, vy: 0 },
    output: { vx: -15.5 },
  },
  {
    turn: 3,
    start: { x: 5.82, y: 2.3 },
    velocity: { vx: -8, vy: 0 },
    output: { vx: 15.5 },
  },
  {
    turn: 2,
    start: { x: 5.25, y: 2.15 },
    velocity: { vx: 0, vy: 9 },
    output: { vy: -15.5 },
  },
  {
    turn: 1,
    start: { x: 5.25, y: 4.03 },
    velocity: { vx: 0, vy: -9 },
    output: { vy: 0, ground: 'pad' },
  },
] as const)(
  'spring triggers only on its outward face ($turn)',
  ({ turn, start, velocity, output }) => {
    const field: Course = {
      ...course,
      start,
      surfaces: [
        surface,
        { id: 'pad', type: 'spring', x: 5, y: 3, w: 0.5, h: 1, turn },
      ],
    };
    const frame = newRun(field);
    const state = stepRun(
      field,
      { ...frame, player: { ...frame.player, ...velocity } },
      neutral,
    );
    expect(state.player).toMatchObject(output);
  },
);

test('a shared coin belongs to one seat even on simultaneous contact and restores on next countdown', () => {
  let state = expire(expire(open(newMatch(rules, 31))));
  const arena = { ...course, gadgets: [gadget('coin', 5, 2.55)] };
  const frame = newRun(arena);
  state = {
    ...state,
    course: arena,
    race: {
      ...state.race,
      players: [frame.player, { ...frame.player }],
      layout: frame.layout,
    },
  };
  const next = tickParty(state);
  expect(next.race.collected).toEqual({ coin: 0 });
  const score = expire(expire(expire(next)));
  const reset = expire(open(score));
  expect(reset.race.collected).toEqual({});
});

test('tiebreak respawns eliminated seats and awards only the first player to touch the goal', () => {
  const setup = expire({
    ...newMatch({ ...rules, rounds: 1 }, 37),
    phase: 'score',
    left: 1,
  });
  let state = expire(setup);
  const runners = [...state.race.players];
  runners[0] = { ...runners[0], pose: 'dead', age: 75 };
  state = tickParty({ ...state, race: { ...state.race, players: runners } });
  expect(state.race.players[0].pose).toBe('idle');
  runners[0] = {
    ...state.race.players[0],
    x: state.course.goal.x + 0.3,
    y: state.course.goal.y,
    pose: 'idle',
  };
  const victory = tickParty({
    ...state,
    race: { ...state.race, players: runners },
  });
  expect(victory.winners).toEqual([0]);
  expect(victory.phase).toBe('victory');
});
