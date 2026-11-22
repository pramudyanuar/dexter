'use client';

import * as React from 'react';

import { NAME_MAX as PLAYER_NAME_MAX } from '@/lib/rooms/player-name';
import useStoredState from '@/lib/useStoredState';

export const PLAYER_NAME_KEY = 'player-name';
const LEGACY_PLAYER_NAME_KEY = 'dexter:player-name';
export { PLAYER_NAME_MAX };

/**
 * Shared player display name persisted in localStorage across all games,
 * lobbies, and scoreboards. Migrates the legacy `dexter:player-name` key if present.
 */
export default function usePlayerName() {
  const [name, setName] = useStoredState<string>(PLAYER_NAME_KEY, '');

  React.useEffect(() => {
    if (name) return;
    try {
      const legacy = localStorage.getItem(LEGACY_PLAYER_NAME_KEY);
      if (!legacy) return;
      const parsed = JSON.parse(legacy) as unknown;
      if (typeof parsed === 'string' && parsed.trim()) {
        setName(parsed.slice(0, PLAYER_NAME_MAX));
      }
    } catch {
      // ignore malformed legacy value
    }
  }, [name, setName]);

  return [name, setName] as const;
}
