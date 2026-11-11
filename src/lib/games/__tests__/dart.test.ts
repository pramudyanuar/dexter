/** @jest-environment node */
import {
  dartGame as g,
  DartState,
  DartView,
  land,
  ranking,
  sanitizeDart,
  spreadFor,
  start,
  suggestCheckout,
} from '@/lib/games/dart';
import {
  angleOf,
  hitAt,
  pointAt,
  RADII,
  segmentAt,
  SEQUENCE,
} from '@/lib/games/dart-board';
import { DartConfig } from '@/lib/games/dart-config';
import { RoomError } from '@/lib/rooms/types';

/** A random source that makes every dart land exactly where it was aimed. */
const exact = (() => {
  let i = 0;
  return () => [0.5, 0.25][i++ % 2];
})();

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Aim = [number, 'single' | 'triple' | 'double'] | 'bull' | 'outer' | 'miss';

const spot = (a: Aim) => {
  if (a === 'bull') return { x: 0, y: 0 };
  if (a === 'outer')
    return { x: 0, y: -(RADII.innerBull + RADII.outerBull) / 2 };
  if (a === 'miss') return { x: 2, y: 2 };
  return pointAt(a[0], a[1]);
};

const game = (cfg: Partial<DartConfig> = {}, players = 2): DartState =>
  start(players, undefined, { throwMode: 'casual', ...cfg });

/** Throws darts at spots, as the given seat. */
function play(s: DartState, seat: number, ...aims: Aim[]) {
  let cur = s;
  for (const a of aims) {
    const { x, y } = spot(a);
    cur = g.move(cur, seat, { type: 'throw', x, y }, exact);
  }
  return cur;
}
const next = (s: DartState, seat: number) => g.move(s, seat, { type: 'next' });
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RoomError;
  }
  return undefined;
};
const view = (s: DartState, seat: number | null = 0) =>
  g.view(s, seat) as DartView;

describe('the dartboard', () => {
  it('has the numbers in the right order, clockwise from the top', () => {
    expect([...SEQUENCE]).toEqual([
      20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
    ]);
    expect(new Set(SEQUENCE).size).toBe(20);
  });

  it('puts every number in its own 18 degree slice, centred on its angle', () => {
    SEQUENCE.forEach((n, i) => {
      const p = pointAt(n, 'single');
      expect(angleOf(p.x, p.y)).toBeCloseTo(i * 18, 6);
      expect(segmentAt(p.x, p.y)).toBe(i);
      expect(hitAt(p.x, p.y).number).toBe(n);
    });
  });

  it('20 is at the top, 3 at the bottom, 6 on the right and 11 on the left', () => {
    const at = (x: number, y: number) => hitAt(x, y).number;
    expect(at(0, -0.8)).toBe(20);
    expect(at(0, 0.8)).toBe(3);
    expect(at(0.8, 0)).toBe(6);
    expect(at(-0.8, 0)).toBe(11);
  });

  it('scores singles, doubles and triples', () => {
    for (const n of SEQUENCE) {
      expect(
        hitAt(pointAt(n, 'single').x, pointAt(n, 'single').y),
      ).toMatchObject({
        ring: 'single',
        points: n,
        multiplier: 1,
        label: String(n),
      });
      expect(
        hitAt(pointAt(n, 'double').x, pointAt(n, 'double').y),
      ).toMatchObject({
        ring: 'double',
        points: n * 2,
        multiplier: 2,
        label: `D${n}`,
      });
      expect(
        hitAt(pointAt(n, 'triple').x, pointAt(n, 'triple').y),
      ).toMatchObject({
        ring: 'triple',
        points: n * 3,
        multiplier: 3,
        label: `T${n}`,
      });
      // the wide strip between the rings and the inner bit near the bull are singles
      expect(hitAt(pointAt(n, 'inner').x, pointAt(n, 'inner').y).ring).toBe(
        'single',
      );
    }
  });

  it('scores the bull', () => {
    expect(hitAt(0, 0)).toMatchObject({
      ring: 'ibull',
      points: 50,
      label: 'Bull',
    });
    expect(hitAt(0.02, 0)).toMatchObject({ ring: 'ibull', points: 50 });
    expect(hitAt(0.06, 0)).toMatchObject({ ring: 'obull', points: 25 });
    expect(hitAt(0, 0.08)).toMatchObject({ ring: 'obull', points: 25 });
  });

  it('scores nothing outside the double ring', () => {
    expect(hitAt(0, -1.01)).toMatchObject({
      ring: 'miss',
      points: 0,
      label: 'Miss',
    });
    expect(hitAt(3, 3).points).toBe(0);
    expect(hitAt(NaN, 0).ring).toBe('miss');
  });

  it('puts the ring edges where a real board has them (radial detection)', () => {
    const ring = (mm: number) => hitAt(0, -mm / 170).ring;
    expect(ring(6)).toBe('ibull');
    expect(ring(7)).toBe('obull');
    expect(ring(15)).toBe('obull');
    expect(ring(17)).toBe('single');
    expect(ring(98)).toBe('single');
    expect(ring(100)).toBe('triple');
    expect(ring(106)).toBe('triple');
    expect(ring(108)).toBe('single');
    expect(ring(161)).toBe('single');
    expect(ring(163)).toBe('double');
    expect(ring(169)).toBe('double');
    expect(ring(171)).toBe('miss');
  });

  it('puts the segment boundaries halfway between the numbers', () => {
    // just either side of the line between 20 and 1 (9 degrees clockwise)
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const at = (deg: number) =>
      hitAt(Math.sin(rad(deg)) * 0.8, -Math.cos(rad(deg)) * 0.8).number;
    expect(at(8.9)).toBe(20);
    expect(at(9.1)).toBe(1);
    expect(at(-8.9)).toBe(20);
    expect(at(-9.1)).toBe(5);
  });
});

