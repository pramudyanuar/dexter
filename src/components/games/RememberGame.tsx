'use client';

import * as React from 'react';

import useStoredState from '@/lib/useStoredState';

export const LAST_GAME_KEY = 'last-game';

/** Remembers the game being played, so the menu can offer to continue it. */
export default function RememberGame({ id }: { id: string }) {
  const [last, setLast] = useStoredState<string | null>(LAST_GAME_KEY, null);
  React.useEffect(() => {
    if (last !== id) setLast(id);
  }, [id, last, setLast]);
  return null;
}
