import * as React from 'react';

import { nameOf, suitOf } from '@/lib/games/mahjong-tiles';

const G = '#2e7d4f';
const R = '#c0392b';
const B = '#2457a6';
const INK = '#26231f';

const CJK =
  "'Noto Serif CJK SC','Noto Serif SC','Songti SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei','SimSun',serif";

type Dot = [number, number, string];

/** Where the circles go on a dot tile, and what colour each one is. */
const DOTS: Record<number, Dot[]> = {
  2: [
    [24, 20, G],
    [24, 44, R],
  ],
  3: [
    [13, 14, B],
    [24, 32, R],
    [35, 50, G],
  ],
  4: [
    [14, 20, B],
    [34, 20, G],
    [14, 44, G],
    [34, 44, B],
  ],
  5: [
    [14, 18, B],
    [34, 18, G],
    [24, 32, R],
    [14, 46, G],
    [34, 46, B],
  ],
  6: [
    [15, 15, G],
    [33, 15, G],
    [15, 32, R],
    [33, 32, R],
    [15, 49, R],
    [33, 49, R],
  ],
  7: [
    [11, 13, G],
    [24, 21, G],
    [37, 29, G],
    [15, 42, R],
    [33, 42, R],
    [15, 55, R],
    [33, 55, R],
  ],
  8: [
    [15, 12, B],
    [33, 12, B],
    [15, 26, B],
    [33, 26, B],
    [15, 40, B],
    [33, 40, B],
    [15, 54, B],
    [33, 54, B],
  ],
  9: [
    [10, 16, G],
    [24, 16, R],
    [38, 16, B],
    [10, 32, G],
    [24, 32, R],
    [38, 32, B],
    [10, 48, G],
    [24, 48, R],
    [38, 48, B],
  ],
};

function Disc({
  x,
  y,
  color,
  r = 6.4,
}: {
  x: number;
  y: number;
  color: string;
  r?: number;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle
        cx={x}
        cy={y}
        r={r * 0.62}
        fill='none'
        stroke='#f7f1df'
        strokeWidth='1.2'
      />
      <circle cx={x} cy={y} r={r * 0.22} fill='#f7f1df' />
    </g>
  );
}

function Dots({ n }: { n: number }) {
  if (n === 1) {
    return (
      <g>
        <circle cx='24' cy='32' r='15' fill='none' stroke={G} strokeWidth='3' />
        <circle cx='24' cy='32' r='10' fill={R} />
        <circle
          cx='24'
          cy='32'
          r='6'
          fill='none'
          stroke='#f7f1df'
          strokeWidth='1.5'
        />
        <circle cx='24' cy='32' r='2.4' fill='#f7f1df' />
      </g>
    );
  }
  return (
    <g>
      {DOTS[n].map(([x, y, c], i) => (
        <Disc key={i} x={x} y={y} color={c} />
      ))}
    </g>
  );
}

function Stick({
  x,
  y,
  color = G,
  h = 17,
}: {
  x: number;
  y: number;
  color?: string;
  h?: number;
}) {
  return (
    <g>
      <rect
        x={x - 3.2}
        y={y - h / 2}
        width='6.4'
        height={h}
        rx='2.4'
        fill={color}
      />
      <rect
        x={x - 3.2}
        y={y - 1}
        width='6.4'
        height='2'
        fill='#f7f1df'
        opacity='0.85'
      />
      <rect
        x={x - 1}
        y={y - h / 2 + 2}
        width='1.4'
        height={h - 4}
        rx='0.7'
        fill='#fff'
        opacity='0.25'
      />
    </g>
  );
}

