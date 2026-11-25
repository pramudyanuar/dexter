import { Dir, OPPOSITE } from '@/lib/games/snake';
import {
  Arena,
  ArenaView,
  DUEL_TICK_MS,
  initialArena,
  Pair,
  pairOf,
  Seat,
  stepArena,
} from '@/lib/games/snake-duel';

const COUNTDOWN_MS = 3000;
export const DUEL_FRAME_MS = 33;

type Phase = 'countdown' | 'playing' | 'over';

interface Round {
  id: number;
  phase: Phase;
  arena: Arena;
  nextAt: number;
  inputs: Pair<Dir[]>;
}

export interface DuelMatch {
  ready: Pair<boolean>;
  round: Round | null;
}

export interface DuelFrame {
  ready: Pair<boolean>;
  round: {
    id: number;
    phase: Phase;
    arena: ArenaView;
    stepInMs: number;
    turns: Pair<Dir | null>;
  } | null;
}

export function readyDuel(
  match: DuelMatch,
  seat: Seat,
  value: boolean,
  seed: number,
  now: number,
): DuelMatch {
  if (match.round && match.round.phase !== 'over') return match;
  const ready = pairOf((player) =>
    player === seat ? value : match.ready[player],
  );
  if (!ready.every(Boolean)) return { ...match, ready };

  return {
    ready: [false, false],
    round: {
      id: (match.round?.id ?? 0) + 1,
      phase: 'countdown',
      arena: initialArena(seed),
      nextAt: now + COUNTDOWN_MS,
      inputs: [[], []],
    },
  };
}

export function queueDuelTurn(
  match: DuelMatch,
  seat: Seat,
  id: number,
  dir: Dir,
): DuelMatch {
  const round = match.round;
  if (round?.id !== id || round.phase !== 'playing') return match;
  const queue = round.inputs[seat];
  const heading = queue.at(-1) ?? round.arena.snakes[seat].dir;
  if (queue.length >= 2 || heading === dir || OPPOSITE[heading] === dir)
    return match;

  return {
    ...match,
    round: {
      ...round,
      inputs: pairOf((player) =>
        player === seat ? [...queue, dir] : round.inputs[player],
      ),
    },
  };
}

export function advanceDuel(match: DuelMatch, now: number): DuelMatch {
  const round = match.round;
  if (!round || round.phase === 'over' || now < round.nextAt) return match;
  if (round.phase === 'countdown') {
    return {
      ...match,
      round: { ...round, phase: 'playing', nextAt: now + DUEL_TICK_MS },
    };
  }

  const arena = stepArena(
    round.arena,
    pairOf((seat) => round.inputs[seat][0] ?? null),
  );
  return {
    ...match,
    round: {
      ...round,
      phase: arena.result ? 'over' : 'playing',
      arena,
      nextAt: Math.max(round.nextAt + DUEL_TICK_MS, now + DUEL_TICK_MS / 2),
      inputs: pairOf((seat) => round.inputs[seat].slice(1)),
    },
  };
}

export function duelFrame(match: DuelMatch, now: number): DuelFrame {
  const round = match.round;
  if (!round) return { ready: match.ready, round: null };
  const { snakes, food, tick, result } = round.arena;
  return {
    ready: match.ready,
    round: {
      id: round.id,
      phase: round.phase,
      arena: { snakes, food, tick, result },
      stepInMs: Math.max(0, round.nextAt - now),
      turns: pairOf((seat) => round.inputs[seat][0] ?? null),
    },
  };
}
