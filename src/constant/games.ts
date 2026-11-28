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
  href: string;
  description: string;
  controls: string;
  /** Reachable and known to the game pages, but not a card of its own on the menu */
  hidden?: boolean;
}

const ALL_GAMES: readonly GameEntry[] = [
  {
    id: 'trap-tails',
    players: '1–4',
    title: 'Trap Tails',
    href: '/games/trap-tails',
    description:
      'Coba jebakan di lab atau rakit lintasan dan balapan bareng di Party lokal.',
    controls: 'A/D atau panah gerak, Spasi lompat, Shift sprint saat latihan',
  },
  {
    id: 'wordle',
    players: '1',
    title: 'Wordle',
    href: '/games/wordle',
    description: 'Tebak kata 5 huruf dalam 6 kesempatan.',
    controls: 'ketik, Enter kirim',
  },
  {
    id: 'snake',
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
    players: '1',
    title: '2048',
    href: '/games/2048',
    description: 'Gabungkan angka yang sama sampai mencapai 2048.',
    controls: 'panah atau WASD, geser di layar sentuh',
  },
  {
    id: 'minesweeper',
    players: '1',
    title: 'Minesweeper',
    href: '/games/minesweeper',
    description: 'Buka semua petak yang aman tanpa menyentuh ranjau.',
    controls: 'klik buka, klik kanan atau tahan lama untuk bendera',
  },
  {
    id: 'tetris',
    players: '1',
    title: 'Tetris',
    href: '/games/tetris',
    description: 'Susun balok jatuh menjadi baris penuh.',
    controls: 'panah geser/putar/turun, spasi jatuhkan, P jeda',
  },
  {
    id: 'doom',
    players: '1',
    title: 'DOOM',
    href: '/games/doom',
    description:
      'DOOM asli tahun 1993 (Shareware) berjalan langsung di browser lewat DOSBox WebAssembly.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'doom2',
    players: '1',
    title: 'DOOM II',
    href: '/games/doom2',
    description:
      'DOOM II: Hell on Earth (1994) dengan Super Shotgun dan monster ikonik lewat DOSBox WebAssembly.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'wolf3d',
    players: '1',
    title: 'Wolfenstein 3D',
    href: '/games/wolf3d',
    description:
      'FPS klasik 1992 pelopor game 3D dari id Software, berjalan langsung di browser.',
    controls: 'Panah gerak, Ctrl tembak, Spasi buka pintu, Esc menu',
  },
  {
    id: 'gelud',
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
    players: '2',
    title: 'Suit',
    online: true,
    href: '/games/suit',
    description: 'Batu, gunting, kertas online untuk dua pemain.',
    controls: 'buat room lalu bagikan kodenya',
  },
  {
    id: 'karambol',
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
    players: `${UNO_PLAYERS.min}–${UNO_PLAYERS.max}`,
    title: 'Uno',
    online: true,
    href: '/games/uno',
    description: `Uno online untuk ${UNO_PLAYERS.min} sampai ${UNO_PLAYERS.max} pemain: pilih klasik, Flip, atau No Mercy.`,
    controls: 'pembuat room memulai setelah semua bergabung',
  },
  {
    id: 'unoflip',
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
    players: '1',
    title: 'Mahjong Solitaire',
    href: '/games/mahjong',
    description:
      'Match identical Mahjong tiles, clear the board, and challenge your puzzle-solving skills.',
    controls: 'click two free tiles that match',
  },
  {
    id: 'mahjong-hk',
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
    title: 'Arsip Kartu',
    players: '1',
    href: '/games/card-archive',
    description:
      'Susun kombinasi poker, sisihkan kartu bukti, dan penuhi lima kontrak dalam satu ekspedisi.',
    controls: 'pilih kartu untuk kombinasi atau bukti, lalu simpan atau tukar',
  },
  {
    id: 'werewolf',
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
    players: '2',
    title: 'Gomoku',
    online: true,
    href: '/games/gomoku',
    description: 'Lima berjajar di papan 15x15 untuk dua pemain.',
    controls: 'klik petak kosong, hitam jalan duluan',
  },
  {
    id: 'checkers',
    players: '2',
    title: 'Checkers',
    online: true,
    href: '/games/checkers',
    description: 'Checkers online untuk dua pemain. Wajib memakan bidak lawan.',
    controls: 'klik bidak lalu petak tujuan',
  },
  {
    id: 'chess',
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
    players: '2–4',
    title: 'Domino',
    online: true,
    href: '/games/domino',
    description: 'Domino online untuk 2 sampai 4 pemain.',
    controls: 'klik kartu yang menyala, tarik dari tumpukan kalau buntu',
  },
  {
    id: 'quiz',
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
import { UNO_PLAYERS } from '@/lib/games/uno-rules';
