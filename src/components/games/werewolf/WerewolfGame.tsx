'use client';

import * as React from 'react';

import type { WerewolfView } from '@/lib/games/werewolf';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import { LangProvider } from '@/components/games/lang';
import RoomChat from '@/components/games/RoomChat';
import { Removed } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';
import WerewolfLobby from '@/components/games/werewolf/WerewolfLobby';
import WerewolfTable from '@/components/games/werewolf/WerewolfTable';

const DOCK = 'xl:max-[1699px]:pr-[22rem]';

function Werewolf() {
  const r = useRoom<WerewolfView>('werewolf');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Werewolf untuk 5 sampai 20 pemain: peran rahasia, malam yang panjang, dan desa yang harus menemukan serigalanya.'
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
        <WerewolfLobby r={r} />
        <RoomChat game='werewolf' names={r.room.names} />
      </div>
    );
  }

  const view = r.room.state;
  if (!view) {
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]' role='status'>
        The moon rises…
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
      <WerewolfTable r={r} view={view} />
      <RoomChat game='werewolf' names={r.room.names} />
    </div>
  );
}

export default function WerewolfGame() {
  const mounted = useMounted();
  return (
    <GameShell name='werewolf' fluid>
      {mounted ? (
        <LangProvider value='en'>
          <Werewolf />
        </LangProvider>
      ) : null}
    </GameShell>
  );
}
