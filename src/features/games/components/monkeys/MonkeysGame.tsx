'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import { LangProvider } from '@/features/games/components/lang';
import MonkeyLobby from '@/features/games/components/monkeys/MonkeyLobby';
import MonkeyTable from '@/features/games/components/monkeys/MonkeyTable';
import type { MonkeyView } from '@/features/games/logic/monkeys';
import { Removed } from '@/features/rooms/components/RoomGate';
import RoomLobby from '@/features/rooms/components/RoomLobby';
import RoomNotice from '@/features/rooms/components/RoomNotice';
import { useRoom } from '@/features/rooms/useRoom';

function Monkeys() {
  const r = useRoom<MonkeyView>('monkeys');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Three Monkeys: Bomb Defusal. Exactly three players: one touches the bomb, one reads the manual, one sees and speaks.'
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  if (r.room && r.room.seat === null) return <Removed r={r} />;

  if (!r.room) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Connecting…
      </p>
    );
  }
  if (r.room.status === 'waiting') return <MonkeyLobby r={r} />;

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Arming the bomb…
      </p>
    );
  }

  return (
    <>
      <RoomNotice
        room={r.room}
        you={r.session.you}
        receivedAt={r.receivedAt}
        onKick={r.kick}
        busy={r.busy}
        code={r.session.code}
        onLeave={r.leave}
      />
      <MonkeyTable r={r} view={view} />
    </>
  );
}

export default function MonkeysGame() {
  const mounted = useMounted();
  return (
    <GameShell name='monkeys' fluid>
      {mounted ? (
        <LangProvider value='en'>
          <Monkeys />
        </LangProvider>
      ) : null}
    </GameShell>
  );
}
