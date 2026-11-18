import Link from 'next/link';

import GameShell from '@/components/games/GameShell';

const modes = [
  { id: 'classic', label: 'Classic', href: '/games/snake' },
  { id: 'daily', label: 'Harian', href: '/games/snake/daily' },
] as const;

export default function SnakeShell({
  mode,
  children,
}: {
  mode: (typeof modes)[number]['id'];
  children: React.ReactNode;
}) {
  return (
    <GameShell name='snake' fit>
      <div className='mx-auto w-full max-w-md space-y-4 pb-4'>
        <header className='space-y-3'>
          <h1 className='text-xl font-semibold'>Snake</h1>
          <nav
            aria-label='Mode Snake'
            className='grid grid-cols-2 rounded-lg border border-line bg-card p-1 text-sm'
          >
            {modes.map(({ id, label, href }) => (
              <Link
                key={id}
                href={href}
                aria-current={mode === id ? 'page' : undefined}
                className={`rounded-md px-3 py-2.5 text-center font-medium ${mode === id ? 'bg-ink text-paper' : 'text-mute hover:text-ink'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </GameShell>
  );
}
