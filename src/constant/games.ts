export interface GameEntry {
  id: string;
  href: string;
  description: string;
  controls: string;
}

export const GAMES: readonly GameEntry[] = [
  {
    id: 'wordle',
    href: '/games/wordle',
    description: 'Tebak kata 5 huruf dalam 6 kesempatan.',
    controls: 'ketik, Enter kirim',
  },
  {
    id: 'ular',
    href: '/games/snake',
    description:
      'Makan sebanyak mungkin tanpa menabrak dinding atau badan sendiri.',
    controls: 'panah atau WASD, spasi jeda, geser di layar sentuh',
  },
  {
    id: '2048',
    href: '/games/2048',
    description: 'Gabungkan angka yang sama sampai mencapai 2048.',
    controls: 'panah atau WASD, geser di layar sentuh',
  },
];
