'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import { LangProvider } from '@/features/games/components/lang';
import RemoLobby from '@/features/games/components/remo/RemoLobby';
import RemoTable from '@/features/games/components/remo/RemoTable';
import type { RemoView } from '@/features/games/logic/remo';
import RoomChat from '@/features/rooms/components/RoomChat';
import { Removed } from '@/features/rooms/components/RoomGate';
import RoomLobby from '@/features/rooms/components/RoomLobby';
import RoomNotice from '@/features/rooms/components/RoomNotice';
import { useRoom } from '@/features/rooms/useRoom';

const DOCK = 'xl:max-[1699px]:pr-[22rem]';

function Remo() {
  const r = useRoom<RemoView>('remo');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='Remi gaya rummy untuk 2–4 pemain. Susun seri dan set, lalu habiskan kartumu duluan.'
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
  if (r.room.status === 'waiting') {
    return (
      <div className={DOCK}>
        <RemoLobby r={r} />
      </div>
    );
  }

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Shuffling the deck…
      </p>
    );
  }

  return (
    <div className={DOCK}>
      <RoomNotice
        room={r.room}
        you={r.session.you}
        receivedAt={r.receivedAt}
        onKick={r.kick}
        busy={r.busy}
        code={r.session.code}
        onLeave={r.leave}
      />
      <RemoTable r={r} view={view} />
    </div>
  );
}

export default function RemoGame() {
  const mounted = useMounted();
  return (
    <GameShell name='remo' fluid>
      {mounted ? (
        <LangProvider value='en'>
          <Remo />
          <RoomChat game='remo' />
        </LangProvider>
      ) : null}
    </GameShell>
  );
}
