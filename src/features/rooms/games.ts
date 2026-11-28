import { battleshipGame } from '@/features/games/logic/battleship';
import { checkersGame } from '@/features/games/logic/checkers';
import { chessGame } from '@/features/games/logic/chess';
import { connect4Game } from '@/features/games/logic/connect4-online';
import { dartGame } from '@/features/games/logic/dart';
import { dominoGame } from '@/features/games/logic/domino';
import { geludGame } from '@/features/games/logic/gelud';
import { gomokuGame } from '@/features/games/logic/gomoku';
import { hkMahjongGame } from '@/features/games/logic/hk-mahjong/game';
import { karambolGame } from '@/features/games/logic/karambol';
import { diceGame } from '@/features/games/logic/liarsdice';
import { monkeysGame } from '@/features/games/logic/monkeys';
import { pictionaryGame } from '@/features/games/logic/pictionary';
import { pokerGame } from '@/features/games/logic/poker';
import { quizGame } from '@/features/games/logic/quiz';
import { remoGame } from '@/features/games/logic/remo';
import { sekataGame } from '@/features/games/logic/sekata';
import { suitGame } from '@/features/games/logic/suit';
import { unoGame } from '@/features/games/logic/uno';
import { unoFlipGame, unoNoMercyGame } from '@/features/games/logic/unox';
import { werewolfGame } from '@/features/games/logic/werewolf';
import type { GameDef } from '@/features/rooms/game';
import type { GameId } from '@/features/rooms/types';

export const GAMES: Record<GameId, GameDef> = {
  connect4: connect4Game as GameDef,
  suit: suitGame as GameDef,
  uno: unoGame as GameDef,
  sekata: sekataGame as GameDef,
  dart: dartGame as GameDef,
  remo: remoGame as GameDef,
  werewolf: werewolfGame as GameDef,
  monkeys: monkeysGame as GameDef,
  unoflip: unoFlipGame as GameDef,
  unomercy: unoNoMercyGame as GameDef,
  battleship: battleshipGame as GameDef,
  gomoku: gomokuGame as GameDef,
  checkers: checkersGame as GameDef,
  chess: chessGame as GameDef,
  dice: diceGame as GameDef,
  domino: dominoGame as GameDef,
  'mahjong-hk': hkMahjongGame as GameDef,
  quiz: quizGame as GameDef,
  pictionary: pictionaryGame as GameDef,
  poker: pokerGame as GameDef,
  karambol: karambolGame as GameDef,
  gelud: geludGame as GameDef,
};

export const isGameId = (value: unknown): value is GameId =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(GAMES, value);
