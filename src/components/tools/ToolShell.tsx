import Link from 'next/link';
import * as React from 'react';

import DocumentTitle from '@/components/games/DocumentTitle';

export default function ToolShell({
  title,
  description,
  backHref = '/tools',
  backLabel = 'Kembali ke Tools',
  wide,
  children,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className='games-ui flex min-h-dvh flex-col text-[15px] text-ink'>
      <DocumentTitle title={title} />

      <header className='border-b border-line bg-paper/80 backdrop-blur'>
        <div
          className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 ${
            wide ? 'max-w-5xl' : 'max-w-3xl'
          }`}
        >
          <Link
            href={backHref}
            className='inline-flex items-center gap-2 text-sm text-[var(--mute)] transition-colors hover:text-ink'
          >
            <span aria-hidden>←</span>
            <span>{backLabel}</span>
          </Link>

          <div className='flex items-center gap-3 text-xs text-[var(--mute)]'>
            <Link href='/games' className='transition-colors hover:text-ink'>
              Games
            </Link>
            <Link href='/tools' className='transition-colors hover:text-ink'>
              Tools
            </Link>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 ${
          wide ? 'max-w-5xl' : 'max-w-3xl'
        }`}
      >
        <div className='mb-6'>
          <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
          {description && (
            <p className='mt-1 text-sm text-[var(--mute)]'>{description}</p>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}
