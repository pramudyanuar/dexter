'use client';

import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';

import { type GameVisits, readGameVisits } from '@/features/games/discovery';

export const LAST_GAME_KEY = 'last-game';
export const GAME_VISITS_KEY = 'game-visits';

/** Record an opening once per game page mount, including Strict Mode effect replay. */
export default function RememberGame({ id }: { id: string }) {
  const [, setLast] = useStoredState<string | null>(LAST_GAME_KEY, null);
  const [, setVisits] = useStoredState<GameVisits>(GAME_VISITS_KEY, {});
  const recorded = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (recorded.current === id) return;
    recorded.current = id;
    let visits: GameVisits = {};
    try {
      visits = readGameVisits(
        JSON.parse(localStorage.getItem(GAME_VISITS_KEY) ?? 'null'),
      );
    } catch {
      // A corrupt, blocked, or unavailable storage area should not interrupt play.
    }
    setVisits({
      ...visits,
      [id]: { count: (visits[id]?.count ?? 0) + 1, lastOpenedAt: Date.now() },
    });
    setLast(id);
  }, [id, setLast, setVisits]);

  return null;
}
