'use client';

import Link from 'next/link';

import GameShell from '@/components/games/GameShell';

import { GAMES } from '@/constant/games';

export default function GamesPage() {
  return (
    <GameShell wide>
      <h1 className='text-2xl font-extrabold'>Mau main apa hari ini?</h1>
      <p className='mt-1 text-mute'>
        Pilih game. Yang bertanda <span className='font-semibold'>online</span>{' '}
        bisa dimainkan bareng teman di device berbeda.
      </p>
      <ul className='mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {GAMES.map((game, i) => (
          <li
            key={game.id}
            className='a-slide-up'
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <Link
              href={game.href}
              aria-label={`${game.title}: ${game.description}`}
              className='group flex h-full gap-3 rounded-2xl border border-line/70 bg-card/80 p-4 shadow-sm transition-all duration-200 outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-info'
            >
              <span
                aria-hidden
                className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-paper text-2xl transition-transform group-hover:scale-110 group-hover:-rotate-6'
              >
                {game.icon}
              </span>
              <span className='min-w-0'>
                <span className='flex flex-wrap items-center gap-2 font-bold'>
                  {game.title}
                  {game.online && (
                    <span className='rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-semibold text-info'>
                      online
                    </span>
                  )}
                </span>
                <span className='mt-0.5 block text-sm leading-5'>
                  {game.description}
                </span>
                <span className='mt-1 block text-xs text-mute'>
                  {game.controls}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </GameShell>
  );
}
