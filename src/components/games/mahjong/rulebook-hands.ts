import {
  type Meld,
  meldTiles,
  scoreHand,
  TILE_CODES,
} from '@/lib/games/hk-mahjong/score';

interface Example {
  title: string;
  description: string;
  open?: Meld;
  groups: string[];
  labels?: string[];
}

// The last tile in the last group is the winning discard in each example.
// The reader sits South in the East round and holds one flower.
export const STANDARD_HAND: Example = {
  title: 'Empat set dan satu pasang',
  description:
    'Dua chow membentuk urutan. Dua pong memakai ubin kembar tiga. Sepasang 7 lingkaran melengkapi tangan ini.',
  open: { kind: 'chow', tile: 0 },
  groups: ['c4 c5 c6', 'dr dr dr', 'we we we', 'd7 d7'],
};

export const PATTERN_HANDS: Example[] = [
  {
    title: 'Semua pong',
    description:
      'Empat kelompok berisi ubin yang sama, ditutup dengan satu pasang. Salah satu pong di tangan ini terbuka.',
    open: { kind: 'pong', tile: 2 },
    groups: ['c2 c2 c2', 'd8 d8 d8', 'b7 b7 b7', 'c4 c4'],
  },
  {
    title: 'Tujuh pasang',
    description:
      'Kumpulkan tujuh pasang berbeda di tangan tertutup. Empat salinan dari satu ubin hanya bisa menyumbang satu pasang untuk pola ini.',
    groups: ['b1 b1', 'b7 b7', 'c2 c2', 'c6 c6', 'd3 d3', 'd8 d8', 'ww ww'],
  },
  {
    title: 'Satu jenis murni',
    description:
      'Seluruh ubin memakai satu jenis angka. Contoh ini hanya memakai lingkaran, termasuk pasangannya.',
    open: { kind: 'chow', tile: 18 },
    groups: ['d3 d4 d5', 'd6 d6 d6', 'd7 d8 d9', 'd2 d2'],
  },
  {
    title: 'Tiga naga kecil',
    description:
      'Dua naga menjadi pong, sedangkan naga ketiga menjadi pasangan. Nilai kedua pong naga sudah termasuk dalam lima faan pola ini.',
    open: { kind: 'pong', tile: 31 },
    groups: ['dg dg dg', 'b3 b4 b5', 'c2 c3 c4', 'dw dw'],
  },
  {
    title: 'Tiga belas yatim',
    description:
      'Ambil angka 1 dan 9 dari setiap jenis, keempat angin, serta ketiga naga. Salah satu dari 13 ubin itu harus berpasangan. Di sini naga putih menjadi pasangan.',
    groups: ['b1 b9', 'c1 c9', 'd1 d9', 'we ws ww wn', 'dr dg dw dw'],
    labels: ['Bambu', 'Karakter', 'Lingkaran', 'Angin', 'Naga'],
  },
  {
    title: 'Sembilan gerbang',
    description:
      'Tangan tertutup satu jenis berisi 1112345678999. Angka mana pun dari jenis yang sama dapat melengkapinya. Pada contoh ini, ubin terakhir adalah 5 bambu.',
    groups: ['b1 b1 b1', 'b2 b3 b4', 'b5 b6 b7 b8', 'b9 b9 b9', 'b5'],
    labels: ['111', '234', '5678', '999', 'Penutup'],
  },
];

export function readExample(example: Example, flower: number) {
  const closed = example.groups.map((group) =>
    group.split(' ').map((code) => TILE_CODES.indexOf(code)),
  );
  const hand = closed.flat();
  const open = example.open ? [example.open] : [];
  const groups = [
    ...open.map((m) => ({
      tiles: meldTiles(m),
      label: m.kind === 'chow' ? 'Chow terbuka' : 'Pong terbuka',
    })),
    ...closed.map((tiles, i) => ({
      tiles,
      label:
        example.labels?.[i] ??
        (tiles.length === 2
          ? 'Pasang'
          : tiles[0] === tiles[1]
            ? 'Pong'
            : 'Chow'),
    })),
  ];
  const score = scoreHand(hand, open, {
    wind: 1,
    flowers: [flower],
    source: 'discard',
    winningTile: hand[hand.length - 1],
    last: false,
  });
  if (!score) throw new Error(`Contoh tangan tidak lengkap: ${example.title}`);
  return { groups, score };
}
