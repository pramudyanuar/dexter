/** @jest-environment node */
import {
  canPlay,
  Card,
  Color,
  COLORS,
  deck,
  HAND_SIZE,
  shuffle,
  stackable,
  start,
  unoGame,
  UnoState,
  UnoView,
} from '@/lib/games/uno';
import { RoomError } from '@/lib/rooms/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 'R5' red five, 'YS' yellow skip, 'GV' green reverse, 'BD' blue draw two, 'WW' wild, 'WF' wild draw four */
const c = (code: string): Card => ({
  c: code[0] as Card['c'],
  v: code[1] as Card['v'],
});
const key = (card: Card) => `${card.c}${card.v}`;

function game(opts: {
  hands: string[][];
  top?: string;
  color?: Color;
  turn?: number;
  dir?: 1 | -1;
  draw?: string[];
}): UnoState {
  const top = c(opts.top ?? 'R5');
  return {
    players: opts.hands.length,
    hands: opts.hands.map((h) => h.map(c)),
    draw: (
      opts.draw ?? [
        'G1',
        'G2',
        'G3',
        'G4',
        'G5',
        'G6',
        'G7',
        'G8',
        'G9',
        'B1',
        'B2',
        'B3',
      ]
    ).map(c),
    discard: [top],
    turn: opts.turn ?? 0,
    dir: opts.dir ?? 1,
    color: opts.color ?? (top.c === 'W' ? 'R' : top.c),
    winner: null,
    pending: null,
    last: null,
  };
}

const rng = seeded(7);
const move = (s: UnoState, seat: number, m: unknown) =>
  unoGame.move(s, seat, m, rng);
const play = (s: UnoState, seat: number, index: number, color?: Color) =>
  move(s, seat, { type: 'play', index, color });
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RoomError
      ? { message: e.message, status: e.status }
      : { message: String(e), status: -1 };
  }
  return null;
};
const view = (s: UnoState, seat: number | null) =>
  unoGame.view(s, seat) as UnoView;

describe('deck', () => {
  it('is the standard 108 cards', () => {
    const cards = deck();
    expect(cards).toHaveLength(108);
    const count = (pred: (card: Card) => boolean) => cards.filter(pred).length;
    expect(count((x) => x.v === '0')).toBe(4);
    expect(count((x) => /[1-9]/.test(x.v))).toBe(72);
    for (const v of ['S', 'V', 'D']) expect(count((x) => x.v === v)).toBe(8);
    expect(count((x) => x.v === 'W')).toBe(4);
    expect(count((x) => x.v === 'F')).toBe(4);
    for (const color of COLORS) expect(count((x) => x.c === color)).toBe(25);
  });

  it('shuffles without losing or duplicating cards', () => {
    const shuffled = shuffle(deck(), seeded(3));
    expect(shuffled.map(key).sort()).toEqual(deck().map(key).sort());
    expect(shuffled.map(key)).not.toEqual(deck().map(key));
  });
});

describe('start', () => {
  it.each([2, 3, 4])(
    'deals %d hands of seven and opens with a number card',
    (players) => {
      for (let seed = 1; seed <= 40; seed++) {
        const s = start(players, seeded(seed));
        expect(s.hands).toHaveLength(players);
        s.hands.forEach((h) => expect(h).toHaveLength(HAND_SIZE));
        expect(s.discard).toHaveLength(1);
        expect(s.discard[0].v).toMatch(/^[0-9]$/);
        expect(s.color).toBe(s.discard[0].c);
        expect(s.draw).toHaveLength(108 - players * HAND_SIZE - 1);
        expect([s.turn, s.dir, s.winner, s.pending]).toEqual([
          0,
          1,
          null,
          null,
        ]);
      }
    },
  );
});

