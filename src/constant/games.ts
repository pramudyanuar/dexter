export interface GameEntry {
  id: string;
  /** Friendly name for the menu */
  title: string;
  /** Played with friends on other devices, through a room code */
  online?: boolean;
  href: string;
  description: string;
  controls: string;
}

export const GAMES: readonly GameEntry[] = [
  {
    id: 'wordle',
    title: 'Wordle',
    href: '/games/wordle',
    description: 'Tebak kata 5 huruf dalam 6 kesempatan.',
    controls: 'ketik, Enter kirim',
  },
  {
    id: 'ular',
    title: 'Ular',
    href: '/games/snake',
    description:
      'Makan sebanyak mungkin tanpa menabrak dinding atau badan sendiri.',
    controls: 'panah atau WASD, spasi jeda, geser di layar sentuh',
  },
  {
    id: '2048',
    title: '2048',
    href: '/games/2048',
    description: 'Gabungkan angka yang sama sampai mencapai 2048.',
    controls: 'panah atau WASD, geser di layar sentuh',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    href: '/games/minesweeper',
    description: 'Buka semua petak yang aman tanpa menyentuh ranjau.',
    controls: 'klik buka, klik kanan atau tahan lama untuk bendera',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    href: '/games/tetris',
    description: 'Susun balok jatuh menjadi baris penuh.',
    controls: 'panah geser/putar/turun, spasi jatuhkan, P jeda',
  },
  {
    id: 'connect4',
    title: 'Connect 4',
    online: true,
    href: '/games/connect4',
    description:
      'Empat berjajar untuk dua pemain di device berbeda, lewat kode room.',
    controls: 'satu membuat room, yang lain memasukkan kodenya',
  },
  {
    id: 'suit',
    title: 'Suit',
    online: true,
    href: '/games/suit',
    description:
      'Batu, gunting, kertas online untuk dua pemain. Menang dua ronde dulu.',
    controls: 'buat room lalu bagikan kodenya',
  },
  {
    id: 'uno',
    title: 'Uno',
    online: true,
    href: '/games/uno',
    description: 'Uno online untuk 2 sampai 4 pemain di device berbeda.',
    controls: 'pembuat room memulai setelah semua bergabung',
  },
  {
    id: 'battleship',
    title: 'Kapal Perang',
    online: true,
    href: '/games/battleship',
    description:
      'Kapal perang online untuk dua pemain. Tembak armada rahasia lawan.',
    controls: 'susun armada, lalu klik petak untuk menembak',
  },
  {
    id: 'gomoku',
    title: 'Gomoku',
    online: true,
    href: '/games/gomoku',
    description: 'Lima berjajar di papan 15x15 untuk dua pemain.',
    controls: 'klik petak kosong, hitam jalan duluan',
  },
  {
    id: 'dam',
    title: 'Dam',
    online: true,
    href: '/games/checkers',
    description:
      'Dam (checkers) online untuk dua pemain. Wajib memakan bidak lawan.',
    controls: 'klik bidak lalu petak tujuan',
  },
  {
    id: 'catur',
    title: 'Catur',
    online: true,
    href: '/games/chess',
    description:
      'Catur lengkap online untuk dua pemain: rokade, en passant, promosi.',
    controls: 'klik bidak lalu petak tujuan',
  },
  {
    id: 'dadu-bohong',
    title: 'Dadu Bohong',
    online: true,
    href: '/games/dice',
    description:
      'Tawar-menawar dadu rahasia untuk 2 sampai 4 pemain. Berani bilang bohong?',
    controls: 'tawar jumlah dan angka, atau tantang "bohong!"',
  },
  {
    id: 'domino',
    title: 'Domino',
    online: true,
    href: '/games/domino',
    description: 'Domino online untuk 2 sampai 4 pemain.',
    controls: 'klik kartu yang menyala, tarik dari tumpukan kalau buntu',
  },
  {
    id: 'kuis',
    title: 'Kuis',
    online: true,
    href: '/games/quiz',
    description:
      'Kuis cepat untuk 2 sampai 6 pemain. Yang benar dan tercepat dapat poin terbanyak.',
    controls: '10 soal, 15 detik per soal',
  },
  {
    id: 'tebak-gambar',
    title: 'Tebak Gambar',
    online: true,
    href: '/games/pictionary',
    description:
      'Gambar kata rahasia dan biarkan temanmu menebak. 2 sampai 6 pemain.',
    controls: 'gambar dengan mouse atau jari, tebak lewat kolom teks',
  },
];
