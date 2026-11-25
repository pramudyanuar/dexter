'use client';

import Link from 'next/link';
import * as React from 'react';

import GameArt from '@/components/games/GameArt';
import GameShell from '@/components/games/GameShell';

const MODES = [
  {
    id: 'classic',
    title: 'Classic',
    blurb:
      'Main solo klasik. Makan apel, hindari tabrakan, dan kejar skor tertinggi.',
    href: '/games/snake/classic',
  },
  {
    id: 'daily',
    title: 'Harian',
    blurb:
      'Tantangan harian 120 detik dengan papan yang sama untuk semua pemain.',
    href: '/games/snake/daily',
  },
  {
    id: 'duel',
    title: 'Duel',
    blurb:
      'Duel ular 1 lawan 1 real-time. Cari lawan otomatis atau buat room bersama teman.',
    href: '/games/snake/duel',
  },
] as const;

const card =
  'group flex w-full items-center gap-4 rounded-xl border border-line bg-card/60 p-3 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--mute)] hover:bg-card active:scale-[0.99]';

/** Front menu for Snake: pick Classic, Daily, or Duel. */
export default function SnakeEntry() {
  return (
    <GameShell name='snake' fit>
      <div className='a-slide-up mx-auto w-full max-w-xl pt-2'>
        <h1 className='mb-1 text-lg font-semibold tracking-tight'>
          Pilih mode Snake
        </h1>
        <p className='mb-4 text-sm text-[var(--mute)]'>
          Main solo klasik, tantangan harian, atau duel 1 lawan 1.
        </p>
        <ul className='space-y-3'>
          {MODES.map((m) => (
            <li key={m.id}>
              <Link href={m.href} className={card}>
                <div className='h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-paper/60 p-1.5'>
                  <GameArt id='snake' />
                </div>
                <span className='min-w-0'>
                  <span className='block font-semibold'>{m.title}</span>
                  <span className='mt-0.5 block text-sm text-[var(--mute)]'>
                    {m.blurb}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </GameShell>
  );
}
