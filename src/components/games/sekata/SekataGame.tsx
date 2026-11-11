'use client';

import * as React from 'react';

import type { SekataView } from '@/lib/games/sekata';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import RoomChat from '@/components/games/RoomChat';
import { Removed } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';
import SekataLobby from '@/components/games/sekata/SekataLobby';
import SekataTable from '@/components/games/sekata/SekataTable';

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
  if (r.room.status === 'waiting') return <SekataLobby r={r} />;

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        Menyiapkan kartu…
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
      <SekataTable r={r} view={view} />
    </>
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