const STICKS: Record<number, [number, number, string?][]> = {
  2: [
    [24, 18],
    [24, 46, R],
  ],
  3: [
    [24, 16, R],
    [15, 44],
    [33, 44],
  ],
  4: [
    [15, 18],
    [33, 18],
    [15, 46],
    [33, 46],
  ],
  5: [
    [13, 16],
    [35, 16],
    [24, 32, R],
    [13, 48],
    [35, 48],
  ],
  6: [
    [10, 18],
    [24, 18],
    [38, 18],
    [10, 46],
    [24, 46],
    [38, 46],
  ],
  7: [
    [24, 12, R],
    [10, 33],
    [24, 33],
    [38, 33],
    [10, 54],
    [24, 54],
    [38, 54],
  ],
  8: [
    [9, 16],
    [20, 16],
    [31, 16],
    [42, 16],
    [9, 47],
    [20, 47],
    [31, 47],
    [42, 47],
  ],
  9: [
    [10, 12],
    [24, 12],
    [38, 12],
    [10, 32, R],
    [24, 32, R],
    [38, 32, R],
    [10, 52],
    [24, 52],
    [38, 52],
  ],
};

function Bamboo({ n }: { n: number }) {
  if (n === 1) {
    // the sparrow on bamboo
    return (
      <g>
        <path
          d='M24 52 L24 18'
          stroke={G}
          strokeWidth='4'
          strokeLinecap='round'
        />
        <ellipse cx='24' cy='34' rx='11' ry='8' fill={G} />
        <circle cx='33' cy='26' r='5.5' fill={G} />
        <path d='M37.5 26 L43 28 L37.5 30Z' fill={R} />
        <circle cx='34.5' cy='25' r='1.3' fill='#f7f1df' />
        <path d='M14 36 C8 40 6 48 10 52 C13 46 15 42 18 40Z' fill={R} />
        <path
          d='M20 41 L18 52 M27 41 L29 52'
          stroke={R}
          strokeWidth='1.8'
          strokeLinecap='round'
        />
      </g>
    );
  }
  return (
    <g>
      {STICKS[n].map(([x, y, c], i) => (
        <Stick key={i} x={x} y={y} color={c ?? G} h={n >= 8 ? 24 : 21} />
      ))}
    </g>
  );
}

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function Character({ n }: { n: number }) {
  return (
    <g fontFamily={CJK} textAnchor='middle' fontWeight='700'>
      <text x='24' y='30' fontSize='25' fill={INK}>
        {NUMERALS[n]}
      </text>
      <text x='24' y='55' fontSize='22' fill={R}>
        萬
      </text>
    </g>
  );
}

const WIND: Record<string, [string, string]> = {
  we: ['東', 'E'],
  ws: ['南', 'S'],
  ww: ['西', 'W'],
  wn: ['北', 'N'],
};

function Wind({ kind }: { kind: string }) {
  const [c, l] = WIND[kind];
  return (
    <g fontFamily={CJK} textAnchor='middle' fontWeight='700'>
      <text x='24' y='42' fontSize='34' fill={INK}>
        {c}
      </text>
      <text
        x='41'
        y='12'
        fontSize='9'
        fill={INK}
        fontFamily='sans-serif'
        opacity='0.55'
      >
        {l}
      </text>
    </g>
  );
}

function Dragon({ kind }: { kind: string }) {
  if (kind === 'dw') {
    return (
      <g>
        <rect
          x='9'
          y='12'
          width='30'
          height='40'
          rx='3'
          fill='none'
          stroke={B}
          strokeWidth='3.2'
        />
        <rect
          x='14'
          y='17'
          width='20'
          height='30'
          rx='2'
          fill='none'
          stroke={B}
          strokeWidth='1.4'
        />
      </g>
    );
  }
  return (
    <text
      x='24'
      y='44'
      textAnchor='middle'
      fontSize='36'
      fontWeight='800'
      fontFamily={CJK}
      fill={kind === 'dr' ? R : G}
    >
      {kind === 'dr' ? '中' : '發'}
    </text>
  );
}

const SEASON = ['', '春', '夏', '秋', '冬'];

function Season({ n }: { n: number }) {
  const color = ['', G, R, '#b9731d', B][n];
  return (
    <g textAnchor='middle' fontFamily={CJK} fontWeight='700'>
      <text x='24' y='42' fontSize='32' fill={color}>
        {SEASON[n]}
      </text>
      <text x='40' y='12' fontSize='9' fill={color} fontFamily='sans-serif'>
        {n}
      </text>
    </g>
  );
}

