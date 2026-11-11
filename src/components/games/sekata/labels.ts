import type { Mode } from '@/lib/games/sekata-config';

export const MODE_INFO: Record<Mode, { title: string; blurb: string }> = {
  classic: {
    title: 'Klasik',
    blurb: 'Yang pertama menghabiskan kartunya menang.',
  },
  green: {
    title: 'Kartu Hijau',
    blurb: 'Tiap pemain dapat kartu joker pribadi untuk satu suku kata.',
  },
  point: {
    title: 'Poin',
    blurb: 'Kata dan kartu yang terpakai jadi poin. Skor tertinggi menang.',
  },
  elimination: {
    title: 'Eliminasi',
    blurb:
      'Yang kartunya habis aman. Pemain terakhir yang masih punya kartu kalah.',
  },
  speed: {
    title: 'Tantangan Cepat',
    blurb: 'Lawan waktu. Saat habis, sisa kartu tersedikit menang.',
  },
  vocabulary: {
    title: 'Tantangan Kosakata',
    blurb: 'Setiap kata harus dijelaskan artinya, dan bisa ditantang.',
  },
  norepeat: {
    title: 'Tanpa Pengulangan',
    blurb: 'Kata yang sudah dipakai tidak boleh dipakai lagi.',
  },
};

/** One colour per seat, for avatars. */
export const SEAT_COLORS = [
  '#f08fb0',
  '#f2c14e',
  '#7cc576',
  '#6aa9e9',
  '#b68be0',
  '#f09a5a',
  '#5fc2b4',
  '#e57373',
  '#9aa5b1',
  '#c2a36b',
];

export const seatColor = (seat: number) =>
  SEAT_COLORS[seat % SEAT_COLORS.length];
