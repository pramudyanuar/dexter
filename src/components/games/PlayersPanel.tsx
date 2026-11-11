'use client';

import * as React from 'react';

import type { RoomView } from '@/lib/rooms/types';
import useWide from '@/lib/useWide';

import { seatName, useLang, useText } from '@/components/games/lang';

/**
 * Who is at the table, always visible beside the board on wide screens: whose
 * turn it is, who is the admin, who is out, and anything the game adds per
 * player (like cards left).
 */
export default function PlayersPanel({
  room,
  you,
  turn,
  detail,
}: {
  room: RoomView;
  you: number;
  /** The seat whose turn it is, if the game has turns */
  turn?: number | null;
  /** Game-specific text for a seat, shown on the right */
  detail?: (seat: number) => React.ReactNode;
}) {
  const wide = useWide();
  const t = useText();
  const lang = useLang();
  if (!wide) return null;
  const seats = room.joined.flatMap((taken, seat) => (taken ? [seat] : []));

  return (
    <aside
      aria-label={t.players}
      className='fixed top-16 left-4 z-30 flex w-64 flex-col overflow-hidden rounded-xl border border-line bg-card/70'
    >
      <h2 className='border-b border-line px-3 py-2 text-sm font-medium'>
        {t.players}
        <span className='ml-2 text-xs font-normal text-[var(--mute)]'>
          {seats.length}
        </span>
      </h2>
      <ul className='divide-y divide-line'>
        {seats.map((seat) => {
          const out = room.out[seat];
          const mine = turn === seat && !out && room.status === 'playing';
          const strikes = room.strikes[seat] ?? 0;
          return (
            <li
              key={seat}
              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                mine ? 'bg-accent/10' : ''
              } ${out ? 'opacity-45' : ''}`}
            >
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${
                  mine ? 'a-glow bg-accent' : 'bg-line-strong'
                }`}
              />
              <span className='min-w-0 flex-1 truncate'>
                {seatName(lang, seat, you, room.names)}
                {room.host === seat && (
                  <span className='ml-1.5 text-[10px] tracking-wide text-[var(--mute)] uppercase'>
                    {t.admin}
                  </span>
                )}
              </span>
              {strikes > 0 && !out && (
                <span
                  className='text-[11px] text-hash'
                  title={`${strikes}/${room.maxStrikes}`}
                >
                  {'!'.repeat(strikes)}
                </span>
              )}
              {out ? (
                <span className='text-[11px] text-[var(--mute)]'>{t.out}</span>
              ) : (
                detail?.(seat)
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
