import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import styles from '@/features/games/components/snake/snake.module.css';

import GameShell from '@/features/games/components/GameShell';

const modes = [
  { id: 'classic', label: 'Classic', href: '/games/snake/classic' },
  { id: 'daily', label: 'Harian', href: '/games/snake/daily' },
  { id: 'duel', label: 'Duel', href: '/games/snake/duel' },
] as const;

export default function SnakeShell({
  mode,
  children,
}: {
  mode: (typeof modes)[number]['id'];
  children: React.ReactNode;
}) {
  return (
    <GameShell name='snake' fit className={styles.shell} showBack={false}>
      <div className={styles.layout}>
        <div className={styles.backBar}>
          <Link href='/games/snake' className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden='true' />
            Pilih mode Snake
          </Link>
        </div>
        <header className={styles.header}>
          <h1 className={styles.title}>Snake</h1>
          <nav aria-label='Mode Snake' className={styles.modes}>
            {modes.map(({ id, label, href }) => (
              <Link
                key={id}
                href={href}
                aria-current={mode === id ? 'page' : undefined}
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
