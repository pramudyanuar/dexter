'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import SekataLobby from '@/features/games/components/sekata/SekataLobby';
import SekataTable from '@/features/games/components/sekata/SekataTable';
import type { SekataView } from '@/features/games/logic/sekata';
import RoomChat from '@/features/rooms/components/RoomChat';
import { Removed } from '@/features/rooms/components/RoomGate';
import RoomLobby from '@/features/rooms/components/RoomLobby';
import RoomNotice from '@/features/rooms/components/RoomNotice';
import { useRoom } from '@/features/rooms/useRoom';

function Sekata() {
  const r = useRoom<SekataView>('sekata');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Sekata: susun kartu suku kata jadi kata bahasa Indonesia, bareng teman. 3 sampai 10 pemain.'
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
        Menghubungkan…
      </p>
    );
  }
  if (r.room.status === 'waiting')
    return (
      <div className='xl:max-[1699px]:pr-[22rem]'>
        <SekataLobby r={r} />
      </div>
    );

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Menyiapkan kartu…
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
      <SekataTable r={r} view={view} />
    </div>
  );
}

export default function SekataGame() {
  const mounted = useMounted();
  return (
    <GameShell name='sekata' fluid>
      {mounted ? (
        <>
          <Sekata />
          <RoomChat game='sekata' />
        </>
      ) : null}
    </GameShell>
  );
}
