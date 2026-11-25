import {
  DUEL_ROUND_MS,
  DUEL_TICK_MS,
  initialArena,
  projectArenaStep,
  stepArena,
} from '@/lib/games/snake-duel';

import { slideSnake } from '@/components/games/snake/snake-motion';

describe('shared Snake arena', () => {
  it('slides around a predicted corner while keeping the bend on the grid', () => {
    const arena = initialArena(1);
    const from = arena.snakes[0].snake;
    const to = projectArenaStep(arena, ['down', null]).snakes[0].snake;
    expect(slideSnake(from, to, 0)).toBe(from);
    expect(slideSnake(from, to, 0.5)).toEqual([
      { x: 5, y: 8.5 },
      { x: 5, y: 8 },
      { x: 4, y: 8 },
      { x: 3.5, y: 8 },
    ]);
    expect(slideSnake(from, to, 1)).toBe(to);
  });

  it('holds the tail when growing and snaps past missed ticks', () => {
    const arena = { ...initialArena(1), food: { x: 6, y: 8 } };
    const from = arena.snakes[0].snake;
    const after = stepArena(arena, [null, null]);
    const to = after.snakes[0].snake;
    expect(slideSnake(from, to, 0.5)).toEqual([{ x: 5.5, y: 8 }, ...from]);
    const skipped = stepArena(after, [null, null]).snakes[0].snake;
    expect(slideSnake(from, skipped, 0.5)).toBe(skipped);
  });

  it('treats head-on and swapped-head collisions as simultaneous draws', () => {
    const arena = initialArena(1);
    const first = {
      ...arena.snakes[0],
      snake: [
        { x: 7, y: 8 },
        { x: 6, y: 8 },
        { x: 5, y: 8 },
      ],
    };
    for (const x of [8, 9]) {
      const second = {
        ...arena.snakes[1],
        snake: [
          { x, y: 8 },
          { x: x + 1, y: 8 },
          { x: x + 2, y: 8 },
        ],
      };
      expect(
        stepArena({ ...arena, snakes: [first, second] }, [null, null]).result,
      ).toEqual({ winner: null, reason: 'collision' });
    }
  });

  it('ignores reversing the moving direction, counts apples, and breaks timed results by score', () => {
    const arena = initialArena(1);
    const final = stepArena(
      {
        ...arena,
        tick: DUEL_ROUND_MS / DUEL_TICK_MS - 1,
        food: { x: 6, y: 8 },
      },
      ['left', null],
    );
    expect(final.snakes[0]).toMatchObject({ dir: 'right', score: 1 });
    expect(final.snakes[0].snake).toHaveLength(4);
    expect(final.result).toEqual({ winner: 0, reason: 'time' });
    expect(stepArena(final, [null, null])).toBe(final);
  });

  it('awards a surviving snake the round when the other hits a wall', () => {
    const arena = initialArena(1);
    const left = {
      ...arena.snakes[0],
      dir: 'up' as const,
      snake: [
        { x: 5, y: 0 },
        { x: 5, y: 1 },
        { x: 5, y: 2 },
      ],
    };
    expect(
      stepArena({ ...arena, snakes: [left, arena.snakes[1]] }, [null, null])
        .result,
    ).toEqual({ winner: 1, reason: 'collision' });
  });
});
