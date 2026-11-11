'use client';

import * as React from 'react';

import { MAX_STRIKES, OutWhy, RoomView } from '@/lib/rooms/types';

import { seatLabel } from '@/components/games/RoomGate';

/** Re-renders once a second, so countdowns tick. */
function useTick(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const outline =
  'rounded-md border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] transition-colors hover:border-[var(--mute)] hover:text-ink disabled:opacity-40';

/**
 * The admin's way to remove a player in the middle of a game. Asks twice, in
 * place, since it cannot be undone.
 */
function AdminPanel({
  room,
  you,
  busy,
  onKick,
}: {
  room: RoomView;
  you: number;
  busy?: boolean;
  onKick: (seat: number) => void;
}) {
  const [confirming, setConfirming] = React.useState<number | null>(null);
  const seats = room.joined.flatMap((taken, seat) =>
    taken && seat !== you && !room.out[seat] ? [seat] : [],
  );
  if (!seats.length) return null;

  return (
    <details className='group rounded-lg border border-line bg-surface/50 text-sm'>
      <summary className='flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs text-[var(--mute)] select-none'>
        <span>Kamu admin room ini</span>
        <span className='transition-colors group-open:text-ink'>
          Kelola pemain
        </span>
      </summary>
      <ul className='space-y-1.5 border-t border-line p-2'>
        {seats.map((seat) => (
          <li
            key={seat}
            className='flex items-center justify-between gap-3 px-1 py-0.5'
          >
            <span className='min-w-0 truncate'>
              {seatLabel(seat, you, room.names)}
            </span>
            {confirming === seat ? (
              <span className='flex shrink-0 items-center gap-2'>
                <span className='text-xs text-[var(--mute)]'>Yakin?</span>
                <button
                  type='button'
                  disabled={busy}
                  onClick={() => {
                    setConfirming(null);
                    onKick(seat);
                  }}
                  className='rounded-md bg-err px-2.5 py-1 text-xs font-medium text-paper disabled:opacity-40'
                >
                  Keluarkan
                </button>
                <button
                  type='button'
                  onClick={() => setConfirming(null)}
                  className={outline}
                >
                  Batal
                </button>
              </span>
            ) : (
              <button
                type='button'
                onClick={() => setConfirming(seat)}
                className={`${outline} hover:border-err hover:text-err`}
              >
                Keluarkan
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const WHY_ME: Record<OutWhy, string> = {
  kicked: 'Kamu dikeluarkan dari permainan oleh admin.',
  idle: 'Kamu dikeluarkan dari permainan karena terlalu lama tidak bergerak.',
  left: 'Kamu keluar dari permainan.',
};

const WHY_OTHER: Record<OutWhy, string> = {
  kicked: 'dikeluarkan admin.',
  idle: 'dikeluarkan karena terlalu lama tidak bergerak.',
  left: 'keluar dari permainan.',
};

/**
 * What every player should know about the table: who is on their way out (and
 * how long they have to come back), whose turn is about to run out, missed-turn
 * warnings, who left or was removed, who the admin is now, and for the admin a
 * way to remove someone.
 */
export default function RoomNotice({
  room,
  you,
  receivedAt,
  onKick,
  busy,
}: {
  room: RoomView | null;
  you: number;
  /** When the room view arrived, so countdowns can run from there */
  receivedAt: number;
  onKick?: (seat: number) => void;
  busy?: boolean;
}) {
  const live = room?.status === 'playing';
  const now = useTick(!!live || !!room?.hostNotice);
  if (!room || room.status === 'waiting') return null;

  const elapsed = Math.floor((now - receivedAt) / 1000);
  const nameOf = (seat: number) => seatLabel(seat, you, room.names);
  const lines: {
    key: string;
    tone: 'err' | 'warn' | 'mute';
    text: React.ReactNode;
  }[] = [];

  if (room.out[you]) {
    lines.push({
      key: 'me-out',
      tone: 'err',
      text: WHY_ME[room.outWhy[you] ?? 'left'],
    });
  }

  // who left, so a win (or an empty seat) is explained
  room.out.forEach((gone, seat) => {
    if (!gone || seat === you) return;
    lines.push({
      key: `out-${seat}`,
      tone: 'mute',
      text: `${nameOf(seat)} ${WHY_OTHER[room.outWhy[seat] ?? 'left']}`,
    });
  });

  if (live) {
    for (const a of room.leaving) {
      if (a.seat === you) continue;
      const left = Math.max(0, a.goneIn - elapsed);
      lines.push({
        key: `leaving-${a.seat}`,
        tone: 'warn',
        text: `${nameOf(a.seat)} keluar. Dikeluarkan dari permainan dalam ${left} detik kalau tidak kembali.`,
      });
    }
  }

  if (room.hostNotice - elapsed > 0 && room.joined[room.host]) {
    lines.push({
      key: 'host',
      tone: 'mute',
      text:
        room.host === you
          ? 'Kamu sekarang admin room.'
          : `${nameOf(room.host)} sekarang admin room.`,
    });
  }

  const strikes = room.strikes[you] ?? 0;
  if (live && strikes > 0 && !room.out[you]) {
    lines.push({
      key: 'strikes',
      tone: 'warn',
      text: `Peringatan ${strikes}/${MAX_STRIKES}: kamu terlalu lama tidak bergerak. Di ${MAX_STRIKES} kali kamu dikeluarkan.`,
    });
  }

  // the turn clock, for whoever is being waited on
  let clock: React.ReactNode = null;
  const waiting = live ? room.waiting : null;
  if (waiting && !room.out[you]) {
    const left = Math.max(0, waiting.remaining - elapsed);
    const mine = waiting.seats.includes(you);
    const urgent = left <= 10;
    clock = (
      <div data-testid='turn-clock'>
        <div className='h-1 overflow-hidden rounded-full bg-line'>
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
              mine && urgent ? 'bg-err' : 'bg-accent'
            }`}
            style={{
              width: `${Math.min(100, (left / waiting.seconds) * 100)}%`,
            }}
          />
        </div>
        <p
          className={`mt-1 text-center text-xs ${
            mine && urgent ? 'font-medium text-err' : 'text-[var(--mute)]'
          }`}
        >
          {mine
            ? `Giliranmu habis dalam ${left} detik`
            : `Menunggu ${waiting.seats.map(nameOf).join(', ')}: ${left} detik`}
        </p>
      </div>
    );
  }

  const admin =
    onKick && room.host === you && !room.out[you] ? (
      <AdminPanel room={room} you={you} busy={busy} onKick={onKick} />
    ) : null;

  if (!lines.length && !clock && !admin) return null;
  return (
    <div className='mb-3 space-y-1.5' aria-live='polite'>
      {lines.map((l) => (
        <p
          key={l.key}
          role={l.tone === 'err' ? 'alert' : undefined}
          className={`a-slide-up rounded-lg border px-3 py-2 text-center text-xs ${
            l.tone === 'err'
              ? 'border-err/50 bg-err/10 text-err'
              : l.tone === 'warn'
                ? 'border-hash/50 bg-hash/10 text-hash'
                : 'border-line text-[var(--mute)]'
          }`}
        >
          {l.text}
        </p>
      ))}
      {clock}
      {admin}
    </div>
  );
}
