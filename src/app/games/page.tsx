'use client';

import Link from 'next/link';

import GameShell from '@/components/games/GameShell';

import { GAMES } from '@/constant/games';

export default function GamesPage() {
  return (
    <GameShell wide>
      <h1 className='text-xl font-semibold tracking-tight'>Games</h1>
      <p className='mt-1 text-sm text-mute'>
        {GAMES.length} game. Yang bertanda online dimainkan bareng teman lewat
        kode room.
      </p>
      <ul className='mt-6 divide-y divide-line border-y border-line'>
        {GAMES.map((game) => (
          <li key={game.id}>
            <Link
              href={game.href}
              aria-label={`${game.title}: ${game.description}`}
              className='group -mx-3 flex items-start justify-between gap-4 rounded-md px-3 py-3.5 transition-colors outline-none hover:bg-card focus-visible:bg-card'
            >
              <span className='min-w-0'>
                <span className='flex items-center gap-2 font-medium'>
                  {game.title}
                  {game.online && (
                    <span className='rounded border border-line px-1.5 py-px text-[11px] font-normal text-mute'>
                      online
                    </span>
                  )}
                </span>
                <span className='mt-0.5 block text-sm text-mute'>
                  {game.description}
                </span>
              </span>
              <span
                aria-hidden
                className='pt-0.5 text-mute transition-transform group-hover:translate-x-0.5 group-hover:text-ink'
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GameShell>
  );
}
