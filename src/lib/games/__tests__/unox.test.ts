/** @jest-environment node */
import { Card } from '@/lib/games/uno';
import {
  flipDeck,
  makeGame,
  makeStart,
  MERCY_LIMIT,
  noMercyDeck,
  Side,
  UnoXView,
  Variant,
  XCard,
  XState,
} from '@/lib/games/unox';
import { RoomError } from '@/lib/rooms/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 'R5' red five, 'RD' red draw two, 'WW' wild. For Flip, 'R5/P3' = light/dark. */
const c = (code: string): Card => {
  const m = code.match(/^([A-Z])(\w+)$/)!;
  return { c: m[1] as Card['c'], v: m[2] as Card['v'] };
};
const x = (code: string): XCard => {
  const [l, d] = code.split('/');
  return { l: c(l), d: c(d ?? l) };
};
const key = (card: Card) => `${card.c}${card.v}`;

const flip = makeGame('flip', 'unoflip');
const mercy = makeGame('nomercy', 'unomercy');

function game(
  variant: Variant,
  opts: {
    hands: string[][];
    top?: string;
    color?: Card['c'];
    turn?: number;
    side?: Side;
    penalty?: number;
    draw?: string[];
  },
): XState {
  const top = x(opts.top ?? (variant === 'flip' ? 'R5/P5' : 'R5'));
  return {
    variant,
    players: opts.hands.length,
    hands: opts.hands.map((h) => h.map(x)),
    draw: (opts.draw ?? Array(40).fill('G1/T1')).map(x),
    discard: [top],
    side: opts.side ?? 'light',
    turn: opts.turn ?? 0,
    dir: 1,
    color: (opts.color ?? (opts.side === 'dark' ? 'P' : 'R')) as never,
    winner: null,
    places: [],
    dropped: [],
    pending: null,
    penalty: opts.penalty ?? 0,
    calledUno: Array(opts.hands.length).fill(false),
    last: null,
  };
}

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RoomError;
  }
  return undefined;
};
const f = (s: XState, seat: number, m: unknown) => flip.move(s, seat, m);
const n = (s: XState, seat: number, m: unknown) => mercy.move(s, seat, m);
const view = (g: typeof flip, s: XState, seat: number | null) =>
  g.view(s, seat) as UnoXView;

describe('decks', () => {
  it('Flip has 112 double-sided cards, light and dark', () => {
    const deck = flipDeck(seeded(1));
    expect(deck).toHaveLength(112);
    expect(deck.filter((d) => d.l.c !== 'W')).toHaveLength(104);
    expect(deck.filter((d) => d.l.c === 'W')).toHaveLength(8);
    expect(deck.filter((d) => d.l.v === 'L')).toHaveLength(8);
    // the dark side is its own set of colours and cards
    expect(
      new Set(deck.filter((d) => d.d.c !== 'W').map((d) => d.d.c)),
    ).toEqual(new Set(['P', 'T', 'O', 'U']));
    expect(deck.filter((d) => d.d.v === 'D5')).toHaveLength(8);
    expect(deck.filter((d) => d.d.v === 'SE')).toHaveLength(8);
    expect(deck.filter((d) => d.d.v === 'WDC')).toHaveLength(4);
    expect(deck.filter((d) => d.l.v === 'WD2')).toHaveLength(4);
  });

  it('No Mercy has 168 cards', () => {
    const deck = noMercyDeck();
    expect(deck).toHaveLength(168);
    expect(deck.filter((d) => d.l.v === 'W10')).toHaveLength(6);
    expect(deck.filter((d) => d.l.v === 'DA')).toHaveLength(12);
  });

  it('deals seven cards each and opens on a number', () => {
    for (const v of ['flip', 'nomercy'] as const) {
      const s = makeStart(v)(4, seeded(7));
      expect(s.hands.map((h) => h.length)).toEqual([7, 7, 7, 7]);
      expect(/^[0-9]$/.test(s.discard[0].l.v)).toBe(true);
      expect(s.hands.flat().length + s.draw.length + 1).toBe(
        v === 'flip' ? 112 : 168,
      );
    }
  });
});

