import { GAMES } from '@/constant/games';

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  meta?: string;
  at: number;
}

export const MAX_LEADERBOARD_ENTRIES = 20;

export const VALID_GAME_IDS = new Set(GAMES.map((g) => g.id));

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
      (a, b) => (asc ? a.score - b.score : b.score - a.score) || a.at - b.at,
    )
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}
