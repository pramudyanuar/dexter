export type GameId =
  | 'connect4'
  | 'suit'
  | 'uno'
  | 'unoflip'
  | 'unomercy'
  | 'battleship'
  | 'gomoku'
  | 'checkers'
  | 'chess'
  | 'dice'
  | 'domino'
  | 'quiz'
  | 'pictionary';
export type RoomStatus = 'waiting' | 'playing' | 'over';

/**
 * What is stored. `tokens` are the players' secrets and never leave the
 * server, and neither does `state` as it is: players only ever get `RoomView`.
 */
export interface Room {
  code: string;
  game: GameId;
  /** One slot per seat; seat 0 is the host who created the room */
  tokens: (string | null)[];
  /** Display name per seat, chosen by the player (older rooms may lack it) */
  names?: (string | null)[];
  status: RoomStatus;
  /** Game-specific, null until the game starts */
  state: unknown | null;
  /** Bumped on every change, so clients can ask "anything new since N?" */
  version: number;
  createdAt: number;
  /** Seats removed from the running game (left, or too many missed turns) */
  out?: boolean[];
  /** Missed turns per seat; at MAX_STRIKES the player is removed */
  strikes?: number[];
  /** When the game last moved on, which is what the turn clock counts from */
  stamp?: number;
  /** Seat of the admin: starts the game and can remove players. Seat 0 when missing. */
  host?: number;
  /** When the admin last changed hands */
  hostAt?: number;
  /** When each seat pressed "keluar" (ms), while the game is running and they may still come back */
  left?: (number | null)[];
  /** Why each removed seat is out */
  why?: (OutWhy | null)[];
}

export type OutWhy = 'left' | 'idle' | 'kicked';

/** After leaving, how long a player has to come back before they are removed from the game. */
export const LEAVE_GRACE_MS = 10_000;
/** How long everyone is told that the admin changed. */
export const HOST_NOTICE_MS = 10_000;
/** Missed turns before a player is removed from the game. */
export const MAX_STRIKES = 3;

/** What one player is allowed to see of a room. */
export interface RoomView<V = unknown> {
  code: string;
  game: GameId;
  status: RoomStatus;
  /** The viewer's own seat, or null for someone who is not seated */
  seat: number | null;
  /** Whether each seat is taken */
  joined: boolean[];
  /** Each seat's display name, or null when the player gave none */
  names: (string | null)[];
  capacity: number;
  minPlayers: number;
  version: number;
  /** The game's view for this seat (hidden information removed) */
  state: V | null;
  /** Seats removed from the game; they can no longer act */
  out: boolean[];
  /** Missed turns per seat, out of `maxStrikes` */
  strikes: number[];
  maxStrikes: number;
  /** Seat of the admin */
  host: number;
  /** Seconds left to announce a new admin, 0 when there is nothing to announce */
  hostNotice: number;
  /** Players who left but may still come back, and the seconds they have */
  leaving: { seat: number; goneIn: number }[];
  /** Why each removed seat is out */
  outWhy: (OutWhy | null)[];
  /** Who the game is waiting for and how many seconds they have left */
  waiting: { seats: number[]; remaining: number; seconds: number } | null;
}

/** One chat line. Chat lives apart from the game, so it can never overwrite a move. */
export interface ChatMsg {
  /** Unique and sortable by time; clients ask for "everything after this id" */
  id: string;
  seat: number;
  text: string;
  at: number;
}

export const CHAT_MAX_LENGTH = 200;
/** Lines kept per room; older ones fall off */
export const CHAT_KEEP = 50;

/** A rule violation to report to the player, with the HTTP status to use. */
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
