import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import GameArt from '@/features/games/components/GameArt';

export interface GameModeOption {
  id: string;
  title: string;
  badge: string;
  blurb: string;
  highlights: readonly string[];
  meta: string;
  artId: string;
  href?: string;
  onSelect?: () => void;
  cta?: string;
}

export interface GameModeEntryProps {
  eyebrow: string;
  title: string;
  description: string;
  modes: readonly GameModeOption[];
  secondaryLinks?: readonly { label: string; href: string }[];
  footerNote?: React.ReactNode;
}

const cardClass =
  'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-card/70 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]';

/**
 * Shared mode-selection hub for multi-variant games (e.g. Uno and Snake).
 * Uses a responsive 3-column grid on desktop so the viewport is well utilized.
 */
export default function GameModeEntry({
  eyebrow,
  title,
  description,
  modes,
  secondaryLinks,
  footerNote,
}: GameModeEntryProps) {
  return (
    <div className='a-slide-up mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-2 sm:py-6'>
      <header className='mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5'>
        <div>
          <p className='text-xs font-semibold tracking-wider text-accent uppercase'>
            {eyebrow}
          </p>
          <h1 className='mt-1.5 text-3xl font-black tracking-tight text-ink sm:text-4xl'>
            {title}
          </h1>
          <p className='mt-1.5 max-w-2xl text-sm text-mute sm:text-base'>
            {description}
          </p>
        </div>
        {secondaryLinks && secondaryLinks.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {secondaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className='inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line-strong bg-card/50 px-3.5 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent'
              >
                {link.label}
                <ArrowUpRight aria-hidden className='size-4 text-accent' />
              </Link>
            ))}
          </div>
        )}
      </header>

      <ul className='grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5'>
        {modes.map((m) => {
          const content = (
            <>
              <div className='relative aspect-[8/5] w-full overflow-hidden border-b border-line bg-paper'>
                <GameArt id={m.artId} />
                <span className='absolute top-3 right-3 rounded-md border border-line bg-paper/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur-sm'>
                  {m.badge}
                </span>
              </div>
              <div className='flex flex-1 flex-col p-4 sm:p-5'>
                <div className='flex items-baseline justify-between gap-2'>
                  <h2 className='text-xl font-bold tracking-tight text-ink'>
                    {m.title}
                  </h2>
                  <span className='shrink-0 text-xs font-medium text-mute'>
                    {m.meta}
                  </span>
                </div>
                <p className='mt-2 text-sm leading-relaxed text-mute'>
                  {m.blurb}
                </p>
                {m.highlights.length > 0 && (
                  <ul className='mt-4 space-y-1.5 border-t border-line/70 pt-3 text-xs text-ink/85'>
                    {m.highlights.map((item) => (
                      <li key={item} className='flex items-start gap-2'>
                        <span
                          aria-hidden
                          className='mt-1.5 size-1.5 shrink-0 rounded-full bg-accent'
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className='mt-auto pt-4'>
                  <span className='inline-flex min-h-10 w-full items-center justify-between rounded-lg border border-line-strong bg-paper/60 px-3.5 text-sm font-semibold text-ink transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-paper'>
                    <span>{m.cta ?? `Main ${m.title}`}</span>
                    <ArrowUpRight aria-hidden className='size-4' />
                  </span>
                </div>
              </div>
            </>
          );

          return (
            <li key={m.id} className='flex'>
              {m.href ? (
                <Link href={m.href} className={cardClass}>
                  {content}
                </Link>
              ) : (
                <button
                  type='button'
                  onClick={m.onSelect}
                  className={cardClass}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {footerNote && (
        <div className='mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card/40 px-4 py-3 text-xs text-mute sm:text-sm'>
          {footerNote}
        </div>
      )}
    </div>
  );
}