describe('what can be played', () => {
  const s = game({ hands: [[]], top: 'R5', color: 'R' });

  it('matches colour or value', () => {
    expect(canPlay(s, c('R9'), [])).toBe(true); // colour
    expect(canPlay(s, c('B5'), [])).toBe(true); // value
    expect(canPlay(s, c('B9'), [])).toBe(false);
  });

  it('lets a wild go on anything', () => {
    expect(canPlay(s, c('WW'), [c('R1')])).toBe(true);
  });

  it('only allows wild draw four with no card of the current colour', () => {
    expect(canPlay(s, c('WF'), [c('R1'), c('WF')])).toBe(false);
    expect(canPlay(s, c('WF'), [c('B1'), c('WF')])).toBe(true);
    // wilds do not count as "having the colour"
    expect(canPlay(s, c('WF'), [c('WW'), c('WF')])).toBe(true);
  });

  it('follows the chosen colour after a wild', () => {
    const afterWild = game({ hands: [[]], top: 'WW', color: 'B' });
    expect(canPlay(afterWild, c('B3'), [])).toBe(true);
    expect(canPlay(afterWild, c('R3'), [])).toBe(false);
  });

  it('matches action cards by symbol across colours', () => {
    const skip = game({ hands: [[]], top: 'RS', color: 'R' });
    expect(canPlay(skip, c('GS'), [])).toBe(true);
    expect(canPlay(skip, c('G5'), [])).toBe(false);
  });
});

