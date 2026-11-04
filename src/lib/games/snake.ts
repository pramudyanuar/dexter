export const GRID = 20;

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
  food: Point;
  score: number;
  dead: boolean;
}

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function placeFood(
  snake: Point[],
  rng: () => number = Math.random,
): Point {
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    }
  }
  return free[Math.floor(rng() * free.length)];
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
    dead: false,
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
  if (state.dead) return state;

  const d = DELTA[state.next];
  const head = { x: state.snake[0].x + d.x, y: state.snake[0].y + d.y };
  const ate = same(head, state.food);

  // the tail moves away this step unless the snake grows
  const body = ate ? state.snake : state.snake.slice(0, -1);
  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  if (hitWall || body.some((s) => same(s, head))) {
    return { ...state, dir: state.next, dead: true };
  }

  const snake = [head, ...body];
  return {
    ...state,
    snake,
    dir: state.next,
    food: ate ? placeFood(snake, rng) : state.food,
    score: state.score + (ate ? 1 : 0),
  };
}

/** Milliseconds between steps: starts calm, speeds up as the score grows. */
export function delayFor(score: number) {
  return Math.max(60, 140 - score * 4);
}
