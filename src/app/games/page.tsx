'use client';

import Link from 'next/link';

import GameShell from '@/components/games/GameShell';

import { GAMES } from '@/constant/games';

export default function GamesPage() {
  return (
    <GameShell>
      <p>
        <span className='text-accent select-none'>$</span> ls games/
      </p>
      <ul className='mt-3'>
        {GAMES.map((game) => (
          <li key={game.id}>
            <Link
              href={game.href}
              className='group -mx-2 block rounded-sm px-2 py-2.5 outline-none hover:bg-card focus-visible:bg-card'
            >
              <span className='font-semibold text-info'>{game.id}/</span>{' '}
              <span className='text-mute group-hover:text-accent'>main →</span>
              <span className='mt-0.5 block leading-6'>{game.description}</span>
              <span className='block text-xs text-mute'># {game.controls}</span>
            </Link>
          </li>
        ))}
      </ul>
    </GameShell>
  );
}