function Flower({ n }: { n: number }) {
  const petals = (
    count: number,
    r: number,
    fill: string,
    cx = 24,
    cy = 32,
    len = 11,
  ) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      return (
        <ellipse
          key={i}
          cx={cx + Math.cos(a) * len}
          cy={cy + Math.sin(a) * len}
          rx={r}
          ry={r * 1.25}
          transform={`rotate(${(a * 180) / Math.PI + 90} ${cx + Math.cos(a) * len} ${cy + Math.sin(a) * len})`}
          fill={fill}
        />
      );
    });
  return (
    <g>
      {n === 1 && (
        // plum blossom
        <g>
          <path
            d='M10 56 C16 46 22 40 30 34'
            stroke='#6b4a2b'
            strokeWidth='3'
            fill='none'
            strokeLinecap='round'
          />
          {petals(5, 6, '#e98aa6', 28, 30, 8)}
          <circle cx='28' cy='30' r='3.4' fill='#f3c14b' />
          {petals(5, 3.6, '#e98aa6', 14, 46, 5)}
        </g>
      )}
      {n === 2 && (
        // orchid
        <g>
          <path
            d='M12 56 C14 40 22 26 36 14'
            stroke={G}
            strokeWidth='3'
            fill='none'
            strokeLinecap='round'
          />
          <path
            d='M18 56 C22 44 32 36 42 34'
            stroke={G}
            strokeWidth='2.4'
            fill='none'
            strokeLinecap='round'
          />
          {petals(5, 4.2, '#b56bb8', 34, 20, 6)}
          <circle cx='34' cy='20' r='2.4' fill='#f3c14b' />
        </g>
      )}
      {n === 3 && (
        // chrysanthemum
        <g>
          {petals(14, 3, '#f0a31d', 24, 30, 11)}
          {petals(9, 3, '#f7c64a', 24, 30, 6.5)}
          <circle cx='24' cy='30' r='3.4' fill='#b9731d' />
          <path
            d='M24 42 L24 58'
            stroke={G}
            strokeWidth='2.6'
            strokeLinecap='round'
          />
        </g>
      )}
      {n === 4 && (
        // bamboo
        <g>
          <Stick x={16} y={36} h={36} />
          <Stick x={28} y={32} h={40} />
          <path d='M30 18 C38 14 44 18 44 24 C38 24 34 22 30 18Z' fill={G} />
          <path d='M16 22 C8 18 4 22 4 28 C10 28 14 26 16 22Z' fill={G} />
        </g>
      )}
      <text
        x='41'
        y='12'
        textAnchor='middle'
        fontSize='9'
        fontFamily='sans-serif'
        fontWeight='700'
        fill={['', '#c25274', '#8e4a91', '#b9731d', G][n]}
      >
        {n}
      </text>
    </g>
  );
}

/** The picture on a tile. Drawn, not typed: no emoji. */
export default function TileFace({ kind }: { kind: string }) {
  const suit = suitOf(kind);
  const n = Number(kind.slice(1));
  return (
    <svg
      viewBox='0 0 48 64'
      role='img'
      aria-label={nameOf(kind)}
      className='size-full'
    >
      {suit === 'dot' && <Dots n={n} />}
      {suit === 'bamboo' && <Bamboo n={n} />}
      {suit === 'character' && <Character n={n} />}
      {suit === 'wind' && <Wind kind={kind} />}
      {suit === 'dragon' && <Dragon kind={kind} />}
      {suit === 'flower' && <Flower n={n} />}
      {suit === 'season' && <Season n={n} />}
      {(suit === 'bamboo' || suit === 'dot' || suit === 'character') && (
        <text
          x='6'
          y='11'
          fontSize='8.5'
          fontFamily='sans-serif'
          fontWeight='700'
          fill={INK}
          opacity='0.5'
        >
          {n}
        </text>
      )}
    </svg>
  );
}
