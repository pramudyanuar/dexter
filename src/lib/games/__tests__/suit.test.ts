/** @jest-environment node */
import {
  PICKS,
  roundWinner,
  suitGame,
  SuitState,
  SuitView,
  WINS_NEEDED,
} from '@/lib/games/suit';
import { RoomError } from '@/lib/rooms/types';

const start = () => suitGame.start(2);
const view = (s: SuitState, seat: number | null) =>
  suitGame.view(s, seat) as SuitView;
const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof RoomError ? e.status : -1;
  }
  return null;
};

/** Both players pick; returns the state after the round resolves. */
const round = (s: SuitState, a: string, b: string) =>
  suitGame.move(suitGame.move(s, 0, { pick: a }), 1, { pick: b });

describe('who wins a round', () => {
  it.each([
    ['batu', 'gunting', 0],
    ['gunting', 'kertas', 0],
    ['kertas', 'batu', 0],
    ['gunting', 'batu', 1],
    ['kertas', 'gunting', 1],
    ['batu', 'kertas', 1],
    ['batu', 'batu', null],
    ['gunting', 'gunting', null],
    ['kertas', 'kertas', null],
  ] as const)('%s vs %s -> %s', (a, b, winner) => {
    expect(roundWinner(a, b)).toBe(winner);
  });

  it('knows exactly three picks', () => {
    expect([...PICKS]).toEqual(['batu', 'gunting', 'kertas']);
  });
});

describe('a round', () => {
  it('keeps the first pick hidden from the other player', () => {
    const s = suitGame.move(start(), 0, { pick: 'batu' });
    expect(view(s, 0).myPick).toBe('batu');
    expect(view(s, 0).opponentPicked).toBe(false);
    expect(view(s, 1).myPick).toBeNull();
    expect(view(s, 1).opponentPicked).toBe(true);
    // nothing in the other seat's view says what was picked
    expect(JSON.stringify(view(s, 1))).not.toContain('batu');
    expect(JSON.stringify(view(s, null))).not.toContain('batu');
  });

  it('reveals both picks and scores once both are in', () => {
    const s = round(start(), 'batu', 'gunting');
    expect(s.scores).toEqual([1, 0]);
    expect(s.last).toEqual({ picks: ['batu', 'gunting'], winner: 0 });
    expect(s.picks).toEqual([null, null]);
    expect(s.round).toBe(2);
    expect(view(s, 1).last?.picks).toEqual(['batu', 'gunting']);
  });

  it('replays a tied round without scoring', () => {
    const s = round(start(), 'kertas', 'kertas');
    expect(s.scores).toEqual([0, 0]);
    expect(s.last?.winner).toBeNull();
    expect(s.round).toBe(2);
    expect(s.winner).toBeNull();
  });

  it('works whichever player picks first', () => {
    const s = suitGame.move(suitGame.move(start(), 1, { pick: 'kertas' }), 0, {
      pick: 'gunting',
    });
    expect(s.scores).toEqual([1, 0]);
  });

  it('rejects an invalid pick and a second pick in the same round', () => {
    const s = suitGame.move(start(), 0, { pick: 'batu' });
    for (const bad of [null, {}, { pick: 'spock' }, { pick: 5 }, 'batu']) {
      expect(errorOf(() => suitGame.move(start(), 0, bad))).toBe(400);
    }
    expect(errorOf(() => suitGame.move(s, 0, { pick: 'kertas' }))).toBe(409);
  });

  it('does not change the state it was given', () => {
    const s = start();
    const before = JSON.stringify(s);
    round(s, 'batu', 'kertas');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('a match', () => {
  it(`goes to the first player with ${WINS_NEEDED} round wins`, () => {
    let s = round(start(), 'batu', 'gunting');
    expect(s.winner).toBeNull();
    s = round(s, 'kertas', 'kertas'); // tie, no change
    s = round(s, 'kertas', 'batu');
    expect(s.scores).toEqual([2, 0]);
    expect(s.winner).toBe(0);
    expect(suitGame.isOver(s)).toBe(true);
    expect(view(s, 1).winner).toBe(0);
  });

  it('can be won by the second seat after trailing', () => {
    let s = round(start(), 'batu', 'gunting'); // 1-0
    s = round(s, 'batu', 'kertas'); // 1-1
    s = round(s, 'batu', 'kertas'); // 1-2
    expect(s.winner).toBe(1);
  });

  it('starts over cleanly on rematch', () => {
    const won = round(round(start(), 'batu', 'gunting'), 'batu', 'gunting');
    const again = suitGame.restart(won, 2);
    expect([again.scores, again.winner, again.last, again.round]).toEqual([
      [0, 0],
      null,
      null,
      1,
    ]);
  });
});
