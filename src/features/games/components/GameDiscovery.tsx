'use client';

import { ArrowUpRight, Gamepad2, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import useStoredState from '@/hooks/useStoredState';

import TopNav from '@/components/TopNav';

import {
  GAME_CATEGORIES,
  type GameEntry,
  GAMES,
} from '@/features/games/catalog';
import GameArt from '@/features/games/components/GameArt';
import GameShell from '@/features/games/components/GameShell';
import {
  GAME_VISITS_KEY,
  LAST_GAME_KEY,
} from '@/features/games/components/RememberGame';
import {
  discoverGames,
  type DiscoveryCategory,
  discoveryShelves,
  FEATURED_GAME_IDS,
  gameById,
  gameDetailHref,
  hasSoloMode,
  type PlayFilter,
  readGameVisits,
} from '@/features/games/discovery';

const categoryOptions: [DiscoveryCategory, string][] = [
  ['all', 'Semua game'],
  ...(Object.entries(GAME_CATEGORIES) as [DiscoveryCategory, string][]),
  ['multiplayer', 'Multiplayer'],
];

function LibraryCard({ game }: { game: GameEntry }) {
  return (
    <li className='group relative flex h-full flex-col rounded-xl border border-line bg-card transition-colors hover:border-accent'>
      <div className='relative aspect-[8/5] overflow-hidden rounded-t-xl border-b border-line bg-paper'>
        <GameArt id={game.id} />
        <span className='absolute right-2 bottom-2 rounded bg-paper/95 px-2 py-1 text-xs font-semibold text-ink'>
          {game.online
            ? hasSoloMode(game)
              ? 'Solo + online'
              : 'Online'
            : 'Solo'}
        </span>
      </div>
      <div className='flex flex-1 flex-col gap-1 p-3 sm:p-4'>
        <h3 className='font-semibold text-ink'>{game.title}</h3>
        <span className='flex items-center gap-1.5 text-xs text-mute'>
          <Users aria-hidden className='size-3.5' /> {game.players} pemain
        </span>
        <p className='mt-1 line-clamp-2 text-sm text-mute'>
          {game.description}
        </p>
        <div className='mt-auto flex flex-wrap items-center gap-2 pt-2'>
          <Link
            href={game.href}
            aria-label={`Main ${game.title}`}
            className='inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-2.5 text-sm font-bold text-paper after:absolute after:inset-0 after:rounded-xl after:content-[""] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent'
          >
            Main <ArrowUpRight aria-hidden className='size-4' />
          </Link>
          <Link
            href={gameDetailHref(game.id)}
            aria-label={`Info ${game.title}`}
            className='relative z-10 inline-flex min-h-11 items-center rounded-md border border-line-strong px-2.5 text-sm font-semibold text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent'
          >
            Info
          </Link>
        </div>
      </div>
    </li>
  );
}

function Shelf({
  title,
  games,
  recent,
  wide,
}: {
  title: string;
  games: readonly GameEntry[];
  recent?: boolean;
  wide?: boolean;
}) {
  return (
    <section
      aria-label={title}
      className='min-w-0 border-t border-line-strong pt-4'
    >
      <h2 className='text-xl font-bold text-ink'>{title}</h2>
      <div
        className={`mt-2 grid gap-1 ${wide ? 'md:grid-cols-3 md:gap-4' : ''}`}
      >
        {games.map((game) => (
          <Link
            key={game.id}
            href={game.href}
            aria-label={recent ? `Lanjut main ${game.title}` : undefined}
            className='group flex min-h-12 items-center gap-3 rounded-md py-1 pr-2 hover:bg-card focus-visible:outline-2 focus-visible:outline-accent'
          >
            <span
              aria-hidden
              className='flex h-10 w-16 shrink-0 items-center overflow-hidden rounded border border-line bg-paper'
            >
              <GameArt id={game.id} />
            </span>
            <span className='min-w-0 flex-1 text-sm font-semibold'>
              {game.title}
            </span>
            <span className='shrink-0 text-xs text-mute'>
              {game.players} pemain
            </span>
            <ArrowUpRight aria-hidden className='size-4 shrink-0 text-accent' />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function GameDiscovery() {
  const router = useRouter();
  const [last] = useStoredState<string | null>(LAST_GAME_KEY, null);
  const [rawVisits] = useStoredState<unknown>(GAME_VISITS_KEY, null);
  const [featureId, setFeatureId] = React.useState<string>(
    FEATURED_GAME_IDS[0],
  );
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<DiscoveryCategory>('all');
  const [mode, setMode] = React.useState<PlayFilter>('all');
  const taps = React.useRef({ count: 0, at: 0 });

  const onTitleTap = () => {
    const now = Date.now();
    const tap = taps.current;
    tap.count = now - tap.at < 700 ? tap.count + 1 : 1;
    tap.at = now;
    if (tap.count >= 3) {
      tap.count = 0;
      router.push('/apps');
    }
  };

  const featured = gameById(featureId)!;
  const { recent, popular, recommended } = discoveryShelves(
    readGameVisits(rawVisits),
    last,
  );
  const shown = discoverGames(query, category, mode);
  const modeOptions: [PlayFilter, string][] = [
    ['all', 'Semua mode'],
    ['solo', 'Sendiri'],
    ['online', 'Bareng teman'],
  ];

  return (
    <GameShell menu title='Dexter Arcade'>
      <TopNav />

      <header className='mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8'>
        <div>
          <h1
            onClick={onTitleTap}
            className='text-4xl leading-none font-black tracking-tighter select-none sm:text-6xl'
          >
            Dexter Arcade
          </h1>
          <p className='mt-3 text-sm text-mute sm:text-base'>
            Pilih game, main sendiri atau ajak teman.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <a
            href='#library-title'
            className='flex min-h-11 items-center rounded-md bg-ink px-4 font-semibold text-paper hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
          >
            Jelajahi game
          </a>
          <Link
            href='/games/leaderboard'
            className='flex min-h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent'
          >
            Leaderboard{' '}
            <ArrowUpRight aria-hidden className='size-4 text-accent' />
          </Link>
        </div>
      </header>

      <section
        aria-label='Game pilihan'
        className='overflow-hidden rounded-2xl border border-line-strong bg-[#111c17]'
      >
        <div className='grid md:grid-cols-[1fr_1.22fr]'>
          <div className='flex flex-col justify-center p-6 sm:p-9'>
            <p className='mb-3 flex items-center gap-2 text-sm font-semibold text-accent'>
              <Gamepad2 aria-hidden className='size-5' /> Pilihan Dexter
            </p>
            <h2 className='text-4xl leading-none font-black tracking-tight sm:text-5xl'>
              {featured.title}
            </h2>
            <p className='mt-3 max-w-md text-base text-ink/80'>
              {featured.description}
            </p>
            <div className='mt-5 flex flex-wrap items-center gap-4'>
              <Link
                href={featured.href}
                aria-label={`Main ${featured.title}`}
                className='inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 font-bold text-paper hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
              >
                Main <ArrowUpRight aria-hidden className='size-4' />
              </Link>
              <Link
                href={gameDetailHref(featured.id)}
                aria-label={`Info ${featured.title}`}
                className='inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 font-semibold text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent'
              >
                Info
              </Link>
              <span className='flex items-center gap-2 text-sm text-ink/80'>
                <Users aria-hidden className='size-4' /> {featured.players}{' '}
                pemain
              </span>
            </div>
          </div>
          <div className='order-first aspect-[8/4] border-b border-line-strong bg-paper md:order-last md:aspect-auto md:h-80 md:border-b-0 md:border-l'>
            <GameArt id={featured.id} />
          </div>
        </div>
        <div
          role='group'
          aria-label='Pilih game unggulan'
          className='flex flex-wrap gap-2 border-t border-line-strong bg-paper/45 px-4 py-3 sm:px-6'
        >
          {FEATURED_GAME_IDS.map((id) => (
            <button
              key={id}
              type='button'
              aria-pressed={id === featureId}
              onClick={() => setFeatureId(id)}
              className={`min-h-10 rounded-md border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent ${id === featureId ? 'border-accent bg-accent/10 text-accent' : 'border-line-strong text-ink hover:border-accent'}`}
            >
              {gameById(id)?.title}
            </button>
          ))}
        </div>
      </section>

      <div className='my-8 grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]'>
        {recent.length > 0 && (
          <Shelf title='Terakhir dibuka' games={recent} recent />
        )}
        {popular.length > 0 && (
          <Shelf title='Populer di perangkat ini' games={popular} />
        )}
        <Shelf
          title='Rekomendasi'
          games={recommended}
          wide={!recent.length && !popular.length}
        />
      </div>

      <section
        aria-labelledby='library-title'
        className='rounded-2xl border border-line bg-surface/70 p-3.5 sm:p-6'
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h2
            id='library-title'
            tabIndex={-1}
            className='scroll-mt-6 text-2xl font-bold tracking-tight sm:text-3xl'
          >
            Koleksi game
          </h2>
          <label className='relative w-full sm:w-80'>
            <span className='sr-only'>Cari game</span>
            <Search
              aria-hidden
              className='pointer-events-none absolute top-3.5 left-3 size-5 text-mute'
            />
            <input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Cari judul, kategori, atau mode'
              className='min-h-12 w-full rounded-md border border-line-strong bg-paper pr-3 pl-10 text-base text-ink placeholder:text-mute focus:border-accent focus:outline-none'
            />
          </label>
        </div>
        <div
          role='group'
          aria-label='Kategori game'
          className='mt-4 flex flex-wrap gap-2'
        >
          {categoryOptions.map(([id, label]) => (
            <button
              key={id}
              type='button'
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
              className={`min-h-11 rounded-md border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent ${category === id ? 'border-accent bg-accent text-paper' : 'border-line-strong text-ink hover:border-accent'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-line py-2'>
          <div
            role='group'
            aria-label='Mode bermain'
            className='flex flex-wrap gap-1'
          >
            {modeOptions.map(([id, label]) => (
              <button
                key={id}
                type='button'
                aria-pressed={mode === id}
                onClick={() => setMode(id)}
                className={`min-h-10 rounded px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-accent ${mode === id ? 'bg-card font-bold text-accent' : 'text-ink hover:bg-card'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className='text-sm text-mute' aria-live='polite'>
            {shown.length} dari {GAMES.length} game
          </p>
        </div>
        {shown.length ? (
          <ul
            aria-label='Daftar game'
            className='mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'
          >
            {shown.map((game) => (
              <LibraryCard key={game.id} game={game} />
            ))}
          </ul>
        ) : (
          <div className='px-3 py-12 text-center'>
            <p className='font-semibold'>Tidak ada game yang cocok.</p>
            <button
              type='button'
              onClick={() => {
                setQuery('');
                setCategory('all');
                setMode('all');
              }}
              className='mt-2 min-h-11 px-3 font-semibold text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent'
            >
              Reset pencarian
            </button>
          </div>
        )}
      </section>
    </GameShell>
  );
}
