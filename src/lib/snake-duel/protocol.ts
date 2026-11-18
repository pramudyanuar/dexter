import type { ArenaView, Pair, Seat } from '@/lib/games/snake-duel';

export const RECONNECT_MS = 10_000;
export const MATCHMAKING_MS = 45_000;
export const DUEL_ROOMS_URL = '/api/snake/duel/rooms';
export const DUEL_MATCH_URL = '/api/snake/duel/matchmaking';
export const DUEL_SOCKET_URL = '/api/snake/duel/socket';
export const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

export interface DuelSession {
  code: string;
  seat: Seat;
  token: string;
}

export type DuelTicket =
  | { status: 'queued'; name: string; expiresAt: number }
  | { status: 'matched'; session: DuelSession };

export interface DuelLobbyEntry {
  code: string;
  name: string;
}

export type RoundPhase = 'countdown' | 'playing' | 'paused' | 'over';

export interface DuelView {
  code: string;
  version: number;
  now: number;
  players: Pair<{ name: string; ready: boolean; online: boolean } | null>;
  round: {
    id: string;
    phase: RoundPhase;
    nextAt: number;
    arena: ArenaView;
  } | null;
}

export type DuelEvent =
  | { type: 'state'; room: DuelView }
  | { type: 'notice'; message: string }
  | { type: 'left' };