describe('Flip', () => {
  it('a FLIP card turns every hand and the pile to the dark side', () => {
    const s = game('flip', {
      hands: [['RL/P2', 'R1/T9'], ['G1/O4']],
      top: 'R5/U7',
    });
    const done = f(s, 0, { type: 'play', index: 0 });
    expect(done.side).toBe('dark');
    // what is on top now is the dark face of the pile's top card (the FLIP's own back)
    expect(view(flip, done, 0).top).toEqual(c('P2'));
    expect(done.color).toBe('P');
    expect(view(flip, done, 0).hand.map(key)).toEqual(['T9']);
    expect(view(flip, done, 1).hand.map(key)).toEqual(['O4']);
    expect(done.last?.flipped).toBe('dark');
    expect(done.turn).toBe(1);
  });

  it('flips back to the light side', () => {
    const s = game('flip', {
      hands: [['R1/PL', 'R2/P2'], ['G1/O4']],
      side: 'dark',
      top: 'R5/P5',
      color: 'P',
    });
    const done = f(s, 0, { type: 'play', index: 0 });
    expect(done.side).toBe('light');
    expect(done.color).toBe('R');
  });

  it('light draw one makes the next player draw one and lose the turn', () => {
    const s = game('flip', {
      hands: [['RD1/P1', 'R2/P2'], ['G1/O4'], ['B1/U1']],
    });
    const done = f(s, 0, { type: 'play', index: 0 });
    expect(done.hands[1]).toHaveLength(2);
    expect(done.turn).toBe(2);
    expect(done.last?.drew).toEqual({ seat: 1, count: 1 });
  });

  it('dark draw five hits much harder', () => {
    const s = game('flip', {
      hands: [['R1/PD5', 'R2/P2'], ['G1/O4'], ['B1/U1']],
      side: 'dark',
      top: 'R5/P5',
      color: 'P',
    });
    const done = f(s, 0, { type: 'play', index: 0 });
    expect(done.hands[1]).toHaveLength(6);
    expect(done.turn).toBe(2);
  });

  it('skip everyone gives the same player another turn', () => {
    const s = game('flip', {
      hands: [['R1/PSE', 'R2/P2'], ['G1/O4'], ['B1/U1']],
      side: 'dark',
      top: 'R5/P5',
      color: 'P',
    });
    expect(f(s, 0, { type: 'play', index: 0 }).turn).toBe(0);
  });

  it('wild draw two needs a colour and makes the next player draw two', () => {
    const s = game('flip', {
      hands: [['WWD2/WWDC', 'R2/P2'], ['G1/O4'], ['B1/U1']],
    });
    expect(errorOf(() => f(s, 0, { type: 'play', index: 0 }))?.status).toBe(
      400,
    );
    // a dark colour is not a colour on the light side
    expect(
      errorOf(() => f(s, 0, { type: 'play', index: 0, color: 'P' }))?.status,
    ).toBe(400);
    const done = f(s, 0, { type: 'play', index: 0, color: 'B' });
    expect(done.color).toBe('B');
    expect(done.hands[1]).toHaveLength(3);
  });

  it('wild draw colour makes the victim draw until the colour comes up', () => {
    const s = game('flip', {
      hands: [['R1/WWDC', 'R2/P2'], ['G1/O4']],
      side: 'dark',
      top: 'R5/P5',
      color: 'P',
      draw: ['G1/T1', 'G1/T1', 'G1/O1', 'G1/T1'].reverse().concat([]),
    });
    // the pile is drawn from the end: T1, O1, T1, T1 → wait for orange
    const fixed = {
      ...s,
      draw: ['G1/T1', 'G1/T1', 'G1/O1', 'G1/T1', 'G1/T1'].map(x),
    };
    const done = f(fixed, 0, { type: 'play', index: 0, color: 'O' });
    // drew T1, T1, O1 (stops at the first orange)
    expect(done.hands[1]).toHaveLength(1 + 3);
    expect(done.hands[1].at(-1)!.d.c).toBe('O');
    expect(done.turn).toBe(0);
  });

  it('the dark side has its own colours and shows its own faces', () => {
    const s = game('flip', {
      hands: [['R1/P1', 'B9/T3'], ['G1/O1']],
      side: 'dark',
      top: 'R5/P5',
      color: 'P',
    });
    const v = view(flip, s, 0);
    expect(v.hand.map(key)).toEqual(['P1', 'T3']);
    expect(v.playable).toEqual([0]);
    expect(v.side).toBe('dark');
  });
});

