import type { GameId } from '@/lib/rooms/types';

/**
 * A game plugs into the room engine by describing its rules. All of these are
 * pure: they take a state and return a new one, throwing RoomError for illegal
 * moves, so they can be tested without any server.
 */
/** What the room tells a game about who is who. */
export interface GameCtx {
  /** Seat of the room's admin (the moderator in games that have one) */
  host: number;
}

export interface GameDef<S = unknown> {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  /** Start once every seat is taken; otherwise the host starts the game. */
  autoStart: boolean;
  start(players: number, rng?: () => number, options?: unknown): S;
  /**
   * Settings the admin may change in the waiting room. `sanitizeOptions` turns
   * whatever a client sent into a complete, safe settings object.
   */
  defaultOptions?: unknown;
  sanitizeOptions?(raw: unknown): unknown;
  /** A new round after one has ended. */
  restart(previous: S, players: number, rng?: () => number): S;
  move(
    state: S,
    seat: number,
    move: unknown,
    rng?: () => number,
    ctx?: GameCtx,
  ): S;
  /**
   * What `seat` may see. This is the only way game state leaves the server, so
   * hidden information (hands, unrevealed picks) must be removed here.
   * `seat` is null for someone who is not playing.
   */
  view(state: S, seat: number | null, ctx?: GameCtx): unknown;
  isOver(state: S): boolean;

  /**
   * Who the game is waiting on right now (seats that must act) and how long
   * they get. Null when nobody is being waited for. Seats already removed
   * from the game must not be listed.
   */
  waiting?(state: S): { seats: number[]; seconds: number } | null;
  /**
   * A legal move to play for a seat that ran out of time, as the payload
   * `move` would receive. Null when there is nothing sensible to play. It may
   * be asked repeatedly until the seat is no longer being waited for.
   */
  autoMove?(state: S, seat: number, rng?: () => number): unknown | null;
  /**
   * Takes a player out of the game (they left or kept missing turns): the
   * others carry on without them, and with one player left that player wins.
   */
  eliminate?(state: S, seat: number, rng?: () => number): S;
}
