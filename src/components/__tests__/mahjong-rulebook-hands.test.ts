import {
  PATTERN_HANDS,
  readExample,
  STANDARD_HAND,
} from '@/components/games/mahjong/rulebook-hands';

describe('the illustrated Mahjong rulebook', () => {
  it.each(
    PATTERN_HANDS.map(
      (hand, i) => [hand.title, hand, [3, 5, 7, 5, 10, 10][i]] as const,
    ),
  )(
    '%s shows a legal hand with the illustrated score',
    (_title, hand, faan) => {
      const { groups, score } = readExample(hand, 34);
      const tiles = groups.flatMap((g) => g.tiles);
      expect(tiles).toHaveLength(14);
      expect(
        tiles.every(
          (t) => t >= 0 && t < 34 && tiles.filter((k) => k === t).length <= 4,
        ),
      ).toBe(true);
      expect(score.faan).toBe(faan);
    },
  );
  it('crosses the three-faan minimum when South receives its own flower', () => {
    expect(readExample(STANDARD_HAND, 34).score).toMatchObject({
      faan: 2,
      units: 0,
    });
    expect(readExample(STANDARD_HAND, 35).score).toMatchObject({
      faan: 3,
      units: 8,
    });
  });
});
