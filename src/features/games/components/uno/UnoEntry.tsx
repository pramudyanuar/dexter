'use client';

import * as React from 'react';

import useMounted from '@/hooks/useMounted';
import useStoredState from '@/hooks/useStoredState';

import GameModeEntry, {
  type GameModeOption,
} from '@/features/games/components/GameModeEntry';
import GameShell from '@/features/games/components/GameShell';
import UnoGame from '@/features/games/components/uno/UnoGame';
import { UNO_PLAYERS } from '@/features/games/logic/uno-rules';
import type { RoomSession } from '@/features/rooms/useRoom';

const PLAYER_RANGE = `${UNO_PLAYERS.min}–${UNO_PLAYERS.max} pemain`;

/**
 * The front of Uno: pick which Uno to play. Classic opens in place (so the
 * splash does not run twice); the others are their own pages. A room already in
 * progress, or a shared `?room=` link, skips straight to Classic.
 */
export default function UnoEntry() {
  const mounted = useMounted();
  const [session] = useStoredState<RoomSession | null>(
    'room-session-uno',
    null,
    'tab',
  );
  const [classic, setClassic] = React.useState(false);

  const invited =
    mounted && new URLSearchParams(window.location.search).has('room');
  const inClassic = classic || !!session || invited;

  const modes: GameModeOption[] = [
    {
      id: 'uno',
      artId: 'uno',
      title: 'Classic',
      badge: 'Klasik',
      meta: '10–25 menit',
      blurb:
        'Uno klasik yang kamu kenal. Cocokkan warna atau angka, tumpuk angka kembar, dan tantang Wild +4.',
      highlights: [
        'Aturan standar yang cepat dipahami',
        'Bisa stack angka yang sama sekaligus',
        'Challenge Wild +4 bila mencurigai gertakan',
      ],
      onSelect: () => setClassic(true),
      cta: 'Main Classic',
    },
    {
      id: 'unoflip',
      artId: 'unoflip',
      title: 'Flip',
      badge: 'Dua Sisi',
      meta: '10–25 menit',
      blurb:
        'Kartu dua sisi. Satu kartu FLIP membalik semua tangan dan dek ke sisi gelap yang jauh lebih kejam.',
      highlights: [
        'Light Side & Dark Side dalam satu dek',
        'Penalti lebih berat (+5 & Skip Everyone)',
        'Ritme permainan berubah drastis tiap FLIP',
      ],
      href: '/games/unoflip',
      cta: 'Main Flip',
    },
    {
      id: 'unomercy',
      artId: 'unomercy',
      title: 'No Mercy',
      badge: 'Ekstrem',
      meta: '15–35 menit',
      blurb:
        'Tumpuk kartu penalti, tukar tangan dengan angka 7, oper semua kartu dengan 0, dan hindari eliminasi.',
      highlights: [
        'Stack penalti hingga +6 dan +10',
        'Aturan 7-0 untuk tukar atau oper tangan',
        'Mercy rule: sentuh batas kartu langsung gugur',
      ],
      href: '/games/unomercy',
      cta: 'Main No Mercy',
    },
  ];

  return (
    <GameShell name='uno' fit>
      {inClassic ? (
        <UnoGame game='uno' shell={false} />
      ) : mounted ? (
        <GameModeEntry
          eyebrow={`Kartu & Pesta · ${PLAYER_RANGE}`}
          title='Pilih Mode Uno'
          description='Pilih varian Uno yang ingin dimainkan. Kamu bisa buat room atau undang teman lewat link setelah masuk.'
          modes={modes}
          secondaryLinks={[
            { label: 'Info & Aturan', href: '/games/info/uno' },
            { label: 'Semua Game', href: '/games' },
          ]}
          footerNote={
            <>
              <span>
                Semua mode mendukung <strong>{PLAYER_RANGE}</strong> secara
                online maupun dengan bot.
              </span>
              <span>
                Punya link atau kode room? Buka langsung untuk bergabung.
              </span>
            </>
          }
        />
      ) : null}
    </GameShell>
  );
}