describe('throwing', () => {
  it('lands where you aim when there is no deviation', () => {
    const a = pointAt(20, 'triple');
    const at = land(a.x, a.y, sanitizeDart({}), 1, exact);
    expect(at.x).toBeCloseTo(a.x, 9);
    expect(at.y).toBeCloseTo(a.y, 9);
  });

  it('casual mode is mostly accurate: aiming at a triple hits it nearly every time', () => {
    const cfg = sanitizeDart({ throwMode: 'casual' });
    const rng = seeded(1);
    const a = pointAt(20, 'triple');
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const p = land(a.x, a.y, cfg, undefined, rng);
      if (hitAt(p.x, p.y).label === 'T20') hits++;
    }
    expect(hits).toBeGreaterThan(340);
  });

  it('skill mode is harder, and timing decides how much harder', () => {
    const cfg = sanitizeDart({ throwMode: 'skill' });
    expect(spreadFor(cfg, 1)).toBeLessThan(spreadFor(cfg, 0.5));
    expect(spreadFor(cfg, 0.5)).toBeLessThan(spreadFor(cfg, 0));
    expect(spreadFor(cfg, 1)).toBeGreaterThan(
      spreadFor(sanitizeDart({}), 1) * 0.9,
    );
    const a = pointAt(20, 'triple');
    const rate = (power: number) => {
      const rng = seeded(7);
      let hits = 0;
      for (let i = 0; i < 500; i++) {
        const p = land(a.x, a.y, cfg, power, rng);
        if (hitAt(p.x, p.y).label === 'T20') hits++;
      }
      return hits / 500;
    };
    expect(rate(1)).toBeGreaterThan(rate(0.5));
    expect(rate(0.5)).toBeGreaterThan(rate(0));
    // good timing is no longer a sure thing, bad timing is almost hopeless
    expect(rate(1)).toBeLessThan(0.95);
    expect(rate(0)).toBeLessThan(0.15);
  });

  it('difficulty scales the spread', () => {
    const base = { throwMode: 'skill' as const };
    const easy = spreadFor(sanitizeDart({ ...base, difficulty: 'easy' }), 0.5);
    const hard = spreadFor(sanitizeDart({ ...base, difficulty: 'hard' }), 0.5);
    expect(easy).toBeLessThan(hard);
  });

  it('is deterministic for a given random source', () => {
    const cfg = sanitizeDart({ throwMode: 'skill' });
    expect(land(0.1, 0.2, cfg, 0.4, seeded(3))).toEqual(
      land(0.1, 0.2, cfg, 0.4, seeded(3)),
    );
  });
});

