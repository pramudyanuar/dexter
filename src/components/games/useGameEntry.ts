'use client';

import { usePathname } from 'next/navigation';

import { GameEntry, GAMES } from '@/constant/games';

/** The menu entry of the game page being viewed, found from the URL. */
export default function useGameEntry(): GameEntry | null {
  const path = usePathname();
  return GAMES.find((g) => g.href === path) ?? null;
}
