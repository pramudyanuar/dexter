'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import JsDosPlayer from '@/features/games/components/JsDosPlayer';

export default function Wolf3dPage() {
  const mounted = useMounted();
  return (
    <GameShell name='wolf3d' xwide>
      {mounted ? (
        <JsDosPlayer
          title='Wolfenstein 3D (1992)'
          bundleUrl='/api/dos-bundle?id=wolf3d'
          controls='Kontrol klasik: Panah untuk gerak, Ctrl untuk tembak, Spasi untuk buka pintu rahasia, Alt untuk strafe, Esc untuk menu.'
        />
      ) : null}
    </GameShell>
  );
}
