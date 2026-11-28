'use client';

import Link from 'next/link';
import * as React from 'react';

import TopNav from '@/components/TopNav';

import DocumentTitle from '@/features/games/components/DocumentTitle';
import { ToolEntry, TOOLS } from '@/features/tools/catalog';
import ToolArt from '@/features/tools/components/ToolArt';

type Filter = 'all' | 'sharing' | 'utility';

function ToolCard({ tool, index }: { tool: ToolEntry; index: number }) {
  return (
    <li
      className='a-slide-up'
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <Link
        href={tool.href}
        aria-label={`${tool.title}: ${tool.description}`}
        className='group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface/50 transition-[transform,border-color,background-color] duration-200 outline-none hover:-translate-y-0.5 hover:border-line-strong hover:bg-card focus-visible:border-accent'
      >
        <div className='relative aspect-[8/5] border-b border-line bg-[#0e1015]'>
          <ToolArt id={tool.id} />
          {tool.badge && (
            <span className='absolute top-2 left-2 rounded border border-line-strong bg-paper/80 px-1.5 py-px text-[11px] tracking-wide text-[var(--mute)]'>
              {tool.badge}
            </span>
          )}
        </div>
        <div className='flex flex-1 flex-col px-3.5 py-3'>
          <span className='font-medium'>{tool.title}</span>
          <span className='mt-0.5 font-mono text-xs text-[var(--mute)]'>
            {tool.href}
          </span>
          <p className='mt-2 line-clamp-2 text-[13px] leading-snug text-[var(--mute)]'>
            {tool.description}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default function ToolsPage() {
  const [filter, setFilter] = React.useState<Filter>('all');

  const shown = TOOLS.filter((t) => filter === 'all' || t.category === filter);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: TOOLS.length },
    {
      id: 'sharing',
      label: 'Berbagi',
      count: TOOLS.filter((t) => t.category === 'sharing').length,
    },
    {
      id: 'utility',
      label: 'Utilitas',
      count: TOOLS.filter((t) => t.category === 'utility').length,
    },
  ];

  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      <DocumentTitle title='Tools' />

      <main className='mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pt-6 pb-8'>
        <TopNav />

        <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>Tools</h1>
            <p className='mt-1 text-sm text-[var(--mute)]'>
              Papan copy-paste antar device, generator QR, dev tools, kompresor
              gambar, dan AI chat.
            </p>
          </div>

          <div
            role='group'
            aria-label='Filter'
            className='flex flex-wrap gap-2'
          >
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

        <ul className='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4'>
          {shown.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </ul>
      </main>
    </div>
  );
}