describe('No Mercy', () => {
  it('stacks draw cards, and any draw card answers any other', () => {
    let s = game('nomercy', {
      hands: [['RD', 'R2'], ['BD4', 'B1'], ['GW6', 'G1'].map(() => 'WW6')],
    });
    s = n(s, 0, { type: 'play', index: 0 });
    expect(s.penalty).toBe(2);
    expect(s.turn).toBe(1);
    // a plain card cannot answer
    expect(errorOf(() => n(s, 1, { type: 'play', index: 1 }))?.status).toBe(
      400,
    );
    expect(view(mercy, s, 1).playable).toEqual([0]);
    // +4 on top of +2
    s = n(s, 1, { type: 'play', index: 0 });
    expect(s.penalty).toBe(6);
    expect(s.turn).toBe(2);
    // wild +6 on top of that
    s = n(s, 2, { type: 'play', index: 0, color: 'G' });
    expect(s.penalty).toBe(12);
    expect(s.color).toBe('G');
    expect(s.turn).toBe(0);
  });

  it('taking the stack draws all of it and loses the turn', () => {
    let s = game('nomercy', { hands: [['RD', 'R2'], ['B1'], ['G1']] });
    s = n(s, 0, { type: 'play', index: 0 });
    const done = n(s, 1, { type: 'draw' });
    expect(done.hands[1]).toHaveLength(3);
    expect(done.penalty).toBe(0);
    expect(done.turn).toBe(2);
    expect(done.last).toMatchObject({
      kind: 'take',
      drew: { seat: 1, count: 2 },
    });
  });

  it('keeps drawing until a card fits', () => {
    const s = game('nomercy', {
      hands: [['B1'], ['G1']],
      draw: ['R7', 'Y1', 'G2', 'B3'],
    });
    // draw from the end: B3, G2, Y1, R7 → R7 is the first red one
    const done = n(s, 0, { type: 'draw' });
    expect(done.hands[0]).toHaveLength(5);
    expect(done.pending).toEqual({ seat: 0, index: 4 });
    expect(done.last?.drew).toEqual({ seat: 0, count: 4 });
  });

  it('a 7 swaps hands with a chosen player', () => {
    const s = game('nomercy', {
      hands: [['R7', 'B1'], ['G1', 'G2', 'G3'], ['Y1']],
    });
    expect(errorOf(() => n(s, 0, { type: 'play', index: 0 }))?.status).toBe(
      400,
    );
    expect(
      errorOf(() => n(s, 0, { type: 'play', index: 0, target: 0 }))?.status,
    ).toBe(400);
    const done = n(s, 0, { type: 'play', index: 0, target: 1 });
    expect(done.hands[0]).toHaveLength(3);
    expect(done.hands[1]).toHaveLength(1);
    expect(done.last?.swapped).toBe(1);
  });

  it('a 0 passes every hand to the next player', () => {
    const s = game('nomercy', {
      hands: [
        ['R0', 'B1'],
        ['G1', 'G2'],
        ['Y1', 'Y2', 'Y3'],
      ],
    });
    const done = n(s, 0, { type: 'play', index: 0 });
    // seat 0 had [B1] left → goes to seat 1; seat 1's two go to 2; seat 2's three go to 0
    expect(done.hands.map((h) => h.length)).toEqual([3, 1, 2]);
    expect(done.last?.rotated).toBe(true);
  });

  it('discard all drops every card of that colour', () => {
    const s = game('nomercy', {
      hands: [['RDA', 'R1', 'R2', 'B3'], ['G1']],
    });
    const done = n(s, 0, { type: 'play', index: 0 });
    expect(done.hands[0].map((h) => key(h.l))).toEqual(['B3']);
    expect(done.last?.dumped).toBe(2);
    expect(done.discard.at(-1)!.l.v).toBe('DA');
    expect(done.discard).toHaveLength(4);
  });

  it('skip everyone plays again, and reverse +4 turns the order round', () => {
    let s = game('nomercy', { hands: [['RSE', 'WWR4', 'R1'], ['G1'], ['B1']] });
    s = n(s, 0, { type: 'play', index: 0 });
    expect(s.turn).toBe(0);
    s = n(s, 0, { type: 'play', index: 0, color: 'B' });
    expect(s.dir).toBe(-1);
    expect(s.penalty).toBe(4);
    expect(s.turn).toBe(2);
  });

  it('colour roulette draws until the named colour', () => {
    const s = game('nomercy', {
      hands: [['WWRL', 'R1'], ['G1']],
      draw: ['Y1', 'G2', 'B3', 'R4'].reverse().reverse(),
    });
    // draw from the end: R4, B3, G2, Y1 → wait for blue: R4, B3
    const done = n(s, 0, { type: 'play', index: 0, color: 'B' });
    expect(done.hands[1]).toHaveLength(3);
    expect(done.turn).toBe(0);
  });

  it('knocks a player out at 25 cards', () => {
    const big = Array(MERCY_LIMIT - 2).fill('Y1');
    let s = game('nomercy', {
      hands: [['RD', 'R2'], ['B1', ...big], ['G1']],
    });
    s = n(s, 0, { type: 'play', index: 0 });
    const done = n(s, 1, { type: 'draw' });
    expect(done.dropped).toEqual([1]);
    expect(done.hands[1]).toHaveLength(0);
    expect(done.last?.mercy).toEqual([1]);
    expect(done.turn).toBe(2);
  });

  it('with two players left, the one who stays wins when the other is out', () => {
    let s = game('nomercy', {
      hands: [
        ['RD', 'R2'],
        ['B1', ...Array(23).fill('Y1')],
      ],
    });
    s = n(s, 0, { type: 'play', index: 0 });
    const done = n(s, 1, { type: 'draw' });
    expect(done.dropped).toEqual([1]);
    expect(mercy.isOver(done)).toBe(true);
    expect(done.winner).toBe(0);
    expect(done.places).toEqual([0, 1]);
  });

  it('an idle player takes the stack', () => {
    let s = game('nomercy', { hands: [['RD', 'R2'], ['B1'], ['G1']] });
    s = n(s, 0, { type: 'play', index: 0 });
    expect(mercy.autoMove!(s, 1)).toEqual({ type: 'draw' });
  });
});

