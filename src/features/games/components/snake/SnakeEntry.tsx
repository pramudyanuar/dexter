'use client';

import * as React from 'react';

import GameModeEntry, {
  type GameModeOption,
} from '@/features/games/components/GameModeEntry';
import GameShell from '@/features/games/components/GameShell';

const MODES: readonly GameModeOption[] = [
  {
    id: 'classic',
    artId: 'snake',
    title: 'Classic',
    badge: 'Solo',
    meta: 'Tanpa batas waktu',
    blurb:
      'Main solo klasik. Makan apel sebanyak mungkin, hindari dinding dan ekor sendiri, lalu kejar skor tertinggi.',
    highlights: [
      'Kecepatan bertahap seiring panjang ular',
      'Skor terbaik tersimpan lokal & leaderboard',
      'Cocok untuk pemanasan atau rekor baru',
    ],
    href: '/games/snake/classic',
    cta: 'Main Classic',
  },
  {
    id: 'daily',
    artId: 'snake-daily',
    title: 'Harian',
    badge: 'Tantangan 120s',
    meta: 'Seed harian',
    blurb:
      'Tantangan harian 120 detik dengan posisi apel dan papan yang sama untuk semua pemain hari ini.',
    highlights: [
      'Satu papan yang adil untuk semua pemain',
      'Batas waktu 2 menit untuk skor maksimal',
      'Peringkat harian di-reset setiap hari',
    ],
    href: '/games/snake/daily',
    cta: 'Main Harian',
  },
  {
    id: 'duel',
    artId: 'snake-duel',
    title: 'Duel',
    badge: 'Online 1v1',
    meta: 'Real-time',
    blurb:
      'Duel ular 1 lawan 1 secara real-time. Cari lawan otomatis atau buat room kode untuk main bareng teman.',
    highlights: [
      'Matchmaking cepat atau room privat',
      'Rebut apel lebih cepat dari lawan',
      'Bertahan paling lama untuk menang',
    ],
    href: '/games/snake/duel',
    cta: 'Main Duel',
  },
];

/** Front menu for Snake: pick Classic, Daily, or Duel. */
export default function SnakeEntry() {
  return (
    <GameShell name='snake' fit>
      <GameModeEntry
        eyebrow='Arcade · 1–2 Pemain'
        title='Pilih Mode Snake'
        description='Main solo klasik tanpa batas waktu, adu cepat di tantangan harian 120 detik, atau duel 1 lawan 1 secara real-time.'
        modes={MODES}
        secondaryLinks={[
          { label: 'Leaderboard', href: '/games/leaderboard' },
          { label: 'Info Game', href: '/games/info/snake' },
        ]}
        footerNote={
          <>
            <span>
              <strong>Kontrol:</strong> Tombol panah, WASD, atau geser layar di
              perangkat sentuh.
            </span>
            <span>Tekan Spasi untuk jeda saat bermain solo.</span>
          </>
        }
      />
    </GameShell>
  );
}
