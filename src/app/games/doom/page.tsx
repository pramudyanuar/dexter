'use client';

import * as React from 'react';

import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import JsDosPlayer from '@/components/games/JsDosPlayer';

export default function DoomPage() {
  const mounted = useMounted();
  return (
    <GameShell name='doom' xwide>
      {mounted ? (
        <JsDosPlayer
          title='DOOM (1993)'
          bundleUrl='/api/dos-bundle?id=doom'
          controls='Kontrol klasik: Panah untuk gerak, Ctrl untuk tembak, Spasi untuk buka pintu, Alt untuk strafe, Esc untuk menu.'
        />
      ) : null}
    </GameShell>
  );
}
