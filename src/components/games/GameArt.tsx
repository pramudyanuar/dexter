import * as React from 'react';

/**
 * Small flat drawings for the games menu, one per game. Each one is a crop of
 * the real game (the actual tiles, discs and cards), not a decorative icon.
 * On hover a single piece moves, so the menu feels alive without being busy.
 */

const CELL = '#1d2028';
const LINE = '#2b303b';
const INK = '#e9eaee';
const GREEN = '#56c98a';
const GOLD = '#e4b34a';
const RED = '#e5606a';
const BLUE = '#5b8def';

/** A piece that drifts on hover. `to` is a Tailwind translate/rotate utility. */
const move = (to: string) =>
  `transition-transform duration-500 ease-out [transform-box:fill-box] origin-center ${to}`;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox='0 0 160 100'
      className='size-full'
      role='presentation'
      aria-hidden
    >
      {children}
    </svg>
  );
}

function Wordle() {
  const rows = [
    ['#3a3f4b', '#d4a73a', '#3a3f4b', '#3a3f4b', '#3a3f4b'],
    ['#4c9f6b', '#3a3f4b', '#d4a73a', '#4c9f6b', '#3a3f4b'],
    ['#4c9f6b', '#4c9f6b', '#4c9f6b', '#4c9f6b', '#4c9f6b'],
  ];
  const word = 'RUMAH';
  return (
    <Frame>
      {rows.map((row, r) =>
        row.map((fill, c) => (
          <g
            key={`${r}${c}`}
            className={r === 2 ? move('group-hover:-translate-y-1') : ''}
            style={{ transitionDelay: `${c * 45}ms` }}
          >
            <rect
              x={24 + c * 24}
              y={14 + r * 24}
              width='20'
              height='20'
              rx='3'
              fill={fill}
            />
            {r === 2 && (
              <text
                x={34 + c * 24}
                y={28.5 + r * 24}
                textAnchor='middle'
                fontSize='11'
                fontWeight='700'
                fill='#10201a'
              >
                {word[c]}
              </text>
            )}
          </g>
        )),
      )}
    </Frame>
  );
}

function Snake() {
  const body = [
    [30, 70],
    [42, 70],
    [54, 70],
    [66, 70],
    [66, 58],
    [66, 46],
    [78, 46],
    [90, 46],
    [102, 46],
  ];
  return (
    <Frame>
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={i * 14 + 6}
          y1='0'
          x2={i * 14 + 6}
          y2='100'
          stroke={LINE}
          strokeWidth='0.6'
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`h${i}`}
          x1='0'
          y1={i * 14 + 8}
          x2='160'
          y2={i * 14 + 8}
          stroke={LINE}
          strokeWidth='0.6'
        />
      ))}
      {body.map(([x, y], i) => (
        <rect
          key={i}
          x={x - 5}
          y={y - 5}
          width='10'
          height='10'
          rx='3'
          fill={GREEN}
          opacity={0.45 + (i / body.length) * 0.55}
        />
      ))}
      <circle cx='108' cy='43.5' r='1.3' fill='#10201a' />
      <circle cx='108' cy='48.5' r='1.3' fill='#10201a' />
      <g className={move('group-hover:translate-x-1')}>
        <circle cx='128' cy='46' r='5.5' fill={RED} />
        <path
          d='M128 40.5c1-3 3-4 5-4'
          stroke={GREEN}
          strokeWidth='1.6'
          fill='none'
          strokeLinecap='round'
        />
      </g>
    </Frame>
  );
}

function Game2048() {
  const tiles: [number, string, string][] = [
    [2, '#eee4da', '#776e65'],
    [4, '#ede0c8', '#776e65'],
    [8, '#f2b179', '#fff'],
    [16, '#f59563', '#fff'],
    [0, '', ''],
    [32, '#f67c5f', '#fff'],
    [64, '#f65e3b', '#fff'],
    [0, '', ''],
    [2, '#eee4da', '#776e65'],
    [0, '', ''],
    [128, '#edcf72', '#fff'],
    [256, '#edcc61', '#fff'],
  ];
  return (
    <Frame>
      {tiles.map(([n, bg, fg], i) => {
        const x = 22 + (i % 4) * 29;
        const y = 10 + Math.floor(i / 4) * 29;
        return (
          <g
            key={i}
            className={n === 256 ? move('group-hover:-translate-x-[29px]') : ''}
          >
            <rect
              x={x}
              y={y}
              width='26'
              height='26'
              rx='4'
              fill={n ? bg : CELL}
            />
            {n > 0 && (
              <text
                x={x + 13}
                y={y + 17}
                textAnchor='middle'
                fontSize={n >= 100 ? 9 : 11}
                fontWeight='700'
                fill={fg}
              >
                {n}
              </text>
            )}
          </g>
        );
      })}
    </Frame>
  );
}

