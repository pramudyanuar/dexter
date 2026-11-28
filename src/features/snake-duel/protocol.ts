import type { Pair, Seat } from '@/features/games/logic/snake-duel';

export const MATCHMAKING_MS = 45_000;
export const DUEL_ROOMS_URL = '/api/snake/duel/rooms';
export const DUEL_MATCH_URL = '/api/snake/duel/matchmaking';
export const DUEL_SIGNAL_URL = '/api/snake/duel/signal';
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

export interface DuelSignal {
  guest: string;
  attempt: string;
  sdp: string;
}

export type DuelSignalUpdate = DuelSignal | { paired: string };

export interface DuelSignaling {
  names: Pair<string | null>;
  guest: string | null;
  signal: DuelSignal | null;
}
