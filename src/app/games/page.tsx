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
      <ul className='mt-6 overflow-hidden rounded-xl border border-line bg-surface/40'>
        {GAMES.map((game, i) => (
          <li
            key={game.id}
            className={i > 0 ? 'border-t border-line' : undefined}
          >
            <Link
              href={game.href}
              aria-label={`${game.title}: ${game.description}`}
              className='group relative flex items-start justify-between gap-4 px-4 py-3.5 transition-colors duration-200 outline-none hover:bg-card focus-visible:bg-card'
            >
              {/* a quiet accent edge on hover, instead of a loud highlight */}
              <span
                aria-hidden
                className='absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-accent/70 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100'
              />
              <span className='min-w-0'>
                <span className='flex items-center gap-2 font-medium'>
                  {game.title}
                  {game.online && (
                    <span className='rounded border border-line-strong px-1.5 py-px text-[11px] font-normal tracking-wide text-mute'>
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
                className='pt-0.5 text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink'
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
