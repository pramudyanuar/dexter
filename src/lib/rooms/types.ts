export type GameId =
  | 'connect4'
  | 'suit'
  | 'uno'
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
  status: RoomStatus;
  /** Game-specific, null until the game starts */
  state: unknown | null;
  /** Bumped on every change, so clients can ask "anything new since N?" */
  version: number;
  createdAt: number;
}

/** What one player is allowed to see of a room. */
export interface RoomView<V = unknown> {
  code: string;
  game: GameId;
  status: RoomStatus;
  /** The viewer's own seat, or null for someone who is not seated */
  seat: number | null;
  /** Whether each seat is taken */
  joined: boolean[];
  capacity: number;
  minPlayers: number;
  version: number;
  /** The game's view for this seat (hidden information removed) */
  state: V | null;
}

/** A rule violation to report to the player, with the HTTP status to use. */
export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