describe('settings', () => {
  it('start with sensible defaults and clamp what they are given', () => {
    const c = sanitizeDart(null);
    expect(c).toMatchObject({
      mode: '501',
      startScore: 501,
      doubleOut: true,
      throwMode: 'casual',
    });
    expect(sanitizeDart({ mode: '301' }).startScore).toBe(301);
    expect(sanitizeDart({ startScore: 5000 }).startScore).toBe(1001);
    expect(sanitizeDart({ mode: 'bogus', rounds: 99 })).toMatchObject({
      mode: '501',
      rounds: 20,
    });
  });
});

describe('301 and 501', () => {
  it('start from the right score', () => {
    expect(game({ mode: '501' }).scores).toEqual([501, 501]);
    expect(game({ mode: '301' }).scores).toEqual([301, 301]);
    expect(game({ mode: '301', startScore: 201 }).scores).toEqual([201, 201]);
  });

  it('take each dart off the score, three darts to a turn', () => {
    let s = game({ mode: '501' });
    s = play(s, 0, [20, 'triple']);
    expect(s.scores[0]).toBe(441);
    expect(s.throws).toHaveLength(1);
    s = play(s, 0, [20, 'triple'], [20, 'single']);
    expect(s.scores[0]).toBe(361);
    expect(s.turnDone).toBe(true);
    expect(s.turnResult).toBe('ok');
    expect(errorOf(() => play(s, 0, 'bull'))?.status).toBe(409);
    expect(s.stats[0]).toMatchObject({ darts: 3 });
  });

  it('pass the turn on, and count the rounds', () => {
    let s = game({ mode: '501' });
    s = next(play(s, 0, [20, 'triple'], [20, 'triple'], [20, 'triple']), 0);
    expect(s.turn).toBe(1);
    expect(s.round).toBe(1);
    expect(s.throws).toHaveLength(0);
    expect(s.turnStart).toBe(501);
    s = next(play(s, 1, [19, 'triple'], [19, 'triple'], [19, 'triple']), 1);
    expect(s.turn).toBe(0);
    expect(s.round).toBe(2);
    expect(s.scores).toEqual([321, 330]);
    expect(s.history).toHaveLength(2);
    expect(s.history[0]).toMatchObject({ seat: 0, total: 180, result: 'ok' });
  });

  it('only the player whose turn it is can throw, and "next" waits for the turn to end', () => {
    const s = game();
    expect(errorOf(() => play(s, 1, 'bull'))?.status).toBe(409);
    expect(errorOf(() => next(s, 0))?.status).toBe(409);
    expect(
      errorOf(() => g.move(s, 0, { type: 'throw', x: 'a', y: 0 }, exact))
        ?.status,
    ).toBe(400);
    expect(errorOf(() => g.move(s, 0, { type: 'dance' }, exact))?.status).toBe(
      400,
    );
  });

  it('keeps the darts visible where they landed', () => {
    const s = play(game(), 0, [20, 'triple'], 'bull');
    expect(s.throws.map((t) => t.label)).toEqual(['T20', 'Bull']);
    expect(s.throws[0].x).toBeCloseTo(spot([20, 'triple']).x, 6);
    expect(s.throws.map((t) => t.seq)).toEqual([1, 2]);
    expect(s.throws[0]).toMatchObject({ points: 60, counted: 60 });
  });

  describe('busting', () => {
    const near = (rest: number, cfg: Partial<DartConfig> = {}) => {
      const s = game({ mode: '301', startScore: 301, ...cfg });
      s.scores[0] = rest;
      s.turnStart = rest;
      return s;
    };

    it('going over the score is a bust: the score goes back and the turn ends', () => {
      let s = near(40);
      s = play(s, 0, [20, 'triple']); // 60 > 40
      expect(s.scores[0]).toBe(40);
      expect(s.turnDone).toBe(true);
      expect(s.turnResult).toBe('bust');
      expect(s.throws[0].note).toBe('bust');
      expect(s.throws[0].counted).toBe(0);
      expect(errorOf(() => play(s, 0, 'bull'))?.status).toBe(409);
      expect(s.stats[0].busts).toBe(1);
      s = next(s, 0);
      expect(s.turn).toBe(1);
    });

    it('a bust undoes the darts thrown earlier in the same turn', () => {
      let s = near(100);
      s = play(s, 0, [20, 'triple']); // 40 left
      expect(s.scores[0]).toBe(40);
      s = play(s, 0, [20, 'triple']); // bust
      expect(s.scores[0]).toBe(100);
      expect(s.history).toHaveLength(1);
      expect(s.history[0]).toMatchObject({
        result: 'bust',
        total: 0,
        before: 100,
        after: 100,
      });
    });

    it('leaving 1 is a bust with double-out', () => {
      let s = near(21);
      s = play(s, 0, [20, 'single']);
      expect(s.scores[0]).toBe(21);
      expect(s.turnResult).toBe('bust');
    });

    it('but 1 is fine without double-out', () => {
      let s = near(21, { doubleOut: false });
      s = play(s, 0, [20, 'single']);
      expect(s.scores[0]).toBe(1);
      expect(s.turnResult).toBeNull();
    });

    it('reaching zero without a double is a bust', () => {
      let s = near(20);
      s = play(s, 0, [20, 'single']);
      expect(s.scores[0]).toBe(20);
      expect(s.turnResult).toBe('bust');
      let t = near(60);
      t = play(t, 0, [20, 'triple']); // triple, not a double
      expect(t.turnResult).toBe('bust');
      expect(t.over).toBe(false);
    });

    it('the outer bull is not a double either', () => {
      const s = play(near(25), 0, 'outer');
      expect(s.turnResult).toBe('bust');
    });
  });

  describe('checking out', () => {
    const near = (rest: number, cfg: Partial<DartConfig> = {}) => {
      const s = game({ mode: '501', ...cfg });
      s.scores[0] = rest;
      s.turnStart = rest;
      return s;
    };

    it('wins with a double', () => {
      const s = play(near(40), 0, [20, 'double']);
      expect(s.scores[0]).toBe(0);
      expect(s.over).toBe(true);
      expect(s.winner).toBe(0);
      expect(s.endReason).toBe('checkout');
      expect(s.throws[0].note).toBe('checkout');
      expect(errorOf(() => play(s, 1, 'bull'))?.status).toBe(409);
    });

    it('wins with the inner bull', () => {
      const s = play(near(50), 0, 'bull');
      expect(s.over).toBe(true);
      expect(s.winner).toBe(0);
    });

    it('wins on the last dart of a turn, after other darts', () => {
      const s = play(near(100), 0, [20, 'triple'], [20, 'double']);
      expect(s.winner).toBe(0);
      expect(s.history[0]).toMatchObject({ result: 'win', total: 100 });
    });

    it('can finish on any dart if double-out is off', () => {
      const s = play(near(20, { doubleOut: false }), 0, [20, 'single']);
      expect(s.winner).toBe(0);
    });

    it('the other player can still win by a better finish', () => {
      let s = near(40);
      s.scores[1] = 32;
      s = next(play(s, 0, [10, 'single'], [10, 'single'], [10, 'single']), 0);
      expect(s.scores[0]).toBe(10);
      s = play(s, 1, [16, 'double']);
      expect(s.winner).toBe(1);
    });
  });

  it('suggests a finish', () => {
    expect(suggestCheckout(40, 3, true)).toEqual(['D20']);
    expect(suggestCheckout(50, 1, true)).toEqual(['Bull']);
    expect(suggestCheckout(170, 3, true)).toEqual(['T20', 'T20', 'Bull']);
    expect(suggestCheckout(100, 2, true)).toEqual(['T20', 'D20']);
    expect(suggestCheckout(169, 3, true)).toBeNull();
    expect(suggestCheckout(41, 1, true)).toBeNull();
    expect(['20', 'D10']).toContain(suggestCheckout(20, 1, false)![0]);
    // every suggestion actually adds up, and ends on a double
    for (let n = 2; n <= 170; n++) {
      const f = suggestCheckout(n, 3, true);
      if (!f) continue;
      const pts = f.map((l) =>
        l === 'Bull'
          ? 50
          : l === '25'
            ? 25
            : l[0] === 'T'
              ? Number(l.slice(1)) * 3
              : l[0] === 'D'
                ? Number(l.slice(1)) * 2
                : Number(l),
      );
      expect(pts.reduce((a, b) => a + b, 0)).toBe(n);
      expect(f[f.length - 1] === 'Bull' || f[f.length - 1][0] === 'D').toBe(
        true,
      );
    }
    // the view carries it for the player who is up
    const s = game({ mode: '501' });
    s.scores[0] = 40;
    expect(view(s).checkout).toEqual(['D20']);
  });
});

