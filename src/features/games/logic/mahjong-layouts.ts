/**
 * Board layouts. A tile sits at (x, y, z): x and y in half-tile steps (a tile
 * is 2 wide and 2 tall), z the layer it is stacked on. A tile on a higher layer
 * covers whichever tiles lie under any part of it.
 */

export interface Pos {
  x: number;
  y: number;
  z: number;
}

export type LayoutId =
  'turtle' | 'pyramid' | 'fortress' | 'spider' | 'dragon' | 'custom';

export const LAYOUT_IDS: readonly LayoutId[] = [
  'turtle',
  'pyramid',
  'fortress',
  'spider',
  'dragon',
  'custom',
];

export const LAYOUT_NAMES: Record<LayoutId, string> = {
  turtle: 'Classic Turtle',
  pyramid: 'Pyramid',
  fortress: 'Fortress',
  spider: 'Spider',
  dragon: 'Dragon',
  custom: 'Custom',
};

/** One layer per entry; `#` is a tile, anything else is empty. */
function fromMaps(layers: string[][]): Pos[] {
  const out: Pos[] = [];
  layers.forEach((rows, z) => {
    rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === '#') out.push({ x: c * 2, y: r * 2, z });
      });
    });
  });
  return out;
}

/** The classic turtle: 144 tiles in five layers, with a wing on each side. */
function turtle(): Pos[] {
  const out: Pos[] = [];
  const row = (y: number, from: number, to: number, z = 0) => {
    for (let x = from; x <= to; x += 2) out.push({ x, y, z });
  };
  row(0, 2, 24);
  row(2, 6, 20);
  row(4, 4, 22);
  row(6, 2, 24);
  row(8, 2, 24);
  row(10, 4, 22);
  row(12, 6, 20);
  row(14, 2, 24);
  out.push({ x: 0, y: 7, z: 0 }, { x: 26, y: 7, z: 0 }, { x: 28, y: 7, z: 0 });
  for (let y = 2; y <= 12; y += 2) row(y, 8, 18, 1);
  for (let y = 4; y <= 10; y += 2) row(y, 10, 16, 2);
  for (let y = 6; y <= 8; y += 2) row(y, 12, 14, 3);
  out.push({ x: 13, y: 7, z: 4 });
  return out;
}

const PYRAMID = [
  [
    '##########',
    '##########',
    '##########',
    '##########',
    '##########',
    '##########',
  ],
  [
    '..........',
    '.########.',
    '.########.',
    '.########.',
    '.########.',
    '..........',
  ],
  [
    '..........',
    '..........',
    '..######..',
    '..######..',
    '..........',
    '..........',
  ],
  [
    '..........',
    '..........',
    '...####...',
    '...####...',
    '..........',
    '..........',
  ],
];

const FORTRESS = [
  [
    '##############',
    '##############',
    '##..........##',
    '##..........##',
    '##..........##',
    '##..........##',
    '##############',
    '##############',
  ].map((r) => r.slice(0, 14)),
  [
    '..............',
    '.############.',
    '.#..........#.',
    '.#..........#.',
    '.#..........#.',
    '.#..........#.',
    '.############.',
    '..............',
  ].map((r) => r.slice(0, 14)),
  [
    '..............',
    '.##........##.',
    '..............',
    '..............',
    '..............',
    '..............',
    '.##........##.',
    '..............',
  ].map((r) => r.slice(0, 14)),
];

const SPIDER = [
  [
    '##.............##',
    '.##...........##.',
    '..##.........##..',
    '...##.#####.##...',
    '....#########....',
    '.....#######.....',
    '....#########....',
    '...##.#####.##...',
    '..##.........##..',
    '.##...........##.',
    '##.............##',
  ],
  [
    '.................',
    '.................',
    '.................',
    '.................',
    '......#####......',
    '......#####......',
    '......#####......',
    '.................',
    '.................',
    '.................',
    '.................',
  ],
  [
    '.................',
    '.................',
    '.................',
    '.................',
    '.......##........',
    '.......##........',
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
  ],
];

const DRAGON = [
  [
    '.####...........',
    '######..........',
    '.#####.#####....',
    '..#########.....',
    '.....#########..',
    '....#####..####.',
    '.....###....####',
    '..............##',
  ],
  [
    '................',
    '..###...........',
    '...###..........',
    '...#######......',
    '......#######...',
    '.....###...###..',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '....####........',
    '.......####.....',
    '................',
    '................',
    '................',
  ],
];

export function layoutPositions(id: LayoutId, custom: Pos[] = []): Pos[] {
  switch (id) {
    case 'turtle':
      return turtle();
    case 'pyramid':
      return fromMaps(PYRAMID);
    case 'fortress':
      return fromMaps(FORTRESS);
    case 'spider':
      return fromMaps(SPIDER);
    case 'dragon':
      return fromMaps(DRAGON);
    default:
      return custom;
  }
}

/** The size of the playing field, for drawing it. */
export function extent(positions: Pos[]) {
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const zs = positions.map((p) => p.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs) + 2,
    minY: Math.min(...ys),
    maxY: Math.max(...ys) + 2,
    layers: Math.max(...zs) + 1,
  };
}
