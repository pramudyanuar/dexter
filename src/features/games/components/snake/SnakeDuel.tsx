'use client';

import * as React from 'react';

import SnakeDuelConnection from '@/features/games/components/snake/SnakeDuelConnection';
import SnakeDuelLobby from '@/features/games/components/snake/SnakeDuelLobby';
import type { DuelSession } from '@/features/snake-duel/protocol';

export default function SnakeDuel({ invite }: { invite: string }) {
  const [selected, setSelected] = React.useState<
    DuelSession | null | undefined
  >(undefined);

  function select(next: DuelSession | null) {
    setSelected(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('room', next.code);
    else url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  }

  return selected ? (
    <SnakeDuelConnection
      key={selected.token}
      session={selected}
      onExit={() => select(null)}
    />
  ) : (
    <SnakeDuelLobby invite={selected === null ? '' : invite} onEnter={select} />
  );
}
