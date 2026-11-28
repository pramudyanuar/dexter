import type { Metadata } from 'next';

import GameDiscovery from '@/features/games/components/GameDiscovery';

export const metadata: Metadata = {
  title: 'Dexter Arcade',
  description:
    'Cari game untuk dimainkan sendiri atau bersama teman di Dexter.',
};

export default function GamesPage() {
  return <GameDiscovery />;
}
