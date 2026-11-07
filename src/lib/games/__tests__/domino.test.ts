import {
  dominoGame,
  DominoState,
  DominoView,
  fits,
  set,
  Tile,
} from '@/lib/games/domino';

const base = (over: Partial<DominoState>): DominoState => ({
  ...(dominoGame.start(2, () => 0.5) as DominoState),
  ...over,
});

describe('domino', () => {
  it('has 28 tiles and deals 7 each', () => {
    expect(set()).toHaveLength(28);
    const s = dominoGame.start(3) as DominoState;
    expect(s.hands.every((h) => h.length === 7)).toBe(true);
    expect(s.boneyard).toHaveLength(28 - 21);
  });

  it('finds which ends a tile fits', () => {
    const board: Tile[] = [[2, 3]];
    expect(fits(board, [3, 5])).toEqual(['R']);
    expect(fits(board, [2, 2])).toEqual(['L']);
    expect(fits(board, [2, 3])).toEqual(['L', 'R']);
    expect(fits(board, [0, 1])).toEqual([]);
  });

  it('plays tiles, orienting them so neighbours match', () => {
    const s = base({
      hands: [
        [
          [3, 5],
          [6, 6],
        ],
        [[1, 1]],
      ],
      boneyard: [],
      board: [[2, 3]],
    });
    const next = dominoGame.move(s, 0, {
      type: 'play',
      index: 0,
      end: 'R',
    }) as DominoState;
    expect(next.board).toEqual([
      [2, 3],
      [3, 5],
    ]);
    expect(next.turn).toBe(1);
    expect(() =>
      dominoGame.move(s, 0, { type: 'play', index: 1, end: 'R' }),
    ).toThrow(/tidak cocok/);
    expect(() => dominoGame.move(s, 1, { type: 'pass' })).toThrow(/giliran/);
  });

  it('wins by emptying the hand and reveals hands afterwards', () => {
    const s = base({
      hands: [[[3, 5]], [[1, 1]]],
      boneyard: [],
      board: [[2, 3]],
    });
    const done = dominoGame.move(s, 0, {
      type: 'play',
      index: 0,
      end: 'R',
    }) as DominoState;
    expect(done.status).toBe('won');
    expect(done.winner).toBe(0);
    expect((dominoGame.view(done, 1) as DominoView).hands).not.toBeNull();
    expect((dominoGame.view(s, 1) as DominoView).hands).toBeNull();
  });

  it('draws only when stuck, and passes only when the pile is empty', () => {
    const stuck = base({
      hands: [[[0, 1]], [[1, 1]]],
      boneyard: [[4, 4]],
      board: [[5, 6]],
    });
    const drawn = dominoGame.move(stuck, 0, { type: 'draw' }) as DominoState;
    expect(drawn.hands[0]).toHaveLength(2);
    expect(() => dominoGame.move(stuck, 0, { type: 'pass' })).toThrow(/Tarik/);

    const fine = base({
      hands: [[[5, 1]], [[1, 1]]],
      boneyard: [[4, 4]],
      board: [[5, 6]],
    });
    expect(() => dominoGame.move(fine, 0, { type: 'draw' })).toThrow(
      /masih punya/,
    );
  });

  it('ends a blocked game and gives it to the lightest hand', () => {
    let s = base({
      hands: [[[0, 1]], [[4, 4]]],
      boneyard: [],
      board: [[5, 6]],
    });
    s = dominoGame.move(s, 0, { type: 'pass' }) as DominoState;
    s = dominoGame.move(s, 1, { type: 'pass' }) as DominoState;
    expect(s.status).toBe('blocked');
    expect(s.winner).toBe(0);
  });
});
