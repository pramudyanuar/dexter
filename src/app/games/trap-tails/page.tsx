import type { Metadata } from 'next';

import GameShell from '@/components/games/GameShell';

import { copy } from '@/features/trap-tails/copy';
import Practice from '@/features/trap-tails/Practice';

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
};

export default function TrapTailsPage() {
  return (
    <GameShell name='trap-tails' fullscreen>
      <Practice />
    </GameShell>
  );
}
