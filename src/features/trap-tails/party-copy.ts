import type { ItemId, PlacementError } from './items';
import type { Category, Outcome, Phase } from './match';

export const itemCopy: Record<ItemId, [string, string]> = {
  plank: ['Papan kayu', 'Pijakan panjang. Bisa diputar jadi dinding.'],
  steel: [
    'Rangka baja',
    'Rangka kokoh untuk menahan proyektil dan melompat dinding.',
  ],
  shelf: ['Rak tipis', 'Tembus dari bawah, bisa diinjak dari atas.'],
  spikes: ['Deret duri', 'Menempel ke sisi pijakan. Jauhi ujung durinya.'],
  saw: ['Gergaji', 'Mata bundar berputar di tempat.'],
  rail: [
    'Gergaji rel',
    'Bergerak bolak-balik. Putar rel untuk mengubah arahnya.',
  ],
  arrow: [
    'Pelontar',
    'Menembakkan proyektil busa setelah aba-aba. Dinding menahannya.',
  ],
  spring: [
    'Pegas',
    'Memantulkan pemain saat menyentuh pelatnya. Putar untuk mengubah arah pantul.',
  ],
  conveyor: [
    'Sabuk berjalan',
    'Mendorong pemain yang menginjaknya. Putar untuk membalik arah.',
  ],
  lift: ['Lift rel', 'Mengangkat pemain dan perangkat yang terpasang padanya.'],
  bomb: ['Paket bongkar', 'Menghapus bagian buatan pemain dalam lingkaran.'],
  coin: [
    'Koin daun',
    'Diambil satu pemain. Bawa sampai finis untuk mendapat poin.',
  ],
  fan: [
    'Kipas angin',
    'Mendorong pemain di depan kipas. Bisa memperpanjang lompatan pegas.',
  ],
  piston: ['Piston tinju', 'Lampunya menyala sebelum bantalan melesat.'],
  swing: ['Bandul', 'Bantalan berat berayun di ujung lengan.'],
};

export const phaseCopy: Record<Phase, string> = {
  intro: 'Kenali lintasan',
  draft: 'Pilih dari peti',
  build: 'Pasang di lintasan',
  countdown: 'Siap di garis awal',
  race: 'Balapan',
  result: 'Hasil ronde',
  score: 'Papan skor',
  victory: 'Pemenang',
};
export const categoryCopy: Record<Category, string> = {
  goal: 'Finis',
  first: 'Pertama',
  solo: 'Finis sendiri',
  trap: 'Jebakan',
  coin: 'Koin',
  comeback: 'Bangkit',
};
export const categoryColor: Record<Category, string> = {
  goal: '#347b74',
  first: '#316086',
  solo: '#8c5274',
  trap: '#a8523b',
  coin: '#bb7628',
  comeback: '#67608a',
};
export const outcomeCopy: Record<Outcome, string> = {
  all: 'Semua finis. Buat lintasannya lebih sulit!',
  none: 'Belum ada yang finis. Buka jalur baru!',
  mixed: 'Ronde selesai!',
};
export const errorCopy: Record<PlacementError, string> = {
  bounds: 'Bagian ini keluar arena.',
  protected: 'Jaga area mulai dan finis tetap kosong.',
  blocked: 'Bagian ini menabrak benda lain.',
  mount: 'Dekatkan ke sisi pijakan untuk menempel.',
  empty: 'Arahkan paket ke bagian buatan pemain.',
  cap: 'Batas bagian tercapai. Gunakan paket bongkar.',
  turn: 'Bagian ini tidak bisa diputar ke arah itu.',
};
export const partyCopy = {
  name: 'Party lokal',
  gate: 'PARTY [E]',
  setup:
    'Bermain di satu keyboard. Pilih bagian dari satu peti, lalu ubah lintasannya setiap ronde.',
  practice: 'Kembali ke latihan',
  players: 'Pemain',
  rounds: 'Maks. ronde',
  points: 'Target poin',
  double: 'Dua peti tiap ronde untuk 2 pemain',
  begin: 'Mulai Party',
  leave: 'Keluar dari Party?',
  leaveBody: 'Papan dan skor pertandingan ini akan direset.',
  round: 'Ronde',
  box: 'Peti',
  tiebreak: 'Balapan penentu',
  draftHint: 'Satu barang per pemain. Siapa cepat, dia dapat.',
  buildHint: 'Arahkan ke arena atau gerakkan penunjuk dengan tombol pemain.',
  choosePlayer: 'Pilih pemain',
  available: 'Tersedia',
  chosen: 'Diambil',
  pass: 'Lewati',
  place: 'Pasang',
  rotate: 'Putar',
  flip: 'Balik arah',
  valid: 'Siap dipasang',
  bonus: 'Poin ronde',
  tied: 'Seri bersama',
  rematch: 'Main lagi',
  seatLabel: 'Pemain',
  coin: 'Koin',
  results: 'Hasil pemain',
  firstToFinish: 'Pemain yang mencapai finis lebih dulu menang.',
  finish: 'Finis',
  dead: 'Gugur',
  timeout: 'Waktu habis',
  racer: 'Berbalapan',
  ready: 'Siap',
  change: 'Ganti pemain',
  noScore: 'Skor tetap',
} as const;
