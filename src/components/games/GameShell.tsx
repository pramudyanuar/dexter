import Link from 'next/link';
import * as React from 'react';

import { GAMES } from '@/constant/games';

/** The frame shared by the games: a light, playful look. The games are public. */
export default function GameShell({
  name,
  children,
  wide,
}: {
  /** The game's route name (e.g. `uno`); omit on the menu page. */
  name?: string;
  children: React.ReactNode;
  /** Wider column, for boards that need the room. */
  wide?: boolean;
}) {
  // pages pass the menu id (e.g. `catur`) or the route (`snake`)
  const game = name
    ? GAMES.find((g) => g.id === name || g.href === `/games/${name}`)
    : undefined;

  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      <header className='sticky top-0 z-40 border-b border-line/70 bg-paper/70 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3'>
          {name ? (
            <Link
              href='/games'
              aria-label='Kembali ke daftar game'
              className='flex size-9 items-center justify-center rounded-full bg-card text-lg shadow-sm transition-transform hover:-translate-x-0.5'
            >
              ←
            </Link>
          ) : (
            <Link
              href='/'
              aria-label='Beranda'
              className='flex size-9 items-center justify-center rounded-full bg-card text-lg shadow-sm transition-transform hover:-translate-x-0.5'
            >
              ⌂
            </Link>
          )}
          <span className='flex items-center gap-2 text-lg font-bold'>
            <span aria-hidden>{game?.icon ?? '🎮'}</span>
            {game?.title ?? (name ? name : 'Games')}
          </span>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 ${
          wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
