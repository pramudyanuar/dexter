import Link from 'next/link';
import * as React from 'react';

import { GAMES } from '@/constant/games';

/** The frame shared by the games: plain and dark. The games are public. */
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
      <header className='sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur'>
        <div className='mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2.5'>
          <Link
            href={name ? '/games' : '/'}
            aria-label={name ? 'Kembali ke daftar game' : 'Beranda'}
            className='flex size-8 items-center justify-center rounded-md border border-line text-mute transition-colors hover:border-[#3a3a3a] hover:text-ink'
          >
            ←
          </Link>
          <span className='text-sm font-semibold tracking-tight'>
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