describe('playing a card', () => {
  it('moves it to the pile, sets the colour, and passes the turn', () => {
    const next = play(game({ hands: [['R9', 'B1'], ['G1'], ['G2']] }), 0, 0);
    expect(next.hands[0].map(key)).toEqual(['B1']);
    expect(key(next.discard[next.discard.length - 1])).toBe('R9');
    expect(next.turn).toBe(1);
    expect(next.last).toMatchObject({
      seat: 0,
      kind: 'play',
      card: { c: 'R', v: '9' },
    });
  });

  it('rejects an illegal card, a missing card, and playing out of turn', () => {
    const s = game({ hands: [['B9', 'R1'], ['R2']] });
    expect(errorOf(() => play(s, 0, 0))).toMatchObject({ status: 400 });
    expect(errorOf(() => play(s, 0, 5))).toMatchObject({ status: 400 });
    expect(errorOf(() => play(s, 0, -1))).toMatchObject({ status: 400 });
    expect(errorOf(() => play(s, 0, 1.5))).toMatchObject({ status: 400 });
    expect(errorOf(() => play(s, 1, 0))).toMatchObject({ status: 409 });
  });

  it('does not change the state it was given', () => {
    const s = game({ hands: [['R9', 'B1'], ['G1']] });
    const before = JSON.stringify(s);
    play(s, 0, 0);
    move(s, 0, { type: 'draw' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects unknown moves', () => {
    const s = game({ hands: [['R9'], ['G1']] });
    for (const bad of [null, 'play', { type: 'explode' }, 5, {}]) {
      expect(errorOf(() => move(s, 0, bad))?.status).toBe(400);
    }
  });
});

describe('action cards', () => {
  it('skip passes over the next player', () => {
    const next = play(game({ hands: [['RS', 'R1'], ['G1'], ['G2']] }), 0, 0);
    expect(next.turn).toBe(2);
  });

  it('skip wraps around the table', () => {
    const next = play(
      game({ hands: [['G1'], ['G2'], ['RS', 'R1']], turn: 2 }),
      2,
      0,
    );
    expect(next.turn).toBe(1);
  });

  it('reverse flips the direction with three or more players', () => {
    const next = play(game({ hands: [['RV', 'R1'], ['G1'], ['G2']] }), 0, 0);
    expect(next.dir).toBe(-1);
    expect(next.turn).toBe(2); // counter-clockwise from seat 0 is seat 2
    // and keeps going that way
    const after = play(
      { ...next, hands: [next.hands[0], next.hands[1], [c('R2'), c('R3')]] },
      2,
      0,
    );
    expect(after.turn).toBe(1);
  });

  it('reverse acts like a skip with two players', () => {
    const next = play(game({ hands: [['RV', 'R1'], ['G1']] }), 0, 0);
    expect(next.turn).toBe(0);
  });

  it('draw two makes the next player draw and lose their turn', () => {
    const next = play(game({ hands: [['RD', 'R1'], ['G1'], ['G2']] }), 0, 0);
    expect(next.hands[1]).toHaveLength(3);
    expect(next.turn).toBe(2);
    expect(next.draw).toHaveLength(10);
  });

  it('wild sets the colour and passes the turn', () => {
    const next = play(game({ hands: [['WW', 'R1'], ['G1']] }), 0, 0, 'B');
    expect(next.color).toBe('B');
    expect(next.turn).toBe(1);
    expect(next.last).toMatchObject({ kind: 'play', color: 'B' });
  });

  it('wild needs a valid colour', () => {
    const s = game({ hands: [['WW', 'R1'], ['G1']] });
    expect(errorOf(() => play(s, 0, 0))?.status).toBe(400);
    expect(errorOf(() => play(s, 0, 0, 'X' as Color))?.status).toBe(400);
  });

  it('wild draw four makes the next player draw four and sets the colour', () => {
    const next = play(
      game({ hands: [['WF', 'B1'], ['G1'], ['G2']] }),
      0,
      0,
      'Y',
    );
    expect(next.hands[1]).toHaveLength(5);
    expect(next.color).toBe('Y');
    expect(next.turn).toBe(2);
  });

  it('wild draw four is refused while holding the current colour', () => {
    const s = game({ hands: [['WF', 'R1'], ['G1']] });
    expect(errorOf(() => play(s, 0, 0, 'Y'))).toMatchObject({ status: 400 });
    expect(errorOf(() => play(s, 0, 0, 'Y'))?.message).toMatch(/Wild \+4/);
  });
});

describe('drawing', () => {
  it('passes the turn when the drawn card cannot be played', () => {
    const s = game({ hands: [['B9'], ['G1']], draw: ['G2', 'Y9'] }); // Y9 is drawn first
    const next = move(s, 0, { type: 'draw' });
    expect(next.hands[0].map(key)).toEqual(['B9', 'Y9']);
    expect(next.turn).toBe(1);
    expect(next.pending).toBeNull();
    expect(next.last).toMatchObject({ kind: 'draw', passed: true });
  });

  it('lets the player play or pass when the drawn card fits', () => {
    const s = game({ hands: [['B9'], ['G1']], draw: ['G2', 'R7'] });
    const drew = move(s, 0, { type: 'draw' });
    expect(drew.turn).toBe(0);
    expect(drew.pending).toEqual({ seat: 0, index: 1 });

    // only the drawn card may be played now
    expect(errorOf(() => play(drew, 0, 0))?.status).toBe(400);
    expect(play(drew, 0, 1).discard.map(key).pop()).toBe('R7');
    // or they may keep it and pass
    const passed = move(drew, 0, { type: 'pass' });
    expect(passed.turn).toBe(1);
    expect(passed.hands[0]).toHaveLength(2);
    expect(passed.pending).toBeNull();
  });

  it('cannot draw twice in a turn or pass without drawing', () => {
    const s = game({ hands: [['B9'], ['G1']], draw: ['G2', 'R7'] });
    const drew = move(s, 0, { type: 'draw' });
    expect(errorOf(() => move(drew, 0, { type: 'draw' }))?.status).toBe(409);
    expect(errorOf(() => move(s, 0, { type: 'pass' }))?.status).toBe(409);
  });

  it('reshuffles the discard pile when the deck runs out, keeping the top card', () => {
    const s: UnoState = {
      ...game({ hands: [['B9'], ['G1']], draw: [] }),
      discard: ['G3', 'G4', 'G5', 'R5'].map(c),
    };
    const next = move(s, 0, { type: 'draw' });
    expect(next.hands[0]).toHaveLength(2);
    expect(next.discard.map(key)).toEqual(['R5']);
    expect(next.draw).toHaveLength(2);
  });

  it('simply passes when there is nothing left to draw', () => {
    const s = game({ hands: [['B9'], ['G1']], draw: [] });
    const next = move(s, 0, { type: 'draw' });
    expect(next.hands[0]).toHaveLength(1);
    expect(next.turn).toBe(1);
  });
});

describe('winning', () => {
  it('goes to whoever plays their last card, and ends the game', () => {
    const s = game({ hands: [['R9'], ['G1', 'G2']] });
    const won = play(s, 0, 0);
    expect(won.winner).toBe(0);
    expect(unoGame.isOver(won)).toBe(true);
    expect(unoGame.isOver(s)).toBe(false);
  });

  it('starts the next game with the winner', () => {
    const won = play(game({ hands: [['R9'], ['G1', 'G2']] }), 0, 0);
    expect(unoGame.restart(won, 2, seeded(1)).turn).toBe(0);
    const won1 = play(game({ hands: [['G1'], ['R9']], turn: 1 }), 1, 0);
    const again = unoGame.restart(won1, 2, seeded(1));
    expect(again.turn).toBe(1);
    expect(again.hands.every((h) => h.length === HAND_SIZE)).toBe(true);
  });
});

describe('what each seat can see', () => {
  const s = game({
    hands: [['R9', 'B1', 'WF'], ['G1', 'G2'], ['Y3']],
    turn: 0,
  });

  it('shows a player their own hand and only the counts of the others', () => {
    const mine = view(s, 0);
    expect(mine.hand.map(key)).toEqual(['R9', 'B1', 'WF']);
    expect(mine.counts).toEqual([3, 2, 1]);

    const theirs = JSON.stringify(view(s, 1));
    expect(theirs).not.toContain('"R9"');
    expect(view(s, 1).hand.map(key)).toEqual(['G1', 'G2']);
  });

  it('never exposes other hands or the draw pile in any form', () => {
    for (const seat of [0, 1, 2, null]) {
      const json = JSON.stringify(view(s, seat));
      expect(json).not.toContain('hands');
      expect(Object.keys(view(s, seat))).not.toContain('draw');
      expect(view(s, seat).drawCount).toBe(s.draw.length);
    }
    // a spectator sees no hand at all
    expect(view(s, null).hand).toEqual([]);
    expect(view(s, null).playable).toEqual([]);
  });

  it('lists the playable cards only on your own turn', () => {
    expect(view(s, 0).playable).toEqual([0]); // R9; B1 no; WF illegal while holding red
    expect(view(s, 0).canDraw).toBe(true);
    expect(view(s, 1).playable).toEqual([]);
    expect(view(s, 1).canDraw).toBe(false);
  });

  it('after a draw, only the drawn card is offered, plus the option to pass', () => {
    const drew = move(
      game({ hands: [['B9'], ['G1']], draw: ['G2', 'R7'] }),
      0,
      { type: 'draw' },
    );
    const mine = view(drew, 0);
    expect(mine.playable).toEqual([1]);
    expect(mine.canPass).toBe(true);
    expect(mine.canDraw).toBe(false);
  });

  it('offers nothing once the game is over', () => {
    const won = play(game({ hands: [['R9'], ['G1']] }), 0, 0);
    expect(view(won, 1).playable).toEqual([]);
    expect(view(won, 1).canDraw).toBe(false);
  });
});

describe('whole games', () => {
  /** A bot that always makes some legal move, to exercise the rules at scale. */
  function playOut(players: number, seed: number) {
    const rand = seeded(seed);
    let s = start(players, rand);
    const reference = deck().map(key).sort().join();
    let steps = 0;

    while (!unoGame.isOver(s) && steps++ < 8000) {
      const seat = s.turn;
      if (s.places?.includes(seat))
        throw new Error(`turn went to finished seat ${seat}`);
      const v = view(s, seat);
      let m: unknown;
      if (v.playable.length) {
        const index = v.playable[Math.floor(rand() * v.playable.length)];
        const card = v.hand[index];
        m = {
          type: 'play',
          index,
          color: card.c === 'W' ? COLORS[Math.floor(rand() * 4)] : undefined,
        };
      } else if (v.canPass) {
        m = { type: 'pass' };
      } else {
        m = { type: 'draw' };
      }
      s = unoGame.move(s, seat, m, rand);

      // no card is ever lost or duplicated, whatever happens
      const all = [...s.hands.flat(), ...s.draw, ...s.discard]
        .map(key)
        .sort()
        .join();
      if (all !== reference)
        throw new Error(`cards changed at step ${steps} (seed ${seed})`);
      if (
        s.hands.some((h, seat) => h.length === 0 && !s.places?.includes(seat))
      )
        throw new Error('empty hand without a place');
    }
    if (unoGame.isOver(s)) {
      // everyone is ranked exactly once
      expect([...s.places!].sort()).toEqual(
        Array.from({ length: players }, (_, i) => i),
      );
      expect(s.winner).toBe(s.places![0]);
    }
    return unoGame.isOver(s);
  }

  it.each([2, 3, 4])(
    'keeps all 108 cards and plays on until everyone is ranked (%d players)',
    (players) => {
      let finished = 0;
      for (let seed = 1; seed <= 25; seed++) {
        if (playOut(players, seed)) finished++;
      }
      expect(finished).toBeGreaterThanOrEqual(24);
    },
  );
});

describe('playing on after a winner', () => {
  const three = (
    hands: string[][],
    extra: Partial<UnoState> = {},
  ): UnoState => ({
    ...game({ hands, top: 'R5' }),
    places: [],
    ...extra,
  });

  it('keeps the game going for the others when one player runs out', () => {
    const s = play(three([['R1'], ['B2', 'R7'], ['G3', 'R8']]), 0, 0);
    expect(s.winner).toBe(0);
    expect(s.places).toEqual([0]);
    expect(unoGame.isOver(s)).toBe(false);
    expect(s.turn).toBe(1);

    const v = view(s, 0);
    expect([v.places, v.playable, v.canDraw]).toEqual([[0], [], false]);
    expect(errorOf(() => move(s, 0, { type: 'draw' }))?.status).toBe(409);
  });

  it('skips finished players when passing the turn', () => {
    let s = three(
      [
        ['R1', 'R2'],
        ['R7', 'R9'],
        ['R8', 'R3'],
      ],
      {
        places: [1],
        hands: [[c('R1'), c('R2')], [], [c('R8'), c('R3')]],
      },
    );
    s = play(s, 0, 0);
    expect(s.turn).toBe(2);
    s = play(s, 2, 0);
    expect(s.turn).toBe(0);
  });

  it('ends once only one player still has cards, and ranks them last', () => {
    let s = play(three([['R1'], ['R7'], ['G3', 'B8']]), 0, 0);
    s = play(s, 1, 0);
    expect(unoGame.isOver(s)).toBe(true);
    expect(s.places).toEqual([0, 1, 2]);
    expect(s.winner).toBe(0);
  });

  it('applies a finishing action card to the next player still in', () => {
    const s = play(three([['RD'], ['B2', 'B4'], ['G3', 'G4']]), 0, 0);
    expect(s.hands[1]).toHaveLength(4); // drew two
    expect(s.turn).toBe(2); // and was skipped
  });

  it('treats a reverse as a skip when two players are left', () => {
    const s = play(
      three([['RV', 'R2'], [], ['G3', 'G4']], {
        places: [1],
        hands: [[c('RV'), c('R2')], [], [c('G3'), c('G4')]],
      }),
      0,
      0,
    );
    expect(s.turn).toBe(0);
  });

  it('lets the first winner open the next round', () => {
    let s = play(three([['R7'], ['R1'], ['R3', 'B8']], { turn: 1 }), 1, 0);
    s = play(s, 2, 0);
    s = play(s, 0, 0);
    expect(unoGame.isOver(s)).toBe(true);
    expect(s.places).toEqual([1, 0, 2]);
    const next = unoGame.restart(s, 3, rng);
    expect([next.turn, next.winner, next.places]).toEqual([1, null, []]);
  });
});

describe('with nothing to play', () => {
  it('says so, and drawing an unplayable card passes the turn', () => {
    const s = game({
      hands: [['B2', 'G7'], ['R1']],
      top: 'R5',
      draw: ['Y9'],
    });
    const v = view(s, 0);
    expect([v.stuck, v.canDraw, v.playable]).toEqual([true, true, []]);

    const next = move(s, 0, { type: 'draw' });
    expect(next.hands[0]).toHaveLength(3);
    expect(next.turn).toBe(1);
    expect(next.last).toEqual({
      seat: 0,
      kind: 'draw',
      passed: true,
      drew: { seat: 0, count: 1 },
    });
  });

  it('is not stuck after drawing a card that fits', () => {
    const s = move(
      game({ hands: [['B2'], ['R1']], top: 'R5', draw: ['R9'] }),
      0,
      { type: 'draw' },
    );
    const v = view(s, 0);
    expect([v.stuck, v.canPass, v.playable]).toEqual([false, true, [1]]);
  });
});

describe('stacking the same number', () => {
  const play3 = (s: UnoState, seat: number, index: number, also: number[]) =>
    move(s, seat, { type: 'play', index, also });

  it('plays every card of the stack in one turn, last colour counts', () => {
    const s = game({
      hands: [['R7', 'B7', 'G7', 'Y2'], ['R1'], ['B1']],
      top: 'R5',
    });
    const next = play3(s, 0, 0, [2, 1]);
    expect(next.hands[0].map(key)).toEqual(['Y2']);
    expect(next.discard.slice(-3).map(key)).toEqual(['R7', 'G7', 'B7']);
    expect(next.color).toBe('B');
    expect(next.turn).toBe(1);
    expect(next.last?.cards?.map(key)).toEqual(['R7', 'G7', 'B7']);
    expect(key(next.last!.card!)).toBe('B7');
  });

  it('only needs the first card to fit', () => {
    const s = game({ hands: [['B5', 'G5'], ['R1']], top: 'R5', color: 'R' });
    // B5 fits by number; G5 rides along
    expect(play3(s, 0, 1, [0]).color).toBe('B');
    expect(
      errorOf(() => play3(game({ hands: [['B7', 'G7'], ['R1']] }), 0, 0, [1])),
    ).toMatchObject({ status: 400 });
  });

  it('wins when the stack empties the hand', () => {
    const s = { ...game({ hands: [['R7', 'Y7'], ['R1']] }), places: [] };
    const next = play3(s, 0, 0, [1]);
    expect(next.winner).toBe(0);
    expect(unoGame.isOver(next)).toBe(true);
  });

  it('rejects different numbers, action cards, repeats and bad indexes', () => {
    const s = game({ hands: [['R7', 'B8', 'RS', 'BS', 'G7'], ['R1']] });
    for (const also of [[1], [4, 4], [0], [9], ['x'], 'nope']) {
      expect(
        errorOf(() => move(s, 0, { type: 'play', index: 0, also })),
      ).toMatchObject({ status: 400 });
    }
    const skip = game({ hands: [['RS', 'BS'], ['R1']] });
    expect(errorOf(() => play3(skip, 0, 0, [1]))?.message).toMatch(/angka/);
  });

  it('is not allowed with the card just drawn', () => {
    const s = move(game({ hands: [['B9', 'G7'], ['R1']], draw: ['R7'] }), 0, {
      type: 'draw',
    });
    expect(errorOf(() => play3(s, 0, 2, [1]))?.message).toMatch(/menarik/);
  });

  it('lists what can be stacked on a card', () => {
    const hand = ['R7', 'B7', 'RS', 'G7', 'Y1'].map(c);
    expect(stackable(hand, 0)).toEqual([1, 3]);
    expect(stackable(hand, 2)).toEqual([]);
    expect(stackable(hand, 4)).toEqual([]);
  });
});

describe('calling UNO and catching', () => {
  const callUno = (s: UnoState, seat: number) => move(s, seat, { type: 'uno' });
  const doCatch = (s: UnoState, seat: number, target: number) =>
    move(s, seat, { type: 'catch', target });

  it('a player on two cards can pre-call, then play down to one safely', () => {
    let s: UnoState = {
      ...game({ hands: [['R1', 'R2'], ['B1']], top: 'R5' }),
      calledUno: [false, false],
    };
    s = callUno(s, 0);
    expect(s.calledUno).toEqual([true, false]);
    s = play(s, 0, 0); // down to one card, R2
    const v = view(s, 1);
    expect(v.counts[0]).toBe(1);
    expect(v.catchable).toEqual([]); // called, so safe
    expect(errorOf(() => doCatch(s, 1, 0))?.status).toBe(409);
  });

  it('a player who reaches one card without calling can be caught for two', () => {
    let s: UnoState = {
      ...game({
        hands: [
          ['R1', 'R2'],
          ['B1', 'B2', 'B3'],
        ],
        top: 'R5',
      }),
      calledUno: [false, false],
    };
    s = play(s, 0, 0); // down to one, never called
    expect(view(s, 1).catchable).toEqual([0]);
    s = doCatch(s, 1, 0);
    expect(s.hands[0]).toHaveLength(3); // drew two
    expect(view(s, 1).catchable).toEqual([]); // no longer on one card
    expect(s.last).toMatchObject({ seat: 1, kind: 'catch', target: 0 });
  });

  it('a belated UNO call before being caught keeps you safe', () => {
    let s: UnoState = {
      ...game({ hands: [['R1', 'R2'], ['B1']], top: 'R5' }),
      calledUno: [false, false],
    };
    s = play(s, 0, 0); // one card, uncalled
    s = callUno(s, 0); // call late, off-turn
    expect(view(s, 1).catchable).toEqual([]);
    expect(errorOf(() => doCatch(s, 1, 0))?.status).toBe(409);
  });

  it('drawing back up clears the call', () => {
    let s: UnoState = {
      ...game({ hands: [['R1', 'R2'], ['B1']], top: 'G9', draw: ['B7'] }),
      calledUno: [false, false],
    };
    s = callUno(s, 0);
    s = move(s, 0, { type: 'draw' }); // nothing fits R/color G, goes to two cards... actually draws
    expect(s.hands[0].length).toBeGreaterThan(1);
    expect(s.calledUno?.[0]).toBe(false);
  });

  it('rejects UNO with more than two cards and bad catch targets', () => {
    const s: UnoState = {
      ...game({ hands: [['R1', 'R2', 'R3'], ['B1']], top: 'R5' }),
      calledUno: [false, false],
    };
    expect(errorOf(() => callUno(s, 0))?.status).toBe(400);
    const one: UnoState = {
      ...game({ hands: [['R1'], ['B1', 'B2']], top: 'R5' }),
      calledUno: [false, false],
    };
    expect(errorOf(() => doCatch(one, 1, 1))?.status).toBe(400); // catch self
    expect(errorOf(() => doCatch(one, 1, 9))?.status).toBe(400); // no such seat
    expect(errorOf(() => doCatch(one, 0, 1))?.status).toBe(409); // target has two cards
  });

  it('the view offers a shout while on one or two cards', () => {
    const s: UnoState = {
      ...game({ hands: [['R1', 'R2'], ['B1']], top: 'R5' }),
      calledUno: [false, false],
    };
    expect(view(s, 0).canCallUno).toBe(true);
    const three: UnoState = {
      ...game({ hands: [['R1', 'R2', 'R3'], ['B1']], top: 'R5' }),
      calledUno: [false, false],
    };
    expect(view(three, 0).canCallUno).toBe(false);
  });

  it('exposes the recent discards for a stacked pile', () => {
    const s = game({ hands: [['R1'], ['B1']], top: 'R5', draw: ['G1'] });
    s.discard = [c('R2'), c('R3'), c('R5')];
    expect(view(s, 0).pile.map(key)).toEqual(['R2', 'R3', 'R5']);
  });
});

describe('cards drawn are reported for animation', () => {
  it('a plus two records the victim and count', () => {
    const s = play(
      game({
        hands: [
          ['BD', 'Y1'],
          ['R1', 'R2'],
        ],
        top: 'B9',
      }),
      0,
      0,
    );
    expect(s.last?.drew).toEqual({ seat: 1, count: 2 });
  });

  it('a wild plus four records four cards for the next player', () => {
    const s = play(
      game({
        hands: [
          ['WF', 'Y1'],
          ['R1', 'R2'],
        ],
        top: 'R5',
        color: 'G',
      }),
      0,
      0,
      'B',
    );
    expect(s.last?.drew).toEqual({ seat: 1, count: 4 });
  });

  it('a plain draw records one card for the drawer', () => {
    const s = move(
      game({ hands: [['B2'], ['R1']], top: 'R5', draw: ['Y9'] }),
      0,
      {
        type: 'draw',
      },
    );
    expect(s.last?.drew).toEqual({ seat: 0, count: 1 });
  });

  it('a catch makes the caught player draw two, reported too', () => {
    let s = {
      ...game({
        hands: [
          ['R1', 'R2'],
          ['B1', 'B2', 'B3'],
        ],
        top: 'R5',
      }),
      calledUno: [false, false],
    } as UnoState;
    s = play(s, 0, 0); // seat 0 to one card, uncalled
    s = move(s, 1, { type: 'catch', target: 0 });
    expect(s.last?.drew).toEqual({ seat: 0, count: 2 });
  });
});
