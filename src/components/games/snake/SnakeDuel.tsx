'use client';

import * as React from 'react';

import type { DuelSession } from '@/lib/snake-duel/protocol';

import SnakeDuelConnection from '@/components/games/snake/SnakeDuelConnection';
import SnakeDuelLobby from '@/components/games/snake/SnakeDuelLobby';

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
