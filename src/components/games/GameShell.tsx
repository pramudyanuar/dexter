import Link from 'next/link';
import * as React from 'react';

import RememberGame from '@/components/games/RememberGame';

import { GAMES } from '@/constant/games';

/** The frame shared by the games: plain and dark. The games are public. */
export default function GameShell({
  name,
  children,
  wide,
  menu,
}: {
  /** The game's route name (e.g. `uno`); omit on the menu page. */
  name?: string;
  children: React.ReactNode;
  /** Wider column, for boards that need the room. */
  wide?: boolean;
  /** The games list itself: widest column, and no way "back" from it. */
  menu?: boolean;
}) {
  // pages pass the menu id (e.g. `chess`) or the route (`snake`)
  const game = name
    ? GAMES.find((g) => g.id === name || g.href === `/games/${name}`)
    : undefined;

  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      <header className='sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur'>
        <div
          className={`mx-auto flex w-full items-center gap-3 px-4 py-2.5 ${
            menu ? 'max-w-7xl' : 'max-w-3xl'
          }`}
        >
          {name && (
            <Link
              href='/games'
              aria-label='Kembali ke daftar game'
              className='flex size-8 items-center justify-center rounded-md border border-line text-mute transition-colors hover:border-[#3a3a3a] hover:text-ink'
            >
              ←
            </Link>
          )}
          <span className='text-sm font-semibold tracking-tight'>
            {game?.title ?? (name ? name : 'Games')}
          </span>
        </div>
      </header>

      {game && <RememberGame id={game.id} />}

      <main
        className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 ${
          menu ? 'max-w-7xl' : wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
