import {
  countFace,
  diceGame,
  DiceState,
  DiceView,
  higher,
} from '@/lib/games/liarsdice';

const rigged = (dice: number[][]): DiceState => ({
  ...(diceGame.start(dice.length, () => 0) as DiceState),
  dice,
});

describe("liar's dice", () => {
  it('counts ones as wild except when bidding on ones', () => {
    expect(
      countFace(
        [
          [1, 2, 3],
          [3, 3],
        ],
        3,
      ),
    ).toBe(4);
    expect(
      countFace(
        [
          [1, 2, 3],
          [3, 3],
        ],
        1,
      ),
    ).toBe(1);
  });

  it('only accepts higher bids', () => {
    expect(higher(null, 1, 2)).toBe(true);
    const bid = { qty: 3, face: 4, seat: 0 };
    expect(higher(bid, 3, 5)).toBe(true);
    expect(higher(bid, 4, 2)).toBe(true);
    expect(higher(bid, 3, 4)).toBe(false);
    expect(higher(bid, 2, 6)).toBe(false);
  });

  it("hides other players' dice but not counts", () => {
    const s = rigged([
      [1, 2, 3, 4, 5],
      [6, 6, 6, 6, 6],
    ]);
    const v = diceGame.view(s, 0) as DiceView;
    expect(v.myDice).toEqual([1, 2, 3, 4, 5]);
    expect(v.counts).toEqual([5, 5]);
    expect(JSON.stringify(v)).not.toContain('[6,6,6,6,6]');
  });

  it('enforces turn order, validity and that a call needs a bid', () => {
    const s = rigged([
      [2, 2],
      [3, 3],
    ]);
    expect(() => diceGame.move(s, 1, { type: 'bid', qty: 1, face: 2 })).toThrow(
      /giliran/,
    );
    expect(() => diceGame.move(s, 0, { type: 'call' })).toThrow(/tawaran/);
    expect(() => diceGame.move(s, 0, { type: 'bid', qty: 9, face: 2 })).toThrow(
      /tidak valid/,
    );
    const s2 = diceGame.move(s, 0, {
      type: 'bid',
      qty: 2,
      face: 3,
    }) as DiceState;
    expect(s2.turn).toBe(1);
    expect(() =>
      diceGame.move(s2, 1, { type: 'bid', qty: 2, face: 3 }),
    ).toThrow(/lebih tinggi/);
  });

  it('makes the bidder lose a die when the call is right, and opens the next round', () => {
    const s = rigged([
      [2, 2],
      [3, 3],
    ]);
    const bid = diceGame.move(s, 0, {
      type: 'bid',
      qty: 3,
      face: 2,
    }) as DiceState;
    const called = diceGame.move(
      bid,
      1,
      { type: 'call' },
      () => 0,
    ) as DiceState;
    expect(called.reveal?.loser).toBe(0); // only two 2s, bid was three
    expect(called.dice[0]).toHaveLength(1);
    expect(called.round).toBe(2);
    expect(called.turn).toBe(0);
    expect(called.bid).toBeNull();
  });

  it('makes the caller lose when the bid holds, and ends the game at one survivor', () => {
    const s = rigged([[2, 2], [3]]);
    const bid = diceGame.move(s, 0, {
      type: 'bid',
      qty: 2,
      face: 2,
    }) as DiceState;
    const called = diceGame.move(bid, 1, { type: 'call' }) as DiceState;
    expect(called.reveal?.loser).toBe(1);
    expect(called.winner).toBe(0);
    expect(diceGame.isOver(called)).toBe(true);
  });
});
