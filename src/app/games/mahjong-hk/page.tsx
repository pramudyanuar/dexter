'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import HongKongTable from '@/features/games/components/mahjong/HongKongTable';
import MahjongRulebook, {
  BookButton,
} from '@/features/games/components/mahjong/MahjongRulebook';
import type { TableView } from '@/features/games/logic/hk-mahjong/game';
import RoomChat from '@/features/rooms/components/RoomChat';
import RoomGate from '@/features/rooms/components/RoomGate';
import { useRoom } from '@/features/rooms/useRoom';

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
          blurb='Ajak tiga teman bermain Mahjong Hong Kong. Susun empat set dan satu pasang untuk menang dari tembok atau buangan lawan.'
        >
          {({ room, you }) => (
            <HongKongTable
              v={room.state}
              you={you}
              names={room.names}
              busy={r.busy}
              turnDeadline={
                room.waiting && r.receivedAt + room.waiting.remaining * 1000
              }
              onPlay={r.move}
              completeTable={room.joined.every(
                (joined, i) => joined && !room.out[i],
              )}
              onRematch={
                room.status === 'over' && !r.spectating && !room.out[you]
                  ? r.rematch
                  : undefined
              }
            />
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
