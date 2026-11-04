import {
  delayFor,
  GRID,
  initialSnake,
  placeFood,
  SnakeState,
  step,
  turn,
} from '@/lib/games/snake';

const withSnake = (s: Partial<SnakeState>): SnakeState => ({
  ...initialSnake(() => 0),
  ...s,
});

describe('snake', () => {
  it('moves one cell in its direction and keeps its length', () => {
    const s = initialSnake(() => 0);
    const next = step(s);
    expect(next.snake).toHaveLength(3);
    expect(next.snake[0]).toEqual({ x: s.snake[0].x + 1, y: s.snake[0].y });
    expect(next.dead).toBe(false);
  });

  it('ignores a reversal into its own neck', () => {
    const s = initialSnake(() => 0);
    expect(turn(s, 'left').next).toBe('right');
    expect(turn(s, 'up').next).toBe('up');
  });

  it('cannot reverse by turning twice between steps', () => {
    let s = initialSnake(() => 0);
    s = turn(s, 'up');
    s = turn(s, 'left'); // would be a reversal once "up" is applied
    s = step(s);
    expect(s.dead).toBe(false);
  });

  it('grows and scores when eating, and food never lands on the snake', () => {
    const s0 = initialSnake(() => 0);
    const head = s0.snake[0];
    const s = withSnake({ food: { x: head.x + 1, y: head.y } });
    const next = step(s, () => 0.5);
    expect(next.snake).toHaveLength(4);
    expect(next.score).toBe(1);
    expect(
      next.snake.some((p) => p.x === next.food.x && p.y === next.food.y),
    ).toBe(false);
  });

  it('dies on a wall', () => {
    const s = withSnake({
      snake: [
        { x: GRID - 1, y: 5 },
        { x: GRID - 2, y: 5 },
        { x: GRID - 3, y: 5 },
      ],
      food: { x: 0, y: 0 },
    });
    expect(step(s).dead).toBe(true);
  });

  it('dies when it runs into itself, but may follow its own tail', () => {
    const loop = withSnake({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
      dir: 'down',
      next: 'left',
      food: { x: 0, y: 0 },
    });
    expect(step(loop).dead).toBe(true);

    const chase = withSnake({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
      ],
      dir: 'down',
      next: 'left',
      food: { x: 0, y: 0 },
    });
    expect(step(chase).dead).toBe(false);
  });

  it('places food only on free cells', () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    for (const r of [0, 0.5, 0.999]) {
      const f = placeFood(snake, () => r);
      expect(snake.some((p) => p.x === f.x && p.y === f.y)).toBe(false);
    }
  });

  it('speeds up with the score, with a floor', () => {
    expect(delayFor(0)).toBe(140);
    expect(delayFor(10)).toBeLessThan(delayFor(0));
    expect(delayFor(1000)).toBe(60);
  });
});
