'use client';

import * as React from 'react';

import type { TableView } from '@/lib/games/hk-mahjong/game';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import HongKongTable from '@/components/games/mahjong/HongKongTable';
import MahjongRulebook, {
  BookButton,
} from '@/components/games/mahjong/MahjongRulebook';
import RoomChat from '@/components/games/RoomChat';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

function TableRoom() {
  const r = useRoom<TableView>('mahjong-hk');
  const [reading, setReading] = React.useState(false);
  const state = r.room?.state;
  return (
    <>
      <div
        className={
          r.session
            ? 'mx-auto w-full max-w-5xl xl:max-[1699px]:max-w-none xl:max-[1699px]:pr-[22rem]'
            : ''
        }
      >
        <RoomGate
          r={r}
          guide={<BookButton onClick={() => setReading(true)} />}
          blurb='Main Mahjong Hong Kong seperti di meja Jakarta. Ajak tiga teman, duduk di empat penjuru, dan kumpulkan minimal tiga faan untuk menang.'
        >
          {({ room, you }) => (
            <>
              <HongKongTable
                v={room.state}
                you={you}
                names={room.names}
                busy={r.busy}
                turnDeadline={
                  room.waiting && r.receivedAt + room.waiting.remaining * 1000
                }
                onPlay={r.move}
              />
              {room.status === 'over' && !r.spectating && <Rematch r={r} />}
            </>
          )}
        </RoomGate>
      </div>
      {reading && (
        <MahjongRulebook
          onDismiss={() => setReading(false)}
          playing={r.room?.status === 'playing' && !state?.result}
          myTurn={!!state?.actions.length}
          decisionSeconds={
            state?.decisionSeconds ??
            (r.room?.options as { decisionSeconds?: number } | null)
              ?.decisionSeconds
          }
        />
      )}
      <RoomChat game='mahjong-hk' />
    </>
  );
}
export default function Page() {
  const mounted = useMounted();
  return (
    <GameShell name='mahjong-hk' fluid>
      {mounted && <TableRoom />}
    </GameShell>
  );
}
