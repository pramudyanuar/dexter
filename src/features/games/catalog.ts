import { UNO_PLAYERS } from '@/features/games/logic/uno-rules';

export interface GameEntry {
  id: string;
  /** Friendly name for the menu */
  title: string;
  /** Played with friends on other devices, through a room code */
  online?: boolean;
  /** Has a solo mode as well as an online room. */
  solo?: boolean;
  /** How many people play, e.g. `1` or `2–4` */
  players: string;
  categories: readonly GameCategory[];
  /** Typical duration, in minutes. */
  minutes: readonly [number, number];
  href: string;
  description: string;
  controls: string;
  /** Reachable and known to the game pages, but not a card of its own on the menu */
  hidden?: boolean;
}

export const GAME_CATEGORIES = {
  board: 'Board',
  card: 'Card',
  casual: 'Casual',
  party: 'Party',
  puzzle: 'Puzzle',
  strategy: 'Strategy',
  trivia: 'Trivia',
  arcade: 'Arcade',
} as const;

export type GameCategory = keyof typeof GAME_CATEGORIES;

const ALL_GAMES: readonly GameEntry[] = [
  {
    id: 'tv',
    categories: ['arcade', 'party'],
    minutes: [2, 10],
    players: '1–4',
    online: true,
    solo: true,
    title: 'Turbo TV Arena',
    href: '/games/tv',
    description:
      'Balap arena 1–4 pemain di layar TV/PC menggunakan HP masing-masing sebagai controller via QR code.',
    controls: 'scan QR dari HP untuk D-Pad & Gas/Rem (atau Panah/WASD di PC)',
  },
  {
    id: 'wordle',
    categories: ['puzzle', 'casual'],
    minutes: [3, 10],
    players: '1',
    title: 'Wordle',
    href: '/games/wordle',
    description: 'Tebak kata 5 huruf dalam 6 kesempatan.',
    controls: 'ketik, Enter kirim',
  },
  {
    id: 'snake',
    categories: ['arcade', 'casual'],
    minutes: [2, 10],
    players: '1–2',
    online: true,
    solo: true,
    title: 'Snake',
    href: '/games/snake',
    description:
      'Makan apel dan hindari tabrakan di Classic, Harian, atau Duel online.',
    controls: 'panah atau WASD, spasi jeda, geser di layar sentuh',
  },
  {
    id: '2048',
    categories: ['puzzle', 'casual'],
    minutes: [5, 20],
    players: '1',
    title: '2048',
    href: '/games/2048',
    description: 'Gabungkan angka yang sama sampai mencapai 2048.',
    controls: 'panah atau WASD, geser di layar sentuh',
  },
  {
    id: 'minesweeper',
    categories: ['puzzle', 'strategy'],
    minutes: [3, 20],
    players: '1',
    title: 'Minesweeper',
    href: '/games/minesweeper',
    description: 'Buka semua petak yang aman tanpa menyentuh ranjau.',
    controls: 'klik buka, klik kanan atau tahan lama untuk bendera',
  },
  {
    id: 'tetris',
    categories: ['arcade', 'puzzle'],
    minutes: [3, 15],
    players: '1',
    title: 'Tetris',
    href: '/games/tetris',
    description: 'Susun balok jatuh menjadi baris penuh.',
    controls: 'panah geser/putar/turun, spasi jatuhkan, P jeda',
  },
  {
    id: 'doom',
    categories: ['arcade'],
    minutes: [10, 30],
    players: '1',
    title: 'DOOM',
    href: '/games/doom',
    description:
      'DOOM asli tahun 1993 (Shareware) berjalan langsung di browser lewat DOSBox WebAssembly.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'doom2',
    categories: ['arcade'],
    minutes: [10, 30],
    players: '1',
    title: 'DOOM II',
    href: '/games/doom2',
    description:
      'DOOM II: Hell on Earth (1994) dengan Super Shotgun dan monster ikonik lewat DOSBox WebAssembly.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'wolf3d',
    categories: ['arcade'],
    minutes: [10, 30],
    players: '1',
    title: 'Wolfenstein 3D',
    href: '/games/wolf3d',
    description:
      'FPS klasik 1992 pelopor game 3D dari id Software, berjalan langsung di browser.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'gelud',
    categories: ['arcade', 'party'],
    minutes: [3, 8],
    players: '1–2',
    title: 'Gelud',
    online: true,
    solo: true,
    href: '/games/gelud',
    description:
      'Game fighting arcade 2D: bisa mabar online lewat kode room, 1P vs AI, atau 2P di 1 keyboard.',
    controls: 'WASD/Panah gerak, F/Spasi pukul, G tendang, H jurus',
  },
  {
    id: 'connect4',
    categories: ['board', 'strategy'],
    minutes: [3, 10],
    players: '2',
    title: 'Connect 4',
    online: true,
    href: '/games/connect4',
    description:
      'Empat berjajar untuk dua pemain di device berbeda, lewat kode room.',
    controls: 'satu membuat room, yang lain memasukkan kodenya',
  },
  {
    id: 'suit',
    categories: ['casual', 'party'],
    minutes: [1, 5],
    players: '2',
    title: 'Suit',
    online: true,
    href: '/games/suit',
    description: 'Batu, gunting, kertas online untuk dua pemain.',
    controls: 'buat room lalu bagikan kodenya',
  },
  {
    id: 'karambol',
    categories: ['board', 'casual'],
    minutes: [10, 25],
    players: '2–4',
    title: 'Karambol',
    online: true,
    href: '/games/karambol',
    description:
      'Karambol online 2–4 pemain: 1v1, 3 pemain poin, atau 4 pemain (2v2 tim seberang).',
    controls: 'geser striker di garis, tarik & lepas untuk menembak',
  },
  {
    id: 'uno',
    categories: ['card', 'party'],
    minutes: [10, 25],
    players: `${UNO_PLAYERS.min}–${UNO_PLAYERS.max}`,
    title: 'Uno',
    online: true,
    href: '/games/uno',
    description: `Uno online untuk ${UNO_PLAYERS.min} sampai ${UNO_PLAYERS.max} pemain: pilih klasik, Flip, atau No Mercy.`,
    controls: 'pembuat room memulai setelah semua bergabung',
  },
  {
    id: 'unoflip',
    categories: ['card', 'party'],
    minutes: [10, 25],
    hidden: true,
    players: `${UNO_PLAYERS.min}–${UNO_PLAYERS.max}`,
    title: 'Uno Flip',
    online: true,
    href: '/games/unoflip',
    description:
      'Kartu dua sisi: satu kartu FLIP membalik semuanya ke sisi gelap yang jauh lebih kejam.',
    controls: 'pembuat room memulai setelah semua bergabung',
  },
  {
    id: 'unomercy',
    categories: ['card', 'party'],
    minutes: [15, 35],
    hidden: true,
    players: `${UNO_PLAYERS.min}–${UNO_PLAYERS.max}`,
    title: 'Uno No Mercy',
    online: true,
    href: '/games/unomercy',
    description:
      'Tumpuk hukuman, tukar dan oper kartu. Pemain gugur saat mencapai batas kartu room.',
    controls: 'pembuat room memulai setelah semua bergabung',
  },
  {
    id: 'sekata',
    categories: ['card', 'party', 'puzzle'],
    minutes: [10, 25],
    players: '3–10',
    title: 'Sekata',
    online: true,
    href: '/games/sekata',
    description:
      'Race against your friends to create Indonesian words using syllable cards.',
    controls: 'pilih atau seret kartu, lalu kirim katanya',
  },
  {
    id: 'mahjong',
    categories: ['board', 'puzzle'],
    minutes: [5, 20],
    players: '1',
    title: 'Mahjong Solitaire',
    href: '/games/mahjong',
    description:
      'Match identical Mahjong tiles, clear the board, and challenge your puzzle-solving skills.',
    controls: 'click two free tiles that match',
  },
  {
    id: 'mahjong-hk',
    categories: ['board', 'strategy'],
    minutes: [15, 40],
    players: '4',
    title: 'Mahjong Hong Kong',
    online: true,
    href: '/games/mahjong-hk',
    description:
      'Meja empat pemain dengan pembagian ubin otomatis dan aturan Hong Kong tiga faan.',
    controls:
      'pilih ubin untuk dibuang, atau klaim buangan untuk melengkapi tanganmu',
  },
  {
    id: 'dart',
    solo: true,
    categories: ['arcade', 'casual', 'party'],
    minutes: [5, 25],
    players: '1–4',
    title: 'Dart',
    online: true,
    href: '/games/dart',
    description:
      'Aim, throw, and compete to become the ultimate dart champion.',
    controls: 'aim with the pointer, click or tap to throw',
  },
  {
    id: 'remo',
    categories: ['card', 'strategy'],
    minutes: [10, 30],
    players: '2–4',
    title: 'Remi (Remo)',
    online: true,
    href: '/games/remo',
    description:
      'Remi gaya rummy. Susun seri atau set dan habiskan kartu lebih dulu.',
    controls: 'ambil kartu, pasang kombinasi, lalu buang satu kartu',
  },
  {
    id: 'poker',
    categories: ['card', 'strategy'],
    minutes: [5, 20],
    players: '2–6',
    title: 'Poker Texas Hold’em',
    online: true,
    href: '/games/poker',
    description:
      'Main Texas Hold’em bareng teman dengan chip virtual dan taruhan batas tetap.',
    controls: 'check, call, bet, raise, atau fold saat giliranmu',
  },
  {
    id: 'card-archive',
    categories: ['card', 'puzzle'],
    minutes: [10, 30],
    title: 'Arsip Kartu',
    players: '1',
    href: '/games/card-archive',
    description:
      'Susun kombinasi poker, sisihkan kartu bukti, dan penuhi lima kontrak dalam satu ekspedisi.',
    controls: 'pilih kartu untuk kombinasi atau bukti, lalu simpan atau tukar',
  },
  {
    id: 'werewolf',
    categories: ['party', 'strategy'],
    minutes: [20, 45],
    players: '5–20',
    title: 'Werewolf',
    online: true,
    href: '/games/werewolf',
    description:
      'Secret roles, long nights, and a village that must find the wolves among them.',
    controls: 'act in secret at night, then debate and vote by day',
  },
  {
    id: 'monkeys',
    categories: ['party', 'puzzle'],
    minutes: [5, 20],
    players: '3',
    title: 'Three Monkeys',
    online: true,
    href: '/games/monkeys',
    description:
      'One can touch the bomb, one can read the manual, one can see and talk. Defuse it together.',
    controls: 'exactly three players; voice, gestures and a bomb',
  },
  {
    id: 'battleship',
    categories: ['board', 'strategy'],
    minutes: [10, 25],
    players: '2',
    title: 'Battleship',
    online: true,
    href: '/games/battleship',
    description:
      'Battleship online untuk dua pemain. Tembak armada rahasia lawan.',
    controls: 'susun armada, lalu klik petak untuk menembak',
  },
  {
    id: 'gomoku',
    categories: ['board', 'strategy'],
    minutes: [5, 15],
    players: '2',
    title: 'Gomoku',
    online: true,
    href: '/games/gomoku',
    description: 'Lima berjajar di papan 15x15 untuk dua pemain.',
    controls: 'klik petak kosong, hitam jalan duluan',
  },
  {
    id: 'checkers',
    categories: ['board', 'strategy'],
    minutes: [10, 25],
    players: '2',
    title: 'Checkers',
    online: true,
    href: '/games/checkers',
    description: 'Checkers online untuk dua pemain. Wajib memakan bidak lawan.',
    controls: 'klik bidak lalu petak tujuan',
  },
  {
    id: 'chess',
    categories: ['board', 'strategy'],
    minutes: [15, 45],
    players: '2',
    title: 'Chess',
    online: true,
    href: '/games/chess',
    description:
      'Chess lengkap online untuk dua pemain: rokade, en passant, promosi.',
    controls: 'klik bidak lalu petak tujuan',
  },
  {
    id: 'dice',
    categories: ['party', 'strategy'],
    minutes: [5, 20],
    players: '2–4',
    title: "Liar's Dice",
    online: true,
    href: '/games/dice',
    description:
      'Tawar-menawar dadu rahasia untuk 2 sampai 4 pemain. Berani bilang bohong?',
    controls: 'tawar jumlah dan angka, atau tantang "bohong!"',
  },
  {
    id: 'domino',
    categories: ['board', 'casual'],
    minutes: [5, 20],
    players: '2–4',
    title: 'Domino',
    online: true,
    href: '/games/domino',
    description: 'Domino online untuk 2 sampai 4 pemain.',
    controls: 'klik kartu yang menyala, tarik dari tumpukan kalau buntu',
  },
  {
    id: 'quiz',
    categories: ['trivia', 'party'],
    minutes: [5, 15],
    players: '2–6',
    title: 'Quiz',
    online: true,
    href: '/games/quiz',
    description:
      'Quiz cepat untuk 2 sampai 6 pemain. Yang benar dan tercepat dapat poin terbanyak.',
    controls: 'pilih jawaban sebelum waktu habis',
  },
  {
    id: 'pictionary',
    categories: ['party', 'casual'],
    minutes: [8, 25],
    players: '2–6',
    title: 'Pictionary',
    online: true,
    href: '/games/pictionary',
    description:
      'Gambar kata rahasia dan biarkan temanmu menebak. 2 sampai 6 pemain.',
    controls: 'gambar dengan mouse atau jari, tebak lewat kolom teks',
  },
];

/** What the menu lists: every game that has a card of its own. */
export const GAMES: readonly GameEntry[] = ALL_GAMES.filter((g) => !g.hidden);

/** Every game page, including the variants reached from another game's start screen. */
export const GAME_PAGES: readonly GameEntry[] = ALL_GAMES;
