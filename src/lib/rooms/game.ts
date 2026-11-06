import type { GameId } from '@/lib/rooms/types';

/**
 * A game plugs into the room engine by describing its rules. All of these are
 * pure: they take a state and return a new one, throwing RoomError for illegal
 * moves, so they can be tested without any server.
 */
export interface GameDef<S = unknown> {
  id: GameId;
  minPlayers: number;
  maxPlayers: number;
  /** Start once every seat is taken; otherwise the host starts the game. */
  autoStart: boolean;
  start(players: number, rng?: () => number): S;
  /** A new round after one has ended. */
  restart(previous: S, players: number, rng?: () => number): S;
  move(state: S, seat: number, move: unknown, rng?: () => number): S;
  /**
   * What `seat` may see. This is the only way game state leaves the server, so
   * hidden information (hands, unrevealed picks) must be removed here.
   * `seat` is null for someone who is not playing.
   */
  view(state: S, seat: number | null): unknown;
  isOver(state: S): boolean;
}
