'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import JsDosPlayer from '@/features/games/components/JsDosPlayer';

export default function Doom2Page() {
  const mounted = useMounted();
  return (
    <GameShell name='doom2' xwide>
      {mounted ? (
        <JsDosPlayer
          title='DOOM II (1994)'
          bundleUrl='/api/dos-bundle?id=doom2'
          controls='Kontrol klasik: Panah untuk gerak, Ctrl untuk tembak, Spasi untuk buka pintu, Alt untuk strafe, Esc untuk menu.'
        />
      ) : null}
    </GameShell>
  );
}
