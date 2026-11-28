import type { Level } from '@/features/games/logic/minesweeper';
import { LEVELS } from '@/features/games/logic/minesweeper';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  meta?: string;
  at: number;
  verified?: boolean;
  usedUndo?: boolean;
}

export const MAX_LEADERBOARD_ENTRIES = 20;

export const VALID_GAME_IDS = new Set([
  '2048',
  'minesweeper',
  'snake',
  'tetris',
]);

export function isMinesLevel(level: unknown): level is Level {
  return typeof level === 'string' && Object.hasOwn(LEVELS, level);
}

export function isLowerBetter(gameId: string): boolean {
  return gameId === 'minesweeper';
}

export function scoreUnit(gameId: string): string {
  if (gameId === 'minesweeper') return 'detik';
  if (gameId === 'wordle') return 'streak';
  if (['2048', 'snake', 'tetris'].includes(gameId)) return 'skor';
  return 'menang';
}

export function sortEntries(
  entries: LeaderboardEntry[],
  gameId: string,
): LeaderboardEntry[] {
  const asc = isLowerBetter(gameId);
  return [...entries]
    .sort(
      (a, b) =>
        Number(!!b.verified) - Number(!!a.verified) ||
        (asc ? a.score - b.score : b.score - a.score) ||
        a.at - b.at,
    )
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}