describe('Count Up', () => {
  it('adds every dart to the total, over a set number of rounds', () => {
    let s = game({ mode: 'countup', rounds: 2 });
    expect(s.scores).toEqual([0, 0]);
    s = next(play(s, 0, [20, 'triple'], [20, 'single'], 'bull'), 0); // 130
    s = next(play(s, 1, [1, 'single'], [1, 'single'], [1, 'single']), 1); // 3
    expect(s.scores).toEqual([130, 3]);
    expect(s.round).toBe(2);
    expect(s.over).toBe(false);
    s = next(play(s, 0, 'miss', 'miss', 'miss'), 0);
    s = next(play(s, 1, [19, 'triple'], [19, 'triple'], 'miss'), 1);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('rounds');
    expect(s.scores).toEqual([130, 117]);
    expect(s.winner).toBe(0);
    expect(s.tie).toEqual([]);
    expect(ranking(s)).toEqual([0, 1]);
    expect(s.stats[0].bestTurn).toBe(130);
  });

  it('says so when it is a tie', () => {
    let s = game({ mode: 'countup', rounds: 1 });
    s = next(play(s, 0, [20, 'single'], 'miss', 'miss'), 0);
    s = next(play(s, 1, [20, 'single'], 'miss', 'miss'), 1);
    expect(s.over).toBe(true);
    expect(s.tie).toEqual([0, 1]);
  });

  it('does not stop early when the rounds are not up', () => {
    let s = game({ mode: 'countup', rounds: 3 });
    s = next(play(s, 0, 'bull', 'bull', 'bull'), 0);
    expect(s.over).toBe(false);
  });
});

