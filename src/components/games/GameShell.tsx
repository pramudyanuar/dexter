'use client';

import Link from 'next/link';
import * as React from 'react';

import { useAuth } from '@/components/AuthGate';

/** Terminal-style frame shared by the games. Render inside <AuthGate>. */
export default function GameShell({
  name,
  children,
}: {
  /** Shown after `games/` in the prompt; omit on the menu page. */
  name?: string;
  children: React.ReactNode;
}) {
  const { logout } = useAuth();

  return (
    <div className='flex min-h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'>
      <header className='border-b border-line'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>dexter@games</span>
            <span className='text-mute'>:</span>
            <Link href='/apps' className='text-info hover:underline'>
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
          <button
            type='button'
            onClick={logout}
            className='text-xs text-mute transition hover:text-accent'
          >
            :logout
          </button>
        </div>
      </header>

      <main className='mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6'>
        {children}
      </main>
    </div>
  );
}