function Minesweeper() {
  // 0 hidden, -1 flag, n open with that many neighbours (9 = empty open)
  const grid = [
    [9, 1, 0, 0, 0, 0, 0],
    [9, 1, 0, -1, 0, 0, 0],
    [9, 2, 0, 0, 0, 0, 0],
    [9, 1, 1, 0, 0, 0, 0],
  ];
  const tone: Record<number, string> = { 1: '#7aa2ff', 2: GREEN, 3: RED };
  return (
    <Frame>
      {grid.flatMap((row, r) =>
        row.map((v, c) => {
          const x = 22 + c * 17;
          const y = 14 + r * 17;
          const open = v > 0;
          return (
            <g
              key={`${r}${c}`}
              className={v === -1 ? move('group-hover:-rotate-12') : ''}
            >
              <rect
                x={x}
                y={y}
                width='15'
                height='15'
                rx='2.5'
                fill={open ? '#14161b' : '#2a2e39'}
              />
              {v > 0 && v < 9 && (
                <text
                  x={x + 7.5}
                  y={y + 11}
                  textAnchor='middle'
                  fontSize='10'
                  fontWeight='700'
                  fill={tone[v]}
                >
                  {v}
                </text>
              )}
              {v === -1 && (
                <path
                  d={`M${x + 5} ${y + 12}V${y + 3}l7 3-7 3`}
                  fill={GOLD}
                  stroke={GOLD}
                  strokeWidth='1.4'
                  strokeLinejoin='round'
                />
              )}
            </g>
          );
        }),
      )}
    </Frame>
  );
}

function Tetris() {
  const col = [
    '#5ec8d8',
    '#e8c547',
    '#b07ad9',
    '#58b87a',
    '#e06c6c',
    '#6f8fe0',
    '#e69a52',
  ];
  const stack: [number, number, number][] = [
    [0, 8, 4],
    [1, 8, 0],
    [2, 8, 0],
    [3, 8, 6],
    [4, 8, 6],
    [5, 8, 6],
    [6, 8, 2],
    [7, 8, 2],
    [8, 8, 5],
    [9, 8, 5],
    [0, 7, 4],
    [1, 7, 0],
    [3, 7, 3],
    [4, 7, 3],
    [5, 7, 6],
    [7, 7, 2],
    [8, 7, 5],
    [0, 6, 4],
    [4, 6, 3],
  ];
  const cell = 10;
  const ox = 30;
  const oy = 4;
  return (
    <Frame>
      <rect
        x={ox - 2}
        y={oy - 2}
        width={cell * 10 + 4}
        height={cell * 9 + 4}
        rx='3'
        fill={CELL}
      />
      {stack.map(([x, y, k], i) => (
        <rect
          key={i}
          x={ox + x * cell + 0.7}
          y={oy + y * cell + 0.7}
          width={cell - 1.4}
          height={cell - 1.4}
          rx='1.8'
          fill={col[k]}
        />
      ))}
      <g className={move('group-hover:translate-y-[20px]')}>
        {[
          [6, 1],
          [6, 2],
          [6, 3],
          [7, 3],
        ].map(([x, y], i) => (
          <rect
            key={i}
            x={ox + x * cell + 0.7}
            y={oy + y * cell + 0.7}
            width={cell - 1.4}
            height={cell - 1.4}
            rx='1.8'
            fill={col[6]}
          />
        ))}
      </g>
    </Frame>
  );
}