describe('Around the Clock', () => {
  it('moves on only when you hit the number you are on', () => {
    let s = game({ mode: 'clock', clockBull: false });
    expect(s.scores).toEqual([1, 1]);
    s = play(s, 0, [5, 'single']);
    expect(s.scores[0]).toBe(1);
    s = play(s, 0, [1, 'single']);
    expect(s.scores[0]).toBe(2);
    expect(s.throws[1].note).toBe('target');
    // a double or a triple of it counts as a hit, no more
    s = next(play(s, 0, [2, 'triple']), 0);
    expect(s.scores[0]).toBe(3);
  });

  it('can climb several numbers in one turn', () => {
    const s = play(
      game({ mode: 'clock' }),
      0,
      [1, 'single'],
      [2, 'single'],
      [3, 'double'],
    );
    expect(s.scores[0]).toBe(4);
  });

  it('is won by reaching 20', () => {
    let s = game({ mode: 'clock', clockBull: false });
    s.scores[0] = 20;
    s = play(s, 0, [20, 'double']);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('finished');
  });

  it('can end on the bull', () => {
    let s = game({ mode: 'clock', clockBull: true });
    s.scores[0] = 20;
    s = play(s, 0, [20, 'single']);
    expect(s.over).toBe(false);
    expect(s.scores[0]).toBe(21);
    s = next(play(s, 0, 'miss', 'miss'), 0);
    s = next(play(s, 1, 'miss', 'miss', 'miss'), 1);
    s = play(s, 0, 'outer');
    expect(s.winner).toBe(0);
  });

  it('first to finish wins, and the other player does not move on his hits', () => {
    let s = game({ mode: 'clock' });
    s = next(play(s, 0, [1, 'single'], 'miss', 'miss'), 0);
    s = play(s, 1, [1, 'single']);
    expect(s.scores).toEqual([2, 2]);
  });
});

