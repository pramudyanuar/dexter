'use client';

import Link from 'next/link';

import AuthGate, { useAuth } from '@/components/AuthGate';

import { APPS } from '@/constant/apps';

function Apps() {
  const { logout } = useAuth();

  return (
    <div className='flex min-h-dvh flex-col bg-paper font-mono text-[13.5px] text-ink'>
      <header className='border-b border-line'>
        <div className='flex w-full items-center justify-between gap-4 px-4 py-2.5'>
          <span className='text-sm'>
            <span className='text-accent'>dexter@home</span>
            <span className='text-mute'>:</span>
            <span className='text-info'>~</span>{' '}
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

      <main className='w-full flex-1 px-4 py-6 leading-6'>
        <p>
          <span className='text-accent select-none'>$</span> ls apps/
        </p>

        <ul className='mt-3'>
          {APPS.map((app) => (
            <li key={app.id}>
              <Link
                href={app.href}
                className='group -mx-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 rounded-sm px-2 py-2 outline-none hover:bg-card focus-visible:bg-card'
              >
                <span className='w-16 shrink-0 font-semibold text-info'>
                  {app.id}/
                </span>
                <span className='min-w-0 flex-1 basis-64'>
                  {app.description}
                  {app.tags?.length ? (
                    <span className='text-mute'> [{app.tags.join(', ')}]</span>
                  ) : null}
                </span>
                <span className='text-mute group-hover:text-accent group-focus-visible:text-accent'>
                  buka →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className='mt-6 text-mute'>
          # {APPS.length} app. Tambah yang baru di src/constant/apps.ts
        </p>
      </main>
    </div>
  );
}

export default function AppsPage() {
  return (
    <AuthGate>
      <Apps />
    </AuthGate>
  );
}
