'use client';

import * as React from 'react';

import type { DuelSession } from '@/lib/snake-duel/protocol';
import useStoredState from '@/lib/useStoredState';

import SnakeDuelLobby from '@/components/games/snake/SnakeDuelLobby';
import SnakeDuelRoom from '@/components/games/snake/SnakeDuelRoom';

export default function SnakeDuel({ invite }: { invite: string }) {
  const [saved, store] = useStoredState<DuelSession | null>(
    'snake-duel-seat',
    null,
    'tab',
  );
  const [selected, setSelected] = React.useState<
    DuelSession | null | undefined
  >(undefined);
  const restored = !invite || saved?.code === invite ? saved : null;
  const session = selected === undefined ? restored : selected;

  function select(next: DuelSession | null) {
    setSelected(next);
    store(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('room', next.code);
    else url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  }

  return session ? (
    <SnakeDuelRoom
      key={session.token}
      session={session}
      onExit={() => select(null)}
    />
  ) : (
    <SnakeDuelLobby invite={selected === null ? '' : invite} onEnter={select} />
  );
}
