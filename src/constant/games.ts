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
  {
    id: 'minesweeper',
    href: '/games/minesweeper',
    description: 'Buka semua petak yang aman tanpa menyentuh ranjau.',
    controls: 'klik buka, klik kanan atau tahan lama untuk bendera',
  },
  {
    id: 'tetris',
    href: '/games/tetris',
    description: 'Susun balok jatuh menjadi baris penuh.',
    controls: 'panah geser/putar/turun, spasi jatuhkan, P jeda',
  },
  {
    id: 'connect4',
    href: '/games/connect4',
    description:
      'Empat berjajar untuk dua pemain di device berbeda, lewat kode room.',
    controls: 'satu membuat room, yang lain memasukkan kodenya',
  },
  {
    id: 'suit',
    href: '/games/suit',
    description:
      'Batu, gunting, kertas online untuk dua pemain. Menang dua ronde dulu.',
    controls: 'buat room lalu bagikan kodenya',
  },
  {
    id: 'uno',
    href: '/games/uno',
    description: 'Uno online untuk 2 sampai 4 pemain di device berbeda.',
    controls: 'pembuat room memulai setelah semua bergabung',
  },
];