function Connect4() {
  // 7 columns x 5 rows, 1 = green, 2 = gold
  const g = [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 2, 0, 0, 0],
    [0, 0, 2, 1, 1, 0, 0],
    [0, 1, 2, 2, 1, 2, 0],
  ];
  return (
    <Frame>
      <rect x='16' y='8' width='128' height='88' rx='7' fill='#27345a' />
      {g.flatMap((row, r) =>
        row.map((v, c) => (
          <circle
            key={`${r}${c}`}
            cx={31 + c * 16.5}
            cy={22 + r * 16}
            r='6.2'
            fill={v === 1 ? GREEN : v === 2 ? GOLD : '#0e1118'}
          />
        )),
      )}
      <circle
        cx={31 + 3 * 16.5}
        cy='-2'
        r='6.2'
        fill={GREEN}
        className={`${move('group-hover:translate-y-[40px]')} opacity-0 group-hover:opacity-100`}
      />
    </Frame>
  );
}

function Suit() {
  return (
    <Frame>
      {/* rock, paper, scissors, reduced to shapes */}
      <g className={move('group-hover:-translate-y-1.5')}>
        <path
          d='M22 66c-2-12 4-24 15-24s17 8 15 22c-1 8-8 13-16 13s-13-3-14-11z'
          fill='#8a8f9c'
        />
        <path
          d='M30 52c4-3 9-3 13 0'
          stroke='#6c717d'
          strokeWidth='1.5'
          fill='none'
          strokeLinecap='round'
        />
      </g>
      <g className={`${move('group-hover:-translate-y-1.5')} delay-75`}>
        <rect x='64' y='34' width='32' height='42' rx='4' fill={INK} />
        <path
          d='M71 46h18M71 54h18M71 62h11'
          stroke='#b9bdc8'
          strokeWidth='2'
          strokeLinecap='round'
        />
      </g>
      <g className={`${move('group-hover:-translate-y-1.5')} delay-150`}>
        <path
          d='M112 40l24 28M136 40l-24 28'
          stroke={RED}
          strokeWidth='4.5'
          strokeLinecap='round'
        />
        <circle
          cx='112'
          cy='71'
          r='5.5'
          fill='none'
          stroke={RED}
          strokeWidth='3'
        />
        <circle
          cx='136'
          cy='71'
          r='5.5'
          fill='none'
          stroke={RED}
          strokeWidth='3'
        />
      </g>
    </Frame>
  );
}

type UnoCards = [string, string][];

function UnoArt({
  cards = [
    ['#d94f4f', '7'],
    ['#3f74d6', '+2'],
    ['#e4b52e', '5'],
  ],
}: {
  cards?: UnoCards;
}) {
  const card = (
    x: number,
    rot: number,
    fill: string,
    label: string,
    hover: string,
  ) => (
    <g transform={`translate(${x} 52) rotate(${rot})`}>
      <g className={move(hover)}>
        <rect
          x='-17'
          y='-30'
          width='34'
          height='56'
          rx='4.5'
          fill={fill}
          stroke='#fff'
          strokeWidth='2'
        />
        <ellipse
          cx='0'
          cy='-2'
          rx='10.5'
          ry='17'
          transform='rotate(-24)'
          fill='#fff'
        />
        <text
          x='0'
          y='4'
          textAnchor='middle'
          fontSize='15'
          fontWeight='800'
          fill={fill}
        >
          {label}
        </text>
      </g>
    </g>
  );
  return (
    <Frame>
      {card(
        54,
        -14,
        cards[0][0],
        cards[0][1],
        'group-hover:-translate-x-2 group-hover:-rotate-6',
      )}
      {card(
        106,
        14,
        cards[1][0],
        cards[1][1],
        'group-hover:translate-x-2 group-hover:rotate-6',
      )}
      {card(80, 0, cards[2][0], cards[2][1], 'group-hover:-translate-y-2')}
    </Frame>
  );
}