describe('Cricket', () => {
  const cricket = (players = 2) => game({ mode: 'cricket' }, players);

  it('counts a mark for a single, two for a double and three for a triple', () => {
    let s = play(cricket(), 0, [20, 'single'], [19, 'double'], [18, 'triple']);
    expect(s.marks[0]).toEqual([1, 2, 3, 0, 0, 0, 0]);
    expect(s.scores).toEqual([0, 0]);
    s = next(s, 0);
    s = play(s, 1, [17, 'triple'], [16, 'double'], 'outer');
    expect(s.marks[1]).toEqual([0, 0, 0, 3, 2, 0, 1]);
  });

  it('counts the bull: the outer bull one mark, the inner bull two', () => {
    const s = play(cricket(), 0, 'outer', 'bull');
    expect(s.marks[0][6]).toBe(3);
  });

  it('ignores numbers that are not in the game', () => {
    const s = play(cricket(), 0, [14, 'triple'], [3, 'single'], 'miss');
    expect(s.marks[0]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(s.throws.every((t) => t.counted === 0)).toBe(true);
  });

  it('scores extra hits on a number you have closed while the opponent has not', () => {
    let s = play(cricket(), 0, [20, 'triple'], [20, 'triple']);
    expect(s.marks[0][0]).toBe(3);
    expect(s.scores[0]).toBe(60); // the second triple is three scoring marks
    expect(s.throws[1]).toMatchObject({ counted: 60 });
    // a double the first time round: two marks, then the extra mark scores
    const t = play(cricket(), 0, [19, 'double'], [19, 'double']);
    expect(t.marks[0][1]).toBe(3);
    expect(t.scores[0]).toBe(19); // one mark closes it, the other scores
    s = t;
  });

  it('stops scoring on a number once everyone has closed it', () => {
    let s = cricket();
    s = next(play(s, 0, [20, 'triple'], 'miss', 'miss'), 0);
    s = next(play(s, 1, [20, 'triple'], 'miss', 'miss'), 1);
    expect(s.marks.map((m) => m[0])).toEqual([3, 3]);
    s = play(s, 0, [20, 'triple']);
    expect(s.scores[0]).toBe(0); // closed by both: dead
  });

  it('with three players, a number only stops scoring when every other player has closed it', () => {
    let s = cricket(3);
    s = next(play(s, 0, [20, 'triple'], 'miss', 'miss'), 0);
    s = next(play(s, 1, [20, 'triple'], 'miss', 'miss'), 1);
    s = next(play(s, 2, 'miss', 'miss', 'miss'), 2);
    s = play(s, 0, [20, 'single']);
    expect(s.scores[0]).toBe(20); // player 3 has not closed it
  });

  it('is won by closing everything while level or ahead on points', () => {
    let s = cricket();
    s.marks[0] = [3, 3, 3, 3, 3, 2, 3];
    s.scores = [40, 20];
    s = play(s, 0, [15, 'single']);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('finished');
  });

  it('is not won by closing everything while behind on points', () => {
    let s = cricket();
    s.marks[0] = [3, 3, 3, 3, 3, 2, 3];
    s.scores = [0, 50];
    s = play(s, 0, [15, 'single']);
    expect(s.over).toBe(false);
    expect(s.marks[0][5]).toBe(3);
  });

  it('is won on level points', () => {
    const s = cricket();
    s.marks[0] = [3, 3, 3, 3, 3, 2, 3];
    s.scores = [30, 30];
    expect(play(s, 0, [15, 'single']).winner).toBe(0);
  });

  it('a solo player wins by closing every target', () => {
    let s = game({ mode: 'cricket' }, 1);
    s.marks[0] = [3, 3, 3, 3, 3, 3, 2];
    s = play(s, 0, 'outer');
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('can be decided on points after a round limit', () => {
    let s = game({ mode: 'cricket', maxRounds: 1 });
    s = next(play(s, 0, [20, 'triple'], [20, 'triple'], 'miss'), 0);
    s = next(play(s, 1, [15, 'single'], 'miss', 'miss'), 1);
    expect(s.over).toBe(true);
    expect(s.endReason).toBe('rounds');
    expect(s.winner).toBe(0);
  });
});

describe('the room around the game', () => {
  it('plays alone and with up to four', () => {
    expect(g.minPlayers).toBe(1);
    expect(g.maxPlayers).toBe(4);
    for (const n of [1, 2, 3, 4]) {
      expect(start(n, undefined, {}).scores).toHaveLength(n);
    }
  });

  it('rotates through four players', () => {
    let s = start(4, undefined, { throwMode: 'casual' });
    for (let seat = 0; seat < 4; seat++) {
      s = next(play(s, seat, 'miss', 'miss', 'miss'), seat);
    }
    expect(s.turn).toBe(0);
    expect(s.round).toBe(2);
  });

  it('a solo game just keeps coming back to you', () => {
    let s = start(1, undefined, {});
    s = next(play(s, 0, 'miss', 'miss', 'miss'), 0);
    expect(s.turn).toBe(0);
    expect(s.round).toBe(2);
  });

  it('plays a turn for someone who ran out of time', () => {
    let s = game();
    const auto = g.autoMove!(s, 0) as { type: string };
    s = g.move(s, 0, auto, exact);
    expect(s.throws[0].label).toBe('Miss');
    expect(g.waiting!(s)).toEqual({ seats: [0], seconds: 45 });
    s = play(s, 0, 'miss', 'miss');
    expect(g.autoMove!(s, 0)).toEqual({ type: 'next' });
  });

  it('a player who leaves is skipped, and the last one left wins', () => {
    let s = start(3, undefined, {});
    s = g.eliminate!(s, 1);
    expect(s.dropped).toEqual([1]);
    s = next(play(s, 0, 'miss', 'miss', 'miss'), 0);
    expect(s.turn).toBe(2);
    s = g.eliminate!(s, 2);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('left');
  });

  it('hands the turn on when the player whose turn it is leaves', () => {
    let s = start(3, undefined, { throwMode: 'casual', mode: '501' });
    s = play(s, 0, [20, 'triple']);
    s = g.eliminate!(s, 0);
    expect(s.turn).toBe(1);
    expect(s.throws).toHaveLength(0);
  });

  it('shows everyone the same board: nothing is hidden', () => {
    const s = play(game(), 0, [20, 'triple']);
    const a = view(s, 0);
    const b = view(s, 1);
    expect({ ...a, you: 0 }).toEqual({
      ...b,
      you: 0,
      checkout: a.checkout,
      elapsed: a.elapsed,
    });
    expect(b.you).toBe(1);
  });

  it('can be played again with the same settings', () => {
    const s = play(game({ mode: '301' }), 0, [20, 'triple']);
    const again = g.restart(s, 2);
    expect(again.config.mode).toBe('301');
    expect(again.scores).toEqual([301, 301]);
    expect(again.history).toEqual([]);
  });

  it('plays a whole 301 match start to finish', () => {
    // each player throws T20 x3, then finish: 301 - 180 = 121 → 60+... we use a bot
    let s = start(2, undefined, { mode: '301', throwMode: 'casual' });
    let guard = 0;
    while (!s.over && guard++ < 200) {
      const seat = s.turn;
      const left = s.scores[seat];
      const shots = suggestCheckout(left, 3 - s.throws.length, true);
      const aim: Aim =
        shots && shots.length
          ? (() => {
              const l = shots[0];
              if (l === 'Bull') return 'bull';
              if (l[0] === 'D') return [Number(l.slice(1)), 'double'];
              if (l[0] === 'T') return [Number(l.slice(1)), 'triple'];
              return [Number(l), 'single'];
            })()
          : left > 60
            ? [20, 'triple']
            : [1, 'single'];
      s = play(s, seat, aim);
      if (s.turnDone && !s.over) s = next(s, seat);
    }
    expect(s.over).toBe(true);
    expect(s.winner).not.toBeNull();
    expect(s.scores[s.winner!]).toBe(0);
  });
});
