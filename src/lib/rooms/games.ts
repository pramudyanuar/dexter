import { connect4Game } from '@/lib/games/connect4-online';
import { suitGame } from '@/lib/games/suit';
import { unoGame } from '@/lib/games/uno';
import type { GameDef } from '@/lib/rooms/game';
import type { GameId } from '@/lib/rooms/types';

export const GAMES: Record<GameId, GameDef> = {
  connect4: connect4Game as GameDef,
  suit: suitGame as GameDef,
  uno: unoGame as GameDef,
};

export const isGameId = (value: unknown): value is GameId =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(GAMES, value);
