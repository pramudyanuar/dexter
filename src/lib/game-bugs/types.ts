import {
  BUG_DESCRIPTION_MAX,
  type BugReport as RoomBugReport,
} from '@/lib/rooms/bug-reports';

import { GAME_PAGES } from '@/constant/games';

export const BUG_DESCRIPTION_LIMIT = BUG_DESCRIPTION_MAX;
export const BUG_REPORT_PAGE_SIZE = 25;

const snakeModes: Record<string, string> = {
  '/games/snake/classic': 'Snake Classic',
  '/games/snake/daily': 'Snake Harian',
  '/games/snake/duel': 'Snake Duel',
};

export function getBugReportGame(pathname: string) {
  const game = GAME_PAGES.find(
    ({ id, href }) =>
      href === pathname ||
      (id === 'snake' && Object.hasOwn(snakeModes, pathname)),
  );
  if (!game) return null;
  return {
    game: game.id,
    gameTitle: snakeModes[pathname] ?? game.title,
    pathname,
  };
}

export interface BugReport {
  id: string;
  game: string;
  gameTitle: string;
  pathname: string;
  description: string;
  playerName?: string;
  at: number;
  done: boolean;
}

export type BugReportTarget = Pick<BugReport, 'id' | 'at'>;
export type BugReportAction = 'done' | 'reopen' | 'delete';
export type AdminBugReport = BugReport & { snapshot?: RoomBugReport };
