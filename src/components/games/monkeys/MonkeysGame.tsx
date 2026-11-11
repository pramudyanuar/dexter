'use client';

import * as React from 'react';

import type { MonkeyView } from '@/lib/games/monkeys';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import { LangProvider } from '@/components/games/lang';
import MonkeyLobby from '@/components/games/monkeys/MonkeyLobby';
import MonkeyTable from '@/components/games/monkeys/MonkeyTable';
import { Removed } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';

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
