'use client';

import * as React from 'react';

import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import RoomBar from '@/components/games/RoomBar';
import RoomLobby, { NAME_MAX } from '@/components/games/RoomLobby';

/** "Kamu" for yourself, otherwise the player's name (or "Pemain N"). */
export const seatLabel = (
  seat: number,
  you: number,
  names?: (string | null)[],
) => (seat === you ? 'Kamu' : names?.[seat] || `Pemain ${seat + 1}`);

/** A name for the seat list: the player's name, with "(kamu)" on your own. */
export const seatTitle = (
  seat: number,
  you: number,
  names?: (string | null)[],
) => {
  const name = names?.[seat];
  if (seat === you) return name ? `${name} (kamu)` : 'Kamu';
  return name || `Pemain ${seat + 1}`;
};

/** Edit your name from the waiting room. Saves on blur or Enter. */
export function NameEditor({
  r,
}: {
  r: { name: string; busy: boolean; rename: (name: string) => unknown };
}) {
  const [draft, setDraft] = React.useState(r.name);
  const save = () => {
    if (draft.trim() !== r.name.trim()) r.rename(draft);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className='mx-auto mt-4 flex items-center justify-center gap-2 text-xs'
    >
      <span className='text-mute select-none'>Nama</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, NAME_MAX))}
        onBlur={save}
        placeholder='username kamu'
        aria-label='Ganti username'
        maxLength={NAME_MAX}
        className='w-36 rounded-sm border border-line bg-transparent px-2 py-1 placeholder:text-mute focus:border-accent focus:ring-0 focus:outline-none'
      />
      <button
        type='submit'
        disabled={r.busy || draft.trim() === r.name.trim()}
        className='text-info hover:underline disabled:opacity-40'
      >
        simpan
      </button>
    </form>
  );
}

/**
 * Who is in the room, shown above a running game so two-player games (which
 * otherwise only say "lawan") show who you are up against.
 */
export function PlayerStrip({
  names,
  joined,
  you,
}: {
  names: (string | null)[];
  joined: boolean[];
  you: number;
}) {
  const seats = joined.flatMap((taken, seat) => (taken ? [seat] : []));
  if (!seats.some((seat) => names[seat])) return null;
  return (
    <p className='mb-3 text-center text-xs text-mute' aria-label='Pemain'>
      {seats.map((seat, i) => (
        <React.Fragment key={seat}>
          {i > 0 && (
            <span className='px-1.5'>{seats.length === 2 ? 'vs' : '·'}</span>
          )}
          <span className={seat === you ? 'text-accent' : 'text-ink'}>
            {seatTitle(seat, you, names)}
          </span>
        </React.Fragment>
      ))}
    </p>
  );
}

type Room<V> = ReturnType<typeof useRoom<V>>;

/**
 * Everything around a game that is the same for every online game: the lobby,
 * the waiting room (with a start button for games with a flexible player
 * count), a "connecting" state, and the room bar. The game itself is rendered
 * by `children` once it is running.
 */
export default function RoomGate<V>({
  r,
  blurb,
  barRight,
  children,
}: {
  r: Room<V>;
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
        blurb={blurb}
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
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
                {taken
                  ? seatTitle(seat, you, room.names)
                  : `kursi ${seat + 1} kosong`}
              </span>
              {seat === 0 && taken ? (
                <span className='text-hash'>pembuat</span>
              ) : you === 0 && taken ? (
                <button
                  type='button'
                  onClick={() => r.kick(seat)}
                  disabled={r.busy}
                  className='text-xs text-err hover:underline disabled:opacity-40'
                >
                  keluarkan
                </button>
              ) : null}
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
                mulai dengan {joined} pemain
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
        <NameEditor r={r} />
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
      {/* games for more players list everyone with their names already */}
      {room.capacity === 2 && (
        <PlayerStrip names={room.names} joined={room.joined} you={you} />
      )}
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
      main lagi
    </button>
  );
}