function Battleship() {
  const s = 12;
  const ox = 26;
  const oy = 10;
  const mark = (x: number, y: number, hit: boolean, cls = '') => (
    <g key={`${x}${y}`} className={cls}>
      {hit ? (
        <path
          d={`M${ox + x * s + 3} ${oy + y * s + 3}l${s - 6} ${s - 6}m0 -${s - 6}l-${s - 6} ${s - 6}`}
          stroke={RED}
          strokeWidth='2'
          strokeLinecap='round'
        />
      ) : (
        <circle
          cx={ox + x * s + s / 2}
          cy={oy + y * s + s / 2}
          r='1.8'
          fill='#7a8190'
        />
      )}
    </g>
  );
  return (
    <Frame>
      {Array.from({ length: 8 * 7 }, (_, i) => (
        <rect
          key={i}
          x={ox + (i % 8) * s + 0.5}
          y={oy + Math.floor(i / 8) * s + 0.5}
          width={s - 1}
          height={s - 1}
          rx='1.5'
          fill={CELL}
        />
      ))}
      <rect
        x={ox + 1 * s + 1.5}
        y={oy + 1 * s + 1.5}
        width={s * 4 - 3}
        height={s - 3}
        rx='4'
        fill='#5d6577'
      />
      <rect
        x={ox + 6 * s + 1.5}
        y={oy + 2 * s + 1.5}
        width={s - 3}
        height={s * 3 - 3}
        rx='4'
        fill='#5d6577'
      />
      <rect
        x={ox + 1 * s + 1.5}
        y={oy + 5 * s + 1.5}
        width={s * 3 - 3}
        height={s - 3}
        rx='4'
        fill='#5d6577'
      />
      {mark(2, 1, true)}
      {mark(6, 3, true)}
      {mark(4, 3, false)}
      {mark(0, 4, false)}
      {mark(6, 6, false)}
      {mark(3, 2, false, move('group-hover:translate-y-0.5'))}
      <circle
        cx={ox + 5 * s + s / 2}
        cy={oy + 4 * s + s / 2}
        r='5'
        fill='none'
        stroke={GOLD}
        strokeWidth='1.5'
        className={`${move('group-hover:scale-125')} `}
      />
    </Frame>
  );
}

function Gomoku() {
  const s = 14;
  const ox = 33;
  const oy = 14;
  const stones: [number, number, 'b' | 'w'][] = [
    [1, 1, 'w'],
    [2, 2, 'b'],
    [3, 2, 'w'],
    [3, 3, 'b'],
    [4, 3, 'w'],
    [4, 4, 'b'],
    [2, 3, 'w'],
    [5, 5, 'b'],
    [5, 2, 'w'],
  ];
  return (
    <Frame>
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={ox + i * s}
          y1={oy}
          x2={ox + i * s}
          y2={oy + 5 * s}
          stroke='#3a3f4b'
          strokeWidth='1'
        />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={ox}
          y1={oy + i * s}
          x2={ox + 7 * s}
          y2={oy + i * s}
          stroke='#3a3f4b'
          strokeWidth='1'
        />
      ))}
      {stones.map(([x, y, c], i) => (
        <circle
          key={i}
          cx={ox + x * s}
          cy={oy + y * s}
          r='5.6'
          fill={c === 'b' ? '#050608' : INK}
          stroke={c === 'b' ? '#4a5060' : 'none'}
          strokeWidth='1'
        />
      ))}
      <circle
        cx={ox + 6 * s}
        cy={oy + 1 * s}
        r='5.6'
        fill='none'
        stroke={GREEN}
        strokeWidth='1.5'
        strokeDasharray='2.5 2.5'
        className={move('group-hover:translate-y-[14px]')}
      />
    </Frame>
  );
}

function Checkers() {
  const s = 14;
  const ox = 24;
  const oy = 8;
  const discs: [number, number, string][] = [
    [1, 0, '#2c2f38'],
    [3, 0, '#2c2f38'],
    [5, 0, '#2c2f38'],
    [0, 1, '#2c2f38'],
    [4, 1, '#2c2f38'],
    [3, 2, RED],
    [2, 3, RED],
    [5, 4, RED],
    [1, 5, RED],
    [3, 5, RED],
    [6, 3, RED],
  ];
  return (
    <Frame>
      {Array.from({ length: 8 * 6 }, (_, i) => {
        const c = i % 8;
        const r = Math.floor(i / 8);
        return (
          <rect
            key={i}
            x={ox + c * s}
            y={oy + r * s}
            width={s}
            height={s}
            fill={(r + c) % 2 ? '#8b5a2b' : '#e8d4ad'}
          />
        );
      })}
      {discs.map(([c, r, f], i) => (
        <circle
          key={i}
          cx={ox + c * s + s / 2 + 0}
          cy={oy + r * s + s / 2}
          r='5.2'
          fill={f}
          stroke='rgb(0 0 0 / 0.35)'
          strokeWidth='1'
          className={
            i === 6
              ? move(
                  'group-hover:translate-x-[28px] group-hover:-translate-y-[28px]',
                )
              : ''
          }
        />
      ))}
    </Frame>
  );
}

