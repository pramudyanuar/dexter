import { battleshipGame } from '@/lib/games/battleship';
import { checkersGame } from '@/lib/games/checkers';
import { chessGame } from '@/lib/games/chess';
import { connect4Game } from '@/lib/games/connect4-online';
import { dominoGame } from '@/lib/games/domino';
import { gomokuGame } from '@/lib/games/gomoku';
import { diceGame } from '@/lib/games/liarsdice';
import { pictionaryGame } from '@/lib/games/pictionary';
import { quizGame } from '@/lib/games/quiz';
import { sekataGame } from '@/lib/games/sekata';
import { suitGame } from '@/lib/games/suit';
import { unoGame } from '@/lib/games/uno';
import { unoFlipGame, unoNoMercyGame } from '@/lib/games/unox';
import type { GameDef } from '@/lib/rooms/game';
import type { GameId } from '@/lib/rooms/types';

export const GAMES: Record<GameId, GameDef> = {
  connect4: connect4Game as GameDef,
  suit: suitGame as GameDef,
  uno: unoGame as GameDef,
  sekata: sekataGame as GameDef,
  unoflip: unoFlipGame as GameDef,
  unomercy: unoNoMercyGame as GameDef,
  battleship: battleshipGame as GameDef,
  gomoku: gomokuGame as GameDef,
  checkers: checkersGame as GameDef,
  chess: chessGame as GameDef,
  dice: diceGame as GameDef,
  domino: dominoGame as GameDef,
  quiz: quizGame as GameDef,
  pictionary: pictionaryGame as GameDef,
};

export const isGameId = (value: unknown): value is GameId =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(GAMES, value);
