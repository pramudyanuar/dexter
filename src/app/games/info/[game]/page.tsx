import { ArrowLeft, ArrowUpRight, Clock3, Gamepad2, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import TopNav from '@/components/TopNav';

import { GAME_CATEGORIES, GAME_PAGES } from '@/features/games/catalog';
import GameArt from '@/features/games/components/GameArt';
import GameShell from '@/features/games/components/GameShell';
import { gameById, gameModes } from '@/features/games/discovery';
import { GAME_HINTS } from '@/features/games/hints';

type Props = { params: Promise<{ game: string }> };

export function generateStaticParams() {
  return GAME_PAGES.map(({ id }) => ({ game: id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = gameById((await params).game);
  return game ? { title: game.title, description: game.description } : {};
}

export default async function GameDetailPage({ params }: Props) {
  const game = gameById((await params).game);
  if (!game) notFound();
  const [shortest, longest] = game.minutes;

  return (
    <GameShell menu title={game.title}>
      <TopNav />
      <Link
        href='/games'
        className='mb-5 inline-flex min-h-10 w-fit items-center gap-2 text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent'
      >
        <ArrowLeft aria-hidden className='size-4' /> Koleksi game
      </Link>
      <article className='overflow-hidden rounded-2xl border border-line-strong bg-surface'>
        <div className='grid md:grid-cols-[1.15fr_1fr]'>
          <div className='aspect-[8/5] border-b border-line-strong bg-paper md:aspect-auto md:min-h-72 md:border-r md:border-b-0'>
            <GameArt id={game.id} />
          </div>
          <div className='flex flex-col justify-center gap-4 p-6 sm:p-9'>
            <p className='text-sm font-semibold text-accent'>
              {game.categories.map((id) => GAME_CATEGORIES[id]).join(' · ')}
            </p>
            <h1 className='text-4xl font-black tracking-tight sm:text-5xl'>
              {game.title}
            </h1>
            <p className='text-base text-ink/85'>{game.description}</p>
            <dl className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/85'>
              <div className='flex items-center gap-2'>
                <Users aria-hidden className='size-4 text-accent' />
                <dt className='sr-only'>Jumlah pemain</dt>
                <dd>{game.players} pemain</dd>
              </div>
              <div className='flex items-center gap-2'>
                <Clock3 aria-hidden className='size-4 text-accent' />
                <dt className='sr-only'>Perkiraan durasi</dt>
                <dd>
                  ± {shortest}–{longest} menit
                </dd>
              </div>
            </dl>
            <Link
              href={game.href}
              className='inline-flex min-h-12 w-fit items-center gap-2 rounded-md bg-accent px-5 font-bold text-paper hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
            >
              Mulai game <ArrowUpRight aria-hidden className='size-4' />
            </Link>
          </div>
        </div>
        <div className='grid gap-6 border-t border-line-strong px-6 py-7 sm:px-9 md:grid-cols-[1.15fr_1fr]'>
          <section aria-labelledby='game-instructions'>
            <h2 id='game-instructions' className='text-xl font-bold'>
              Cara bermain
            </h2>
            {GAME_HINTS[game.id] && (
              <ul className='mt-3 list-disc space-y-2 pl-5 text-ink/85'>
                {GAME_HINTS[game.id].map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            )}
            <p className='mt-3 flex items-start gap-2 text-ink/85'>
              <Gamepad2
                aria-hidden
                className='mt-0.5 size-5 shrink-0 text-accent'
              />
              <span>
                <strong>Kontrol</strong> · {game.controls}
              </span>
            </p>
          </section>
          <section aria-labelledby='game-modes'>
            <h2 id='game-modes' className='text-xl font-bold'>
              Mode tersedia
            </h2>
            <ul className='mt-3 flex flex-wrap gap-2'>
              {gameModes(game).map((mode) => (
                <li
                  key={mode}
                  className='rounded-md border border-line-strong px-3 py-2 text-sm text-ink/85'
                >
                  {mode}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>
    </GameShell>
  );
}
