'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import useStoredState from '@/lib/useStoredState';

import GameArt from '@/components/games/GameArt';
import GameShell from '@/components/games/GameShell';
import { LAST_GAME_KEY } from '@/components/games/RememberGame';

import { GameEntry, GAMES } from '@/constant/games';

type Filter = 'all' | 'solo' | 'online';

function Card({ game, index }: { game: GameEntry; index: number }) {
  return (
    <li
      className='a-slide-up'
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <Link
        href={game.href}
        aria-label={`${game.title}: ${game.description}`}
        className='group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface/50 transition-[transform,border-color,background-color] duration-200 outline-none hover:-translate-y-0.5 hover:border-line-strong hover:bg-card focus-visible:border-accent'
      >
        <div className='relative aspect-[8/5] border-b border-line bg-[#0e1015]'>
          <GameArt id={game.id} />
          {game.online && (
            <span className='absolute top-2 left-2 rounded border border-line-strong bg-paper/80 px-1.5 py-px text-[11px] tracking-wide text-[var(--mute)]'>
              online
            </span>
          )}
        </div>
        <div className='flex flex-1 flex-col px-3.5 py-3'>
          <span className='font-medium'>{game.title}</span>
          <span className='mt-0.5 text-xs text-[var(--mute)]'>
            {game.players} pemain
          </span>
          <p className='mt-2 line-clamp-2 text-[13px] leading-snug text-[var(--mute)]'>
            {game.description}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function GamesPage() {
  const router = useRouter();
  const [last] = useStoredState<string | null>(LAST_GAME_KEY, null);
  const [filter, setFilter] = React.useState<Filter>('all');
  const taps = React.useRef({ count: 0, at: 0 });

  // three quick taps on the title open the app launcher
  const onTitleTap = () => {
    const now = Date.now();
    const t = taps.current;
    t.count = now - t.at < 700 ? t.count + 1 : 1;
    t.at = now;
    if (t.count >= 3) {
      t.count = 0;
      router.push('/apps');
    }
  };

  const solo = GAMES.filter((g) => !g.online).length;
  const online = GAMES.length - solo;
  const shown = GAMES.filter(
    (g) => filter === 'all' || (filter === 'online' ? g.online : !g.online),
  );
  const resume = GAMES.find((g) => g.id === last);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: GAMES.length },
    { id: 'solo', label: 'Sendiri', count: solo },
    { id: 'online', label: 'Bareng teman', count: online },
  ];

  return (
    <GameShell menu>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1
            onClick={onTitleTap}
            className='text-2xl font-semibold tracking-tight select-none'
          >
            Games
          </h1>
          <p className='mt-1 text-sm text-[var(--mute)]'>
            {solo} untuk dimainkan sendiri, {online} bareng teman lewat kode
            room.
          </p>
        </div>

        <div role='group' aria-label='Filter' className='flex flex-wrap gap-2'>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type='button'
              aria-pressed={filter === chip.id}
              onClick={() => setFilter(chip.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                filter === chip.id
                  ? 'border-transparent bg-ink text-paper'
                  : 'border-line-strong text-[var(--mute)] hover:border-[var(--mute)] hover:text-ink'
              }`}
            >
              {chip.label} <span className='opacity-60'>{chip.count}</span>
            </button>
          ))}
        </div>
      </div>

      {resume && (
        <Link
          href={resume.href}
          className='group mt-6 flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-card px-4 py-3 transition-colors outline-none hover:border-accent focus-visible:border-accent'
        >
          <span className='text-sm'>
            <span className='text-[var(--mute)]'>Lanjut main </span>
            <span className='font-medium'>{resume.title}</span>
          </span>
          <span
            aria-hidden
            className='text-[var(--mute)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent'
          >
            →
          </span>
        </Link>
      )}

      <ul className='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4'>
        {shown.map((game, i) => (
          <Card key={game.id} game={game} index={i} />
        ))}
      </ul>
    </GameShell>
  );
}
