import {
  Arena,
  ArenaResult,
  DUEL_TICK_MS,
  initialArena,
  Pair,
  pairOf,
  stepArena,
} from '@/lib/games/snake-duel';
import {
  DuelMove,
  DuelView,
  RECONNECT_MS,
  RoundPhase,
} from '@/lib/snake-duel/protocol';

export const PRESENCE_TIMEOUT_MS = 6000;
export const ROUND_MAX_WALL_MS = 120_000;
const COUNTDOWN_MS = 3000;

export interface DuelPlayer {
  name: string;
  tokenHash: string;
  ready: boolean;
}

export interface Presence {
  id: string;
  seenAt: number;
  closedAt?: number;
  expiredRound?: string;
}

export interface DuelInput extends DuelMove {
  player: string;
}

export interface Round {
  id: string;
  phase: RoundPhase;
  arena: Arena;
  nextAt: number;
  expiresAt: number;
  inputs: Pair<DuelInput | null>;
}

export interface DuelRoom {
  code: string;
  version: number;
  public: boolean;
  players: Pair<DuelPlayer | null>;
  round: Round | null;
}

export function absentSince(presence: Presence | null, now: number) {
  if (!presence) return 0;
  if (presence.closedAt !== undefined) return presence.closedAt;
  const expires = presence.seenAt + PRESENCE_TIMEOUT_MS;
  return expires <= now ? expires : null;
}

export function roomView(
  room: DuelRoom,
  presence: Pair<Presence | null>,
  now: number,
): DuelView {
  const round = room.round;
  return {
    code: room.code,
    version: room.version,
    now,
    players: pairOf((seat) => {
      const player = room.players[seat];
      return player
        ? {
            name: player.name,
            ready: player.ready,
            online: absentSince(presence[seat], now) === null,
          }
        : null;
    }),
    round: round
      ? {
          id: round.id,
          phase: round.phase,
          nextAt: round.nextAt,
          arena: {
            snakes: round.arena.snakes,
            food: round.arena.food,
            tick: round.arena.tick,
            result: round.arena.result,
          },
        }
      : null,
  };
}

export function beginRound(id: string, seed: number, now: number): Round {
  return {
    id,
    phase: 'countdown',
    arena: initialArena(seed),
    nextAt: now + COUNTDOWN_MS,
    expiresAt: now + ROUND_MAX_WALL_MS,
    inputs: [null, null],
  };
}

export function endRound(round: Round, result: ArenaResult): Round {
  return { ...round, phase: 'over', arena: { ...round.arena, result } };
}

export function advanceRound(
  round: Round,
  presence: Pair<Presence | null>,
  input: Pair<DuelInput | null>,
  now: number,
): Round {
  if (round.phase === 'over') return round;
  const absent = pairOf((seat) => absentSince(presence[seat], now));
  const expired = pairOf(
    (seat) =>
      presence[seat]?.expiredRound === round.id ||
      (absent[seat] !== null && now - absent[seat] >= RECONNECT_MS),
  );
  if (expired.every(Boolean) || now >= round.expiresAt) {
    return endRound(round, { winner: null, reason: 'cancelled' });
  }
  if (expired[0] && absent[1] === null) {
    return endRound(round, { winner: 1, reason: 'forfeit' });
  }
  if (expired[1] && absent[0] === null) {
    return endRound(round, { winner: 0, reason: 'forfeit' });
  }
  if (absent.some((at) => at !== null)) {
    return round.phase === 'paused' ? round : { ...round, phase: 'paused' };
  }
  if (round.phase === 'paused') {
    return {
      ...round,
      phase: 'countdown',
      nextAt: Math.max(round.nextAt, now + DUEL_TICK_MS),
    };
  }
  if (now < round.nextAt) return round;

  const moves = pairOf((seat) => {
    const move = input[seat];
    const last = round.inputs[seat];
    if (move?.roundId !== round.id || move.player !== presence[seat]?.id)
      return null;
    return last?.player !== move.player || last.seq < move.seq ? move : null;
  });
  const arena = stepArena(
    round.arena,
    pairOf((seat) => moves[seat]?.dir ?? null),
  );
  return {
    ...round,
    phase: arena.result ? 'over' : 'playing',
    arena,
    nextAt: Math.max(round.nextAt + DUEL_TICK_MS, now + DUEL_TICK_MS / 2),
    inputs: pairOf((seat) => moves[seat] ?? round.inputs[seat]),
  };
}
