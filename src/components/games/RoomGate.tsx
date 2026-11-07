'use client';

import * as React from 'react';

import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import RoomBar from '@/components/games/RoomBar';
import RoomLobby from '@/components/games/RoomLobby';

export const seatLabel = (seat: number, you: number) =>
  seat === you ? 'Kamu' : `Pemain ${seat + 1}`;

type Room<V> = ReturnType<typeof useRoom<V>>;

/**
 * Everything around a game that is the same for every online game: the lobby,
 * the waiting room (with a start button for games with a flexible player
 * count), a "connecting" state, and the room bar. The game itself is rendered
 * by `children` once it is running.
 */
export default function RoomGate<V>({
  r,
  command,
  blurb,
  barRight,
  children,
}: {
  r: Room<V>;
  command: string;
  blurb: string;
  barRight?: React.ReactNode;
  children: (ctx: {
    room: RoomView<V> & { state: V };
    you: number;
    r: Room<V>;
  }) => React.ReactNode;
}) {
  if (!r.session) {
    return (
      <RoomLobby
        command={command}
        blurb={blurb}
        busy={r.busy}
        error={r.error}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  const { room } = r;
  const you = r.session.you;

  if (room && room.status === 'waiting') {
    const joined = room.joined.filter(Boolean).length;
    const flexible = room.minPlayers < room.capacity;
    return (
      <>
        <RoomBar code={r.session.code} share onLeave={r.leave} />
        <p className='a-bob mb-3 text-center text-sm' aria-live='polite'>
          Menunggu pemain ({joined}/{room.capacity})
        </p>
        <ul className='mx-auto w-full max-w-xs divide-y divide-line border-y border-line'>
          {room.joined.map((taken, seat) => (
            <li
              key={seat}
              className={`flex justify-between py-2 text-sm ${taken ? 'a-pop' : ''}`}
            >
              <span className={taken ? '' : 'text-mute'}>
                {taken ? seatLabel(seat, you) : `kursi ${seat + 1} kosong`}
              </span>
              {seat === 0 && taken && (
                <span className='text-hash'>pembuat</span>
              )}
            </li>
          ))}
        </ul>

        <div className='mt-4 text-center text-xs'>
          {flexible ? (
            you === 0 ? (
              <button
                type='button'
                onClick={r.start}
                disabled={r.busy || joined < room.minPlayers}
                className='text-info hover:underline disabled:opacity-40'
              >
                [mulai dengan {joined} pemain]
              </button>
            ) : (
              <span className='text-mute'>Menunggu pembuat room memulai…</span>
            )
          ) : (
            <span className='text-mute'>
              Bagikan kode atau link di atas ke lawanmu.
            </span>
          )}
          {flexible && you === 0 && joined < room.minPlayers && (
            <p className='mt-1 text-mute'>
              Butuh minimal {room.minPlayers} pemain.
            </p>
          )}
        </div>
        {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
      </>
    );
  }

  if (!room || room.state === null) {
    return (
      <>
        <RoomBar code={r.session.code} share={false} onLeave={r.leave} />
        <p className='text-center text-sm text-mute'>Menghubungkan…</p>
        {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
      </>
    );
  }

  return (
    <>
      <RoomBar
        code={r.session.code}
        share={false}
        onLeave={r.leave}
        right={barRight}
      />
      {children({
        room: room as RoomView<V> & { state: V },
        you,
        r,
      })}
      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
    </>
  );
}

/** "[main lagi]" once a game is over. */
export function Rematch({ r }: { r: { busy: boolean; rematch: () => void } }) {
  return (
    <button
      type='button'
      onClick={r.rematch}
      disabled={r.busy}
      className='a-slide-up mt-4 self-center text-xs text-info hover:underline'
    >
      [main lagi]
    </button>
  );
}