function Chess() {
  const s = 14;
  const ox = 24;
  const oy = 8;
  return (
    <Frame>
      {Array.from({ length: 8 * 6 }, (_, i) => {
        const c = i % 8;
        const r = Math.floor(i / 8);
        return (
          <rect
            key={i}
            x={ox + c * s}
            y={oy + r * s}
            width={s}
            height={s}
            fill={(r + c) % 2 ? '#739552' : '#ebecd0'}
          />
        );
      })}
      {/* a pawn and a knight, drawn as simple solids */}
      <g className={move('group-hover:-translate-y-[14px]')}>
        <circle
          cx={ox + 2.5 * s}
          cy={oy + 3.35 * s}
          r='3.2'
          fill='#f8f8f8'
          stroke='#222'
          strokeWidth='1'
        />
        <path
          d={`M${ox + 2.5 * s - 4.5} ${oy + 4.6 * s}q4.5 -7 9 0z`}
          fill='#f8f8f8'
          stroke='#222'
          strokeWidth='1'
          strokeLinejoin='round'
        />
      </g>
      <g>
        <path
          d={`M${ox + 5.2 * s} ${oy + 2.8 * s}l1.5 -6.5 4.2 -2.2 2 3.2 -3.2 1.3 1.2 4.4z`}
          fill='#2b2d33'
          stroke='#000'
          strokeWidth='0.8'
          strokeLinejoin='round'
        />
      </g>
      <rect
        x={ox + 5 * s}
        y={oy + 0 * s}
        width={s}
        height={s}
        fill='none'
        stroke={GOLD}
        strokeWidth='1.6'
        rx='1'
      />
    </Frame>
  );
}

function Dice() {
  const die = (
    x: number,
    y: number,
    rot: number,
    pips: [number, number][],
    hover: string,
  ) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <g className={move(hover)}>
        <rect
          x='-17'
          y='-17'
          width='34'
          height='34'
          rx='6'
          fill='#f4f1e8'
          stroke='#cfcab9'
          strokeWidth='1.2'
        />
        {pips.map(([px, py], i) => (
          <circle
            key={i}
            cx={px * 8.5}
            cy={py * 8.5}
            r='2.9'
            fill={pips.length === 1 ? RED : '#25272d'}
          />
        ))}
      </g>
    </g>
  );
  return (
    <Frame>
      {die(
        56,
        54,
        -12,
        [
          [-1, -1],
          [1, -1],
          [0, 0],
          [-1, 1],
          [1, 1],
        ],
        'group-hover:-rotate-[30deg] group-hover:-translate-y-1',
      )}
      {die(
        104,
        48,
        14,
        [
          [-1, -1],
          [1, 1],
        ],
        'group-hover:rotate-[40deg] group-hover:-translate-y-1.5',
      )}
    </Frame>
  );
}

