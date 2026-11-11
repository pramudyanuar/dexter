'use client';

import Link from 'next/link';
import * as React from 'react';

import type { RoomSession } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';
import useStoredState from '@/lib/useStoredState';

import GameArt from '@/components/games/GameArt';
import GameShell from '@/components/games/GameShell';
import UnoGame from '@/components/games/uno/UnoGame';

const MODES = [
  {
    id: 'uno',
    title: 'Classic',
    blurb:
      'The Uno you know. Match colour or number, stack equal numbers, challenge a wild +4.',
    href: null,
  },
  {
    id: 'unoflip',
    title: 'Flip',
    blurb:
      'Double-sided cards. One FLIP turns everything to a darker, crueller side.',
    href: '/games/unoflip',
  },
  {
    id: 'unomercy',
    title: 'No Mercy',
    blurb:
      'Stack penalties, swap hands with a 7, pass them on with a 0. 25 cards and you are out.',
    href: '/games/unomercy',
  },
] as const;

const card =
  'group flex w-full items-center gap-4 rounded-xl border border-line bg-card/60 p-3 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--mute)] hover:bg-card active:scale-[0.99]';

/**
 * The front of Uno: pick which Uno to play. Classic opens in place (so the
 * splash does not run twice); the others are their own pages. A room already in
 * progress, or a shared `?room=` link, skips straight to Classic.
 */
export default function UnoEntry() {
  const mounted = useMounted();
  const [session] = useStoredState<RoomSession | null>(
    'room-session-uno',
    null,
    'tab',
  );
  const [classic, setClassic] = React.useState(false);

  const invited =
    mounted && new URLSearchParams(window.location.search).has('room');
  const inClassic = classic || !!session || invited;

  return (
    <GameShell name='uno' wide>
      {inClassic ? (
        <UnoGame game='uno' shell={false} />
      ) : mounted ? (
        <div className='a-slide-up'>
          <h1 className='mb-1 text-lg font-semibold tracking-tight'>
            Which Uno?
          </h1>
          <p className='mb-4 text-sm text-[var(--mute)]'>
            Pick a version. You can invite friends once you are in.
          </p>
          <ul className='space-y-3'>
            {MODES.map((m) => {
              const inner = (
                <>
                  <div className='h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-paper/60 p-1.5'>
                    <GameArt id={m.id} />
                  </div>
                  <span className='min-w-0'>
                    <span className='block font-semibold'>{m.title}</span>
                    <span className='mt-0.5 block text-sm text-[var(--mute)]'>
                      {m.blurb}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={m.id}>
                  {m.href ? (
                    <Link href={m.href} className={card}>
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type='button'
                      onClick={() => setClassic(true)}
                      className={card}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </GameShell>
  );
}
