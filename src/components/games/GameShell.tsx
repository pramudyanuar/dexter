import Link from 'next/link';
import * as React from 'react';

import DocumentTitle from '@/components/games/DocumentTitle';
import RememberGame from '@/components/games/RememberGame';
import Splash from '@/components/games/Splash';

import { GAME_PAGES } from '@/constant/games';

/** The frame shared by the games: plain and dark. The games are public. */
export default function GameShell({
  name,
  children,
  wide,
  menu,
  fluid,
  xwide,
}: {
  /** The game's route name (e.g. `uno`); omit on the menu page. */
  name?: string;
  children: React.ReactNode;
  /** Wider column, for boards that need the room. */
  wide?: boolean;
  /** The games list itself: widest column, and no way "back" from it. */
  menu?: boolean;
  /** Fills the width; the page sets its own column (and leaves room for the docked chat). */
  fluid?: boolean;
  /** A wide column, centred (for boards that need room but have no side panels). */
  xwide?: boolean;
}) {
  // pages pass the menu id (e.g. `chess`) or the route (`snake`)
  const game = name
    ? GAME_PAGES.find((g) => g.id === name || g.href === `/games/${name}`)
    : undefined;

  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      {name && (
        <Link
          href='/games'
          aria-label='Kembali ke daftar game'
          className='fixed top-3 left-3 z-40 flex size-9 items-center justify-center rounded-full border border-line bg-paper/80 text-mute backdrop-blur transition-colors hover:border-[#3a3a3a] hover:text-ink'
        >
          ←
        </Link>
      )}

      {game && <RememberGame id={game.id} />}
      <DocumentTitle title={game?.title ?? 'Games'} />
      {game && <Splash id={game.id} title={game.title} />}

      <main
        className={`mx-auto flex w-full flex-1 flex-col px-4 pb-6 ${
          menu ? 'pt-6' : 'pt-16'
        } ${
          fluid
            ? 'max-w-none'
            : xwide
              ? 'max-w-5xl'
              : menu
                ? 'max-w-7xl'
                : wide
                  ? 'max-w-xl'
                  : 'max-w-md'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
