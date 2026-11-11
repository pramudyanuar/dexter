'use client';

import * as React from 'react';

import type { RemoView } from '@/lib/games/remo';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import { LangProvider } from '@/components/games/lang';
import RemoLobby from '@/components/games/remo/RemoLobby';
import RemoTable from '@/components/games/remo/RemoTable';
import RoomChat from '@/components/games/RoomChat';
import { Removed } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';

const DOCK = 'xl:max-[1699px]:pr-[22rem]';

function Remo() {
  const r = useRoom<RemoView>('remo');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Remo (rummy) untuk 2 sampai 4 pemain: susun urutan dan kembar, habiskan kartumu duluan.'
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
