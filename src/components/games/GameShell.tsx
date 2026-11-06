import Link from 'next/link';
import * as React from 'react';

/** Terminal-style frame shared by the games. The games are public. */
export default function GameShell({
  name,
  children,
  wide,
}: {
  /** Shown after `games/` in the prompt; omit on the menu page. */
  name?: string;
  children: React.ReactNode;
  /** Wider column, for boards that need the room. */
  wide?: boolean;
}) {
  return (
    <div className='flex min-h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'>
      <header className='border-b border-line'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>games</span>
            <span className='text-mute'>:</span>
            <Link href='/' className='text-info hover:underline'>
              ~
            </Link>
            <span className='text-info'>/</span>
            {name ? (
              <>
                <Link href='/games' className='text-info hover:underline'>
                  games
                </Link>
                <span className='text-info'>/{name}</span>
              </>
            ) : (
              <span className='text-info'>games</span>
            )}{' '}
            <span className='text-hash'>(main)</span>
          </span>
        </div>
      </header>

      <main
        className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 ${
          wide ? 'max-w-xl' : 'max-w-md'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
