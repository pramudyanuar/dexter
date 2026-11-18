import { seededRandom } from '@/lib/games/seeded-random';
import {
  delayFor,
  Dir,
  initialSnake,
  isDirection,
  MIN_SNAKE_DELAY,
  step,
  turn,
} from '@/lib/games/snake';

export const DAILY_DURATION_MS = 120_000;
export const DAILY_RULES_VERSION = 1;
const MAX_DAILY_TICKS = Math.ceil(DAILY_DURATION_MS / MIN_SNAKE_DELAY);
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAILY_GRACE_MS = 15 * 60 * 1000;

export interface DailyChallenge {
  day: string;
  seed: number;
  version: number;
}

export interface SnakeReplay {
  ticks: number;
  turns: [tick: number, dir: Dir][];
}

export function dailyChallenge(now = Date.now()): DailyChallenge {
  const day = new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10);
  return challengeForDay(day);
}

function challengeForDay(day: string): DailyChallenge {
  const date = Number(day.replaceAll('-', ''));
  return {
    day,
    version: DAILY_RULES_VERSION,
    seed: Math.imul(date, 0x9e3779b1) >>> 0,
  };
}

export function canSubmitDaily(day: string, now = Date.now()) {
  return (
    day === dailyChallenge(now).day ||
    day === dailyChallenge(now - DAILY_GRACE_MS).day
  );
}

export function nextSnakeDelay(score: number, elapsed: number, limit: number) {
  return Math.min(delayFor(score), limit - elapsed);
}

export function readSnakeReplay(value: unknown): SnakeReplay | null {
  if (!value || typeof value !== 'object') return null;
  const { ticks, turns } = value as Partial<SnakeReplay>;
  if (
    typeof ticks !== 'number' ||
    !Number.isInteger(ticks) ||
    ticks < 1 ||
    ticks > MAX_DAILY_TICKS ||
    !Array.isArray(turns) ||
    turns.length > ticks
  ) {
    return null;
  }
  let last = 0;
  for (const move of turns) {
    if (
      !Array.isArray(move) ||
      move.length !== 2 ||
      !Number.isInteger(move[0]) ||
      move[0] <= last ||
      move[0] > ticks ||
      !isDirection(move[1])
    ) {
      return null;
    }
    last = move[0];
  }
  return { ticks, turns };
}

export function replayDaily(day: string, replay: SnakeReplay): number | null {
  const rng = seededRandom(challengeForDay(day).seed);
  let state = initialSnake(rng);
  let elapsed = 0;
  let turnIndex = 0;

  for (let tick = 1; tick <= replay.ticks; tick++) {
    if (state.result || elapsed >= DAILY_DURATION_MS) return null;
    const move = replay.turns[turnIndex];
    if (move?.[0] === tick) {
      const dir = move[1];
      const turned = turn(state, dir);
      if (dir === state.dir || dir !== turned.next) return null;
      state = turned;
      turnIndex++;
    }
    elapsed += nextSnakeDelay(state.score, elapsed, DAILY_DURATION_MS);
    state = step(state, rng);
  }

  return state.result || elapsed >= DAILY_DURATION_MS ? state.score : null;
}
