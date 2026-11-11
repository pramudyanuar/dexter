'use client';

import * as React from 'react';

import GameArt from '@/components/games/GameArt';

const SHOW_MS = 1100;
const FADE_MS = 350;

/**
 * A short loading screen when a game opens: the game's art, its name and a bar
 * that fills. Over in about a second, and out of the way for tests.
 */
export default function Splash({ id, title }: { id?: string; title: string }) {
  const [phase, setPhase] = React.useState<'show' | 'fade' | 'gone'>(
    process.env.NODE_ENV === 'test' ? 'gone' : 'show',
  );

  React.useEffect(() => {
    if (phase === 'gone') return;
    const timer = setTimeout(
      () => setPhase(phase === 'show' ? 'fade' : 'gone'),
      phase === 'show' ? SHOW_MS : FADE_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 bg-paper transition-opacity duration-300 ${
        phase === 'fade' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {id && (
        <div className='a-splash-art h-28 w-44 overflow-hidden rounded-2xl border border-line bg-card/60 p-2'>
          <GameArt id={id} />
        </div>
      )}
      <p className='a-slide-up text-xl font-semibold tracking-tight'>{title}</p>
      <div className='h-1 w-40 overflow-hidden rounded-full bg-line'>
        <div className='a-splash-bar h-full rounded-full bg-accent' />
      </div>
    </div>
  );
}
