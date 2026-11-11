'use client';

import * as React from 'react';

import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import RoomBar, { inviteLink, useCopy } from '@/components/games/RoomBar';
import RoomLobby, { NAME_MAX } from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';

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
  const changed = draft.trim() !== r.name.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className='mt-5 flex items-center gap-2'
    >
      <label className='flex min-w-0 flex-1 items-center gap-3 text-sm'>
        <span className='shrink-0 text-[var(--mute)]'>Namamu</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, NAME_MAX))}
          onBlur={save}
          placeholder='username kamu'
          aria-label='Ganti username'
          maxLength={NAME_MAX}
          className='min-w-0 flex-1'
        />
      </label>
      {changed && (
        <button
          type='submit'
          disabled={r.busy}
          className='a-fade shrink-0 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-40'
        >
          Simpan
        </button>
      )}
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

/** What the waiting room needs from a room hook. */
interface WaitingApi {
  session: { code: string; you: number } | null;
  room: {
    joined: boolean[];
    names: (string | null)[];
    capacity: number;
    minPlayers: number;
    /** Seat of the admin */
    host: number;
  } | null;
  name: string;
  busy: boolean;
  error: string;
  rename: (name: string) => unknown;
  kick: (seat: number) => unknown;
  start: () => unknown;
  leave: () => void;
}

const outline =
  'rounded-md border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

/**
 * The room before the game starts: a big code to read out or copy, who has
 * joined, and for the host a start button (or, for fixed-size games, a note
 * that it begins by itself).
 */
export function WaitingRoom({ r }: { r: WaitingApi }) {
  const { copied, copy } = useCopy();
  if (!r.session || !r.room) return null;
  const { code, you } = r.session;
  const { room } = r;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));
  const empty = room.capacity - seats.length;
  const flexible = room.minPlayers < room.capacity;
  const host = room.host;

  return (
    <div className='mx-auto w-full max-w-md'>
      <div className='mb-4 flex justify-end'>
        <button
          type='button'
          onClick={r.leave}
          className={`${outline} hover:border-err hover:text-err`}
        >
          Keluar
        </button>
      </div>

      <section className='rounded-xl border border-line bg-surface/50 p-5 text-center'>
        <p className='text-xs text-[var(--mute)]'>
          Bagikan kode ini ke temanmu
        </p>
        <button
          type='button'
          onClick={() => copy('code', code)}
          aria-label={`Salin kode room ${code}`}
          className='mt-2 font-mono text-4xl font-medium tracking-[0.3em] text-ink transition-opacity hover:opacity-80'
        >
          {code}
        </button>
        <p className='mt-1 h-4 text-xs text-[var(--mute)]' aria-live='polite'>
          {copied === 'code' ? 'Kode tersalin' : 'Ketuk kode untuk menyalin'}
        </p>
        <button
          type='button'
          onClick={() => copy('link', inviteLink(code))}
          className={`${outline} mt-3`}
        >
          {copied === 'link' ? 'Link tersalin' : 'Salin link undangan'}
        </button>
      </section>

      <div className='mt-6 flex items-baseline justify-between'>
        <h2 className='text-sm font-semibold'>Pemain</h2>
        <span className='text-xs text-[var(--mute)]' aria-live='polite'>
          {seats.length} dari {room.capacity}
        </span>
      </div>

      <ul className='mt-2 space-y-2'>
        {seats.map((seat) => {
          const label = room.names[seat] || `Pemain ${seat + 1}`;
          return (
            <li
              key={seat}
              data-seat={seat}
              className='a-pop flex items-center gap-3 rounded-lg border border-line bg-surface/50 px-3 py-2'
            >
              <span
                aria-hidden
                className='flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-card text-sm font-medium uppercase'
              >
                {label.charAt(0)}
              </span>
              <span className='min-w-0 flex-1 truncate text-sm'>
                {label}
                {seat === you && (
                  <span className='ml-1.5 text-xs text-[var(--mute)]'>
                    (kamu)
                  </span>
                )}
              </span>
              {seat === host ? (
                <span className='shrink-0 rounded border border-line-strong px-1.5 py-px text-[11px] text-[var(--mute)]'>
                  admin
                </span>
              ) : (
                you === host && (
                  <button
                    type='button'
                    onClick={() => r.kick(seat)}
                    disabled={r.busy}
                    className={`${outline} hover:border-err hover:text-err`}
                  >
                    Keluarkan
                  </button>
                )
              )}
            </li>
          );
        })}
        {empty > 0 && (
          <li className='flex items-center gap-3 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-[var(--mute)]'>
            <span
              aria-hidden
              className='flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong'
            >
              +
            </span>
            <span className='a-bob-soft'>
              {empty === 1
                ? 'Menunggu satu pemain lagi…'
                : `Menunggu pemain… (${empty} kursi kosong)`}
            </span>
          </li>
        )}
      </ul>

      <div className='mt-5 text-center'>
        {flexible ? (
          you === host ? (
            <>
              <button
                type='button'
                onClick={r.start}
                disabled={r.busy || seats.length < room.minPlayers}
                className='w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition-[transform,opacity] hover:opacity-90 active:scale-[0.99] disabled:opacity-40'
              >
                Mulai main · {seats.length} pemain
              </button>
              {seats.length < room.minPlayers && (
                <p className='mt-1.5 text-xs text-[var(--mute)]'>
                  Butuh minimal {room.minPlayers} pemain untuk mulai.
                </p>
              )}
            </>
          ) : (
            <p className='text-sm text-[var(--mute)]'>
              Menunggu admin room memulai…
            </p>
          )
        ) : (
          <p className='text-sm text-[var(--mute)]'>
            Game mulai otomatis begitu semua pemain masuk.
          </p>
        )}
      </div>

      <NameEditor r={r} />
      {r.error && (
        <p
          role='alert'
          className='mt-4 rounded-lg border border-err/50 bg-err/10 px-3 py-2 text-center text-sm text-err'
        >
          {r.error}
        </p>
      )}
    </div>
  );
}

type Room<V> = ReturnType<typeof useRoom<V>>;

/** Shown to a player whose seat was taken away because they disconnected or kept missing turns. */
export function Removed({
  r,
}: {
  r: { session: { code: string } | null; leave: () => void };
}) {
  if (!r.session) return null;
  return (
    <>
      <RoomBar code={r.session.code} share={false} onLeave={r.leave} />
      <p
        className='mx-auto mt-6 max-w-sm text-center text-sm text-err'
        role='alert'
      >
        Kamu sudah tidak ada di room ini. Kamu bisa keluar dan masuk lagi dengan
        kode room kalau masih ada kursi.
      </p>
    </>
  );
}

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

  // taken out of the room (left for too long): nothing more to do here
  if (room && room.seat === null) return <Removed r={r} />;

  if (room && room.status === 'waiting') return <WaitingRoom r={r} />;

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
      <RoomNotice
        room={room}
        you={you}
        receivedAt={r.receivedAt}
        onKick={r.kick}
        busy={r.busy}
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
export function Rematch({
  r,
}: {
  r: {
    busy: boolean;
    rematch: () => void;
    room?: { out: boolean[] } | null;
    session?: { you: number } | null;
  };
}) {
  // someone who was removed from the game cannot start the next round
  if (r.session && r.room?.out[r.session.you]) return null;
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
