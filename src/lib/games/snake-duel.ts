import { nextRandom } from '@/lib/games/seeded-random';
import {
  DELTA,
  Dir,
  GRID,
  OPPOSITE,
  placeFood,
  Point,
  samePoint,
} from '@/lib/games/snake';

export const DUEL_TICK_MS = 125;
export const DUEL_ROUND_MS = 60_000;

export type Seat = 0 | 1;
export type Pair<T> = [T, T];
export const SEATS = [0, 1] as const;

export function pairOf<T>(pick: (seat: Seat) => T): Pair<T> {
  return [pick(0), pick(1)];
}

export interface ArenaSnake {
  snake: Point[];
  dir: Dir;
  score: number;
}

export interface ArenaResult {
  winner: Seat | null;
  reason: 'collision' | 'time' | 'full' | 'forfeit' | 'cancelled';
}

export interface ArenaView {
  snakes: Pair<ArenaSnake>;
  food: Point | null;
  tick: number;
  result: ArenaResult | null;
}

export interface Arena extends ArenaView {
  randomState: number;
}

export function initialArena(seed: number): Arena {
  const [randomState, choice] = nextRandom(seed);
  return {
    snakes: [
      {
        snake: [
          { x: 5, y: 8 },
          { x: 4, y: 8 },
          { x: 3, y: 8 },
        ],
        dir: 'right',
        score: 0,
      },
      {
        snake: [
          { x: 14, y: 11 },
          { x: 15, y: 11 },
          { x: 16, y: 11 },
        ],
        dir: 'left',
        score: 0,
      },
    ],
    food: choice < 0.5 ? { x: 9, y: 10 } : { x: 10, y: 9 },
    tick: 0,
    result: null,
    randomState,
  };
}

export function stepArena(arena: Arena, input: Pair<Dir | null>): Arena {
  if (arena.result) return arena;
  const moves = pairOf((seat) => {
    const player = arena.snakes[seat];
    const requested = input[seat];
    const dir =
      requested && requested !== OPPOSITE[player.dir] ? requested : player.dir;
    const delta = DELTA[dir];
    const head = {
      x: player.snake[0].x + delta.x,
      y: player.snake[0].y + delta.y,
    };
    const ate = arena.food !== null && samePoint(head, arena.food);
    return {
      head,
      dir,
      ate,
      body: ate ? player.snake : player.snake.slice(0, -1),
    };
  });
  const headOn = samePoint(moves[0].head, moves[1].head);
  const occupied = [...moves[0].body, ...moves[1].body];
  const dead = pairOf((seat) => {
    const { head } = moves[seat];
    return (
      headOn ||
      head.x < 0 ||
      head.y < 0 ||
      head.x >= GRID ||
      head.y >= GRID ||
      occupied.some((point) => samePoint(point, head))
    );
  });

  const snakes = pairOf((seat) => {
    const { dir, head, body, ate } = moves[seat];
    const player = arena.snakes[seat];
    return dead[seat]
      ? player
      : { dir, snake: [head, ...body], score: player.score + Number(ate) };
  });
  const tick = arena.tick + 1;
  const eaten = SEATS.some((seat) => moves[seat].ate && !dead[seat]);
  const [randomState, roll] = eaten
    ? nextRandom(arena.randomState)
    : [arena.randomState, 0];
  const food = eaten
    ? placeFood(
        snakes.flatMap((snake) => snake.snake),
        () => roll,
      )
    : arena.food;
  let result: ArenaResult | null = null;
  if (dead[0] || dead[1]) {
    result = {
      winner: dead[0] === dead[1] ? null : dead[0] ? 1 : 0,
      reason: 'collision',
    };
  } else if (!food || tick * DUEL_TICK_MS >= DUEL_ROUND_MS) {
    const [first, second] = snakes;
    result = {
      winner:
        first.score === second.score
          ? null
          : first.score > second.score
            ? 0
            : 1,
      reason: food ? 'time' : 'full',
    };
  }
  return { snakes, food, tick, result, randomState };
}