function Domino() {
  const pips = (cx: number, cy: number, n: number) => {
    const map: Record<number, [number, number][]> = {
      1: [[0, 0]],
      2: [
        [-1, -1],
        [1, 1],
      ],
      3: [
        [-1, -1],
        [0, 0],
        [1, 1],
      ],
      4: [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ],
      5: [
        [-1, -1],
        [1, -1],
        [0, 0],
        [-1, 1],
        [1, 1],
      ],
      6: [
        [-1, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [1, 1],
      ],
    };
    return (map[n] ?? []).map(([x, y], i) => (
      <circle
        key={i}
        cx={cx + x * 5.5}
        cy={cy + y * 5.5}
        r='2'
        fill='#25272d'
      />
    ));
  };
  const tile = (x: number, y: number, a: number, b: number, cls = '') => (
    <g className={cls}>
      <rect
        x={x}
        y={y}
        width='58'
        height='28'
        rx='4.5'
        fill='#f4f1e8'
        stroke='#cfcab9'
        strokeWidth='1.2'
      />
      <line
        x1={x + 29}
        y1={y + 4}
        x2={x + 29}
        y2={y + 24}
        stroke='#a7a291'
        strokeWidth='1.2'
      />
      {pips(x + 14.5, y + 14, a)}
      {pips(x + 43.5, y + 14, b)}
    </g>
  );
  return (
    <Frame>
      {tile(14, 52, 6, 3)}
      {tile(72, 52, 3, 5)}
      {tile(43, 20, 5, 5, move('group-hover:-translate-y-1.5'))}
    </Frame>
  );
}

function Quiz() {
  const opts = [GOLD, '#4a4f5c', '#4a4f5c', '#4a4f5c'];
  return (
    <Frame>
      <rect
        x='28'
        y='10'
        width='104'
        height='34'
        rx='6'
        fill={CELL}
        stroke={LINE}
      />
      <text
        x='80'
        y='34'
        textAnchor='middle'
        fontSize='22'
        fontWeight='800'
        fill={INK}
      >
        ?
      </text>
      {opts.map((fill, i) => (
        <g key={i} className={i === 0 ? move('group-hover:translate-x-1') : ''}>
          <rect
            x={28 + (i % 2) * 54}
            y={52 + Math.floor(i / 2) * 20}
            width='50'
            height='16'
            rx='4'
            fill={i === 0 ? 'rgb(228 179 74 / 0.22)' : CELL}
            stroke={i === 0 ? GOLD : LINE}
          />
          <circle
            cx={37 + (i % 2) * 54}
            cy={60 + Math.floor(i / 2) * 20}
            r='4'
            fill={fill}
          />
          <rect
            x={46 + (i % 2) * 54}
            y={58 + Math.floor(i / 2) * 20}
            width='26'
            height='4'
            rx='2'
            fill='#4a4f5c'
          />
        </g>
      ))}
    </Frame>
  );
}

function Pictionary() {
  return (
    <Frame>
      <rect x='24' y='10' width='112' height='80' rx='6' fill='#f4f1e8' />
      <path
        d='M48 70V46l20-16 20 16v24z'
        fill='none'
        stroke='#25272d'
        strokeWidth='3'
        strokeLinejoin='round'
        strokeLinecap='round'
      />
      <path
        d='M62 70V56h12v14'
        fill='none'
        stroke={RED}
        strokeWidth='3'
        strokeLinejoin='round'
      />
      <circle
        cx='108'
        cy='30'
        r='8'
        fill='none'
        stroke={GOLD}
        strokeWidth='3'
      />
      <g
        className={move(
          'group-hover:-translate-x-3 group-hover:translate-y-1.5',
        )}
      >
        <path
          d='M118 62l14-14 5 5-14 14-7 2z'
          fill={BLUE}
          stroke='#25272d'
          strokeWidth='1.5'
          strokeLinejoin='round'
        />
      </g>
    </Frame>
  );
}

const Uno = () => <UnoArt />;
/** Flip: the dark side's colours and the FLIP card. */
const UnoFlip = () => (
  <UnoArt
    cards={[
      ['#d4488f', '5'],
      ['#7b4cc0', '+5'],
      ['#1e9e91', '⟲'],
    ]}
  />
);
/** No Mercy: the big penalties. */
const UnoMercy = () => (
  <UnoArt
    cards={[
      ['#c43434', '+6'],
      ['#2a2d36', '+4'],
      ['#e4b52e', '25'],
    ]}
  />
);

const ART: Record<string, () => React.JSX.Element> = {
  wordle: Wordle,
  snake: Snake,
  '2048': Game2048,
  minesweeper: Minesweeper,
  tetris: Tetris,
  connect4: Connect4,
  suit: Suit,
  uno: Uno,
  unoflip: UnoFlip,
  unomercy: UnoMercy,
  battleship: Battleship,
  gomoku: Gomoku,
  checkers: Checkers,
  chess: Chess,
  dice: Dice,
  domino: Domino,
  quiz: Quiz,
  pictionary: Pictionary,
};

/** The menu drawing for a game id; the parent needs the `group` class for hover motion. */
export default function GameArt({ id }: { id: string }) {
  const Art = ART[id];
  return Art ? <Art /> : null;
}
