'use client';

import * as React from 'react';

import type { DartView } from '@/lib/games/dart';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import DartLobby from '@/components/games/dart/DartLobby';
import DartTable from '@/components/games/dart/DartTable';
import GameShell from '@/components/games/GameShell';
import { LangProvider } from '@/components/games/lang';
import RoomChat from '@/components/games/RoomChat';
import { Removed } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';

function Dart() {
  const r = useRoom<DartView>('dart');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Dart untuk 1 sampai 4 pemain: 301, 501, Count Up, Around the Clock dan Cricket.'
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  // taken out of the room (disconnected, or removed by the admin)
  if (r.room && r.room.seat === null) return <Removed r={r} />;

  if (!r.room) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Connecting…
      </p>
    );
  }
  if (r.room.status === 'waiting')
    return (
      <div className='xl:max-[1699px]:pr-[22rem]'>
        <DartLobby r={r} />
      </div>
    );

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Setting up the board…
      </p>
    );
  }

  return (
    <div className='xl:max-[1699px]:pr-[22rem]'>
      <RoomNotice
        room={r.room}
        you={r.session.you}
        receivedAt={r.receivedAt}
        onKick={r.kick}
        busy={r.busy}
        code={r.session.code}
        onLeave={r.leave}
      />
      <DartTable r={r} view={view} />
    </div>
  );
}

export default function DartGame() {
  const mounted = useMounted();
  return (
    <GameShell name='dart' fluid>
      {mounted ? (
        <LangProvider value='en'>
          <Dart />
          <RoomChat game='dart' />
        </LangProvider>
      ) : null}
    </GameShell>
  );
}
