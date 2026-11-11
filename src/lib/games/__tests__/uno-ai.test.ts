/** @jest-environment node */
import { Card, deck, start, unoGame, UnoState } from '@/lib/games/uno';
import { aiMove } from '@/lib/games/uno-ai';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const c = (code: string): Card => ({
  c: code[0] as Card['c'],
  v: code[1] as Card['v'],
});
const key = (card: Card) => `${card.c}${card.v}`;

function game(opts: {
  hands: string[][];
  top?: string;
  color?: Card['c'];
  draw?: string[];
}): UnoState {
  const top = c(opts.top ?? 'R5');
  return {
    players: opts.hands.length,
    hands: opts.hands.map((h) => h.map(c)),
    draw: (opts.draw ?? ['G1', 'G2', 'G3', 'B1', 'B2', 'B3']).map(c),
    discard: [top],
    turn: 0,
    dir: 1,
    color: (opts.color ?? (top.c === 'W' ? 'R' : top.c)) as UnoState['color'],
    winner: null,
    places: [],
    pending: null,
    calledUno: Array<boolean>(opts.hands.length).fill(false),
    last: null,
  };
}

describe('the UNO AI', () => {
  const rng = seeded(5);

  it('draws when nothing in hand fits', () => {
    const s = game({ hands: [['B2', 'G7']], top: 'R5', color: 'R' });
    expect(aiMove(s, 0, rng)).toEqual({ type: 'draw' });
  });

  it('plays a legal card, matching colour or number', () => {
    const s = game({ hands: [['B2', 'R9', 'G7']], top: 'R5', color: 'R' });
    const mv = aiMove(s, 0, rng) as { type: string; index: number };
    expect(mv.type).toBe('play');
    const card = s.hands[0][mv.index];
    expect(card.c === 'R' || card.v === '5').toBe(true);
  });

  it('prefers an action card over a plain number', () => {
    const s = game({ hands: [['R1', 'RD', 'R4']], top: 'R5', color: 'R' });
    const mv = aiMove(s, 0, rng) as { index: number };
    expect(key(s.hands[0][mv.index])).toBe('RD');
  });

  it('picks the colour it holds most of for a wild', () => {
    const s = game({
      hands: [['WW', 'B1', 'B7', 'G2']],
      top: 'R5',
      color: 'R',
    });
    const mv = aiMove(s, 0, rng) as { type: string; color?: string };
    expect(mv.type).toBe('play');
    expect(mv.color).toBe('B');
  });

  it('calls UNO before playing its second-to-last card', () => {
    const s = game({ hands: [['R1', 'G7']], top: 'R5', color: 'R' });
    expect(aiMove(s, 0, rng)).toEqual({ type: 'uno' });
  });

  it('plays the drawn card when it fits, otherwise passes', () => {
    const fits = {
      ...game({ hands: [['B2', 'R9']], top: 'R5', color: 'R' }),
      pending: { seat: 0, index: 1 },
    } as UnoState;
    expect(aiMove(fits, 0, rng)).toMatchObject({ type: 'play', index: 1 });
    const nofit = {
      ...game({ hands: [['B2', 'G9']], top: 'R5', color: 'R' }),
      pending: { seat: 0, index: 1 },
    } as UnoState;
    expect(aiMove(nofit, 0, rng)).toEqual({ type: 'pass' });
  });

  // the strongest guarantee: never produce a move the engine rejects, and
  // always drive a full game of AIs to a finish without getting stuck
  it.each([2, 3, 4, 6, 8])(
    'plays a whole game of %d AIs to the end, legally, keeping all 108 cards',
    (players) => {
      let finished = 0;
      for (let seed = 1; seed <= 15; seed++) {
        const rand = seeded(seed * 97 + players);
        let s = start(players, rand);
        const reference = deck().map(key).sort().join();
        let steps = 0;
        while (!unoGame.isOver(s) && steps++ < 20000) {
          const seat = s.turn;
          const mv = aiMove(s, seat, rand);
          s = unoGame.move(s, seat, mv, rand); // throws on an illegal move
          const all = [...s.hands.flat(), ...s.draw, ...s.discard]
            .map(key)
            .sort()
            .join();
          if (all !== reference)
            throw new Error(`cards changed (seed ${seed})`);
        }
        if (unoGame.isOver(s)) {
          finished++;
          expect([...s.places!].sort()).toEqual(
            Array.from({ length: players }, (_, i) => i),
          );
        }
      }
      expect(finished).toBe(15);
    },
  );
});
