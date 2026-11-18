export const GRID = 20;
const START_LENGTH = 3;
export const MAX_SNAKE_SCORE = GRID * GRID - START_LENGTH;
export const MIN_SNAKE_DELAY = 60;

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Point {
  x: number;
  y: number;
}

export interface SnakeState {
  /** Head first */
  snake: Point[];
  /** Direction of the last step taken */
  dir: Dir;
  /** Direction queued for the next step */
  next: Dir;
  food: Point | null;
  score: number;
  result: 'lost' | 'won' | null;
}

export const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function isDirection(value: unknown): value is Dir {
  return typeof value === 'string' && Object.hasOwn(DELTA, value);
}

export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function placeFood(
  snake: readonly Point[],
  rng: () => number = Math.random,
): Point | null {
  const occupied = new Set(snake.map(({ x, y }) => y * GRID + x));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(y * GRID + x)) free.push({ x, y });
    }
  }
  return free.length > 0 ? free[Math.floor(rng() * free.length)] : null;
}

export function initialSnake(rng: () => number = Math.random): SnakeState {
  const mid = Math.floor(GRID / 2);
  const snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    snake,
    dir: 'right',
    next: 'right',
    food: placeFood(snake, rng),
    score: 0,
    result: null,
  };
}

/** Queues a turn. Reversing straight into the neck is ignored. */
export function turn(state: SnakeState, dir: Dir): SnakeState {
  return dir === OPPOSITE[state.dir] ? state : { ...state, next: dir };
}

export function step(
  state: SnakeState,
  rng: () => number = Math.random,
): SnakeState {
  if (state.result) return state;

  const d = DELTA[state.next];
  const head = { x: state.snake[0].x + d.x, y: state.snake[0].y + d.y };
  const ate = state.food !== null && samePoint(head, state.food);

  // the tail moves away this step unless the snake grows
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  if (hitWall || body.some((s) => samePoint(s, head))) {
    return { ...state, dir: state.next, result: 'lost' };
  }

  const snake = [head, ...body];
  const food = ate ? placeFood(snake, rng) : state.food;
  return {
    ...state,
    snake,
    dir: state.next,
    food,
    score: state.score + (ate ? 1 : 0),
    result: food ? null : 'won',
  };
}

/** Milliseconds between steps: starts calm, speeds up as the score grows. */
export function delayFor(score: number) {
  return Math.max(MIN_SNAKE_DELAY, 140 - score * 4);
}