describe('whole games', () => {
  function playOut(variant: Variant, players: number, seed: number) {
    const rand = seeded(seed);
    const g = variant === 'flip' ? flip : mercy;
    let s = g.start(players, rand);
    const total = variant === 'flip' ? 112 : 168;
    let steps = 0;
    while (!g.isOver(s) && steps++ < 6000) {
      const seat = s.turn;
      const v = view(g, s, seat);
      let m: unknown;
      if (v.playable.length) {
        const index = v.playable[Math.floor(rand() * v.playable.length)];
        const card = v.hand[index];
        const palette =
          v.side === 'dark' ? ['P', 'T', 'O', 'U'] : ['R', 'Y', 'G', 'B'];
        const others = s.hands.flatMap((h, i) =>
          i !== seat && !s.places.includes(i) && !s.dropped.includes(i)
            ? [i]
            : [],
        );
        m = {
          type: 'play',
          index,
          color: card.c === 'W' ? palette[Math.floor(rand() * 4)] : undefined,
          target: others[0],
        };
      } else if (v.canPass) m = { type: 'pass' };
      else m = { type: 'draw' };
      s = g.move(s, seat, m, rand);
      const all = s.hands.flat().length + s.draw.length + s.discard.length;
      if (all !== total)
        throw new Error(`cards changed at step ${steps} (seed ${seed})`);
    }
    return { s, g, steps };
  }

  it.each([2, 3, 4])('Flip plays on to the end with %i players', (players) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { s, g, steps } = playOut('flip', players, seed);
      expect(steps).toBeLessThan(6000);
      expect(g.isOver(s)).toBe(true);
    }
  });

  it.each([2, 3, 4])(
    'No Mercy plays on to the end with %i players',
    (players) => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const { s, g, steps } = playOut('nomercy', players, seed);
        expect(steps).toBeLessThan(6000);
        expect(g.isOver(s)).toBe(true);
      }
    },
  );
});
