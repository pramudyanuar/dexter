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

function SnakeDaily() {
  const body = [
    [24, 68],
    [36, 68],
    [48, 68],
    [60, 68],
    [60, 56],
    [72, 56],
    [84, 56],
    [96, 56],
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
      <circle cx='102' cy='53.5' r='1.3' fill='#10201a' />
      <circle cx='102' cy='58.5' r='1.3' fill='#10201a' />
      <g className={move('group-hover:scale-110')}>
        <circle cx='126' cy='56' r='6' fill={GOLD} />
        <circle
          cx='126'
          cy='56'
          r='9'
          fill='none'
          stroke={GOLD}
          strokeWidth='1'
          opacity='0.45'
        />
      </g>
      <rect
        x='14'
        y='12'
        width='40'
        height='16'
        rx='4'
        fill={CELL}
        stroke={GOLD}
        strokeWidth='1'
      />
      <text
        x='34'
        y='23'
        textAnchor='middle'
        fontSize='9'
        fontWeight='700'
        fill={GOLD}
      >
        120s
      </text>
    </Frame>
  );
}

function SnakeDuel() {
  const p1 = [
    [20, 32],
    [32, 32],
    [44, 32],
    [56, 32],
    [56, 44],
  ];
  const p2 = [
    [140, 68],
    [128, 68],
    [116, 68],
    [104, 68],
    [104, 56],
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
      {p1.map(([x, y], i) => (
        <rect
          key={`p1-${i}`}
          x={x - 5}
          y={y - 5}
          width='10'
          height='10'
          rx='3'
          fill={GREEN}
          opacity={0.45 + (i / p1.length) * 0.55}
        />
      ))}
      {p2.map(([x, y], i) => (
        <rect
          key={`p2-${i}`}
          x={x - 5}
          y={y - 5}
          width='10'
          height='10'
          rx='3'
          fill={BLUE}
          opacity={0.45 + (i / p2.length) * 0.55}
        />
      ))}
      <g className={move('group-hover:scale-110')}>
        <circle cx='80' cy='50' r='5.5' fill={RED} />
        <path
          d='M80 44.5c1-3 3-4 5-4'
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
  const s = 11;
  const ox = 36;
  const oy = 6;
  const pieces = {
    king: 'M0-4.6v3.2M-1.2-3.6h2.4M-2.8 4.1v-1l1-1.1-1.1-2.7 1.3-.8L0-.5l1.6-1 1.3.8-1.1 2.7 1 1.1v1z',
    rook: 'M-2.9 4.1V3l1-1.2.3-2.7-1.1-.8v-2.1h1.5v1.2h.6v-1.2H.6v1.2h.6v-1.2h1.5v2.1l-1.1.8.3 2.7 1 1.2v1.1z',
    bishop:
      'M-2.8 4.1V3l1.5-1.4.2-.9c-1.8-.5-1.9-2.4-.5-3.6L0-4.4l1.6 1.5C3-.5 2.7.2 1.1.7l.2.9L2.8 3v1.1zM.9-3.6-.5-1.8',
    knight:
      'M-3 4.1V2.9l2.2-2.5-1.7.4L-3.5-.4l2.8-2.7.6-1.2 1.1 1C3-3 3.7-.7 3.1 2.5l.3 1.6zM.1-1.9h.1',
    pawn: 'M-2.6 4.1V3.2c1.4-.5 1.6-2 1.7-3.2a1.65 1.65 0 1 1 1.8 0c.1 1.2.3 2.7 1.7 3.2v.9z',
  };
  const placement = [
    [0, 0, 'rook', false],
    [4, 0, 'king', false],
    [5, 2, 'knight', false],
    [3, 3, 'pawn', false],
    [4, 5, 'pawn', true],
    [2, 6, 'bishop', true],
    [4, 7, 'king', true],
    [7, 7, 'rook', true],
  ] as const;
  return (
    <Frame>
      <rect x={ox - 2} y={oy - 2} width='92' height='92' rx='2' fill={LINE} />
      {Array.from({ length: 64 }, (_, i) => {
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
      <rect
        x={ox + 4 * s + 0.75}
        y={oy + 4 * s + 0.75}
        width={s - 1.5}
        height={s - 1.5}
        fill='none'
        stroke={GOLD}
        strokeWidth='1.25'
      />
      {placement.map(([col, row, kind, white]) => (
        <g
          key={`${col}-${row}`}
          transform={`translate(${ox + (col + 0.5) * s} ${oy + (row + 0.5) * s})`}
        >
          <path
            d={pieces[kind]}
            fill={white ? '#fff8e4' : '#252a25'}
            stroke={white ? '#33372c' : '#121611'}
            strokeWidth='0.7'
            strokeLinecap='round'
            strokeLinejoin='round'
            className={
              white && kind === 'pawn'
                ? move('motion-safe:group-hover:-translate-y-[11px]')
                : undefined
            }
          />
        </g>
      ))}
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

/** Sekata: syllable cards that spell a word. */
function Sekata() {
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
          x='-18'
          y='-28'
          width='36'
          height='54'
          rx='6'
          fill={fill}
          stroke='#fff'
          strokeWidth='2'
        />
        <text
          x='0'
          y='7'
          textAnchor='middle'
          fontSize='17'
          fontWeight='900'
          fill='#3a1f2b'
        >
          {label}
        </text>
      </g>
    </g>
  );
  return (
    <Frame>
      {card(
        50,
        -8,
        '#f8b8cd',
        'MA',
        'group-hover:-translate-x-2 group-hover:-rotate-6',
      )}
      {card(88, 2, '#f8b8cd', 'NA', 'group-hover:-translate-y-2')}
      {card(
        125,
        10,
        '#f7dc6a',
        'DI',
        'group-hover:translate-x-2 group-hover:rotate-6',
      )}
    </Frame>
  );
}

/** Mahjong: ivory tiles with a jade edge. */
function Mahjong() {
  const tile = (
    x: number,
    rot: number,
    face: React.ReactNode,
    hover: string,
  ) => (
    <g transform={`translate(${x} 52) rotate(${rot})`}>
      <g className={move(hover)}>
        <rect x='-17' y='-26' width='38' height='56' rx='5' fill='#164a34' />
        <rect
          x='-19'
          y='-29'
          width='36'
          height='54'
          rx='5'
          fill='#fbf5e0'
          stroke='#cbbd94'
          strokeWidth='1.5'
        />
        {face}
      </g>
    </g>
  );
  return (
    <Frame>
      {tile(
        52,
        -8,
        <>
          <circle cx='-1' cy='-6' r='6' fill='#2457a6' />
          <circle cx='-1' cy='-6' r='2' fill='#fbf5e0' />
          <circle cx='-1' cy='11' r='6' fill='#c0392b' />
          <circle cx='-1' cy='11' r='2' fill='#fbf5e0' />
        </>,
        'group-hover:-translate-x-2 group-hover:-rotate-6',
      )}
      {tile(
        88,
        2,
        <>
          <rect x='-9' y='-17' width='5' height='34' rx='2' fill='#2e7d4f' />
          <rect x='3' y='-17' width='5' height='34' rx='2' fill='#c0392b' />
        </>,
        'group-hover:-translate-y-2',
      )}
      {tile(
        124,
        10,
        <text
          x='-1'
          y='8'
          textAnchor='middle'
          fontSize='24'
          fontWeight='800'
          fill='#c0392b'
        >
          中
        </text>,
        'group-hover:translate-x-2 group-hover:rotate-6',
      )}
    </Frame>
  );
}

/** Three Monkeys: a bomb with a lit fuse and three monkey faces. */
function Monkeys() {
  const face = (cx: number, band: string) => (
    <g>
      <circle cx={cx - 11} cy='58' r='4.5' fill='#8a5a34' />
      <circle cx={cx + 11} cy='58' r='4.5' fill='#8a5a34' />
      <circle cx={cx} cy='58' r='11' fill='#8a5a34' />
      <ellipse cx={cx} cy='61' rx='7.5' ry='6.5' fill='#f0cfa0' />
      {band === 'blind' ? (
        <rect x={cx - 10} y='54' width='20' height='5' rx='2' fill='#2a2f3a' />
      ) : (
        <>
          <circle cx={cx - 3.5} cy='57.5' r='1.3' fill='#1b1208' />
          <circle cx={cx + 3.5} cy='57.5' r='1.3' fill='#1b1208' />
        </>
      )}
      {band === 'mute' && (
        <rect x={cx - 4} y='63.5' width='8' height='3' rx='1' fill='#c9d1d9' />
      )}
      {band === 'deaf' && (
        <>
          <circle cx={cx - 12} cy='58' r='4' fill='#e5484d' />
          <circle cx={cx + 12} cy='58' r='4' fill='#e5484d' />
        </>
      )}
    </g>
  );
  return (
    <Frame>
      <circle cx='80' cy='60' r='34' fill='#23262d' />
      <rect x='72' y='22' width='16' height='9' rx='2' fill='#3a3f49' />
      <path d='M80 22q4-10 14-8' fill='none' stroke='#b08a54' strokeWidth='2' />
      <circle cx='95' cy='14' r='3.5' fill='#f5c518' />
      <circle cx='95' cy='14' r='6' fill='#f5c518' opacity='0.3' />
      {face(60, 'blind')}
      {face(80, 'mute')}
      {face(100, 'deaf')}
    </Frame>
  );
}

/** Dart: a board seen straight on, with a dart in the treble. */
function Dart() {
  const wedge = (a1: number, a2: number, r1: number, r2: number) => {
    const p = (r: number, a: number) =>
      `${(80 + Math.sin((a * Math.PI) / 180) * r).toFixed(2)} ${(50 - Math.cos((a * Math.PI) / 180) * r).toFixed(2)}`;
    return `M${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)}Z`;
  };
  return (
    <Frame>
      <circle cx='80' cy='50' r='46' fill='#2a1b10' />
      <circle cx='80' cy='50' r='40' fill='#17181c' />
      {Array.from({ length: 20 }, (_, i) => (
        <g key={i}>
          <path
            d={wedge(i * 18 - 9, i * 18 + 9, 6, 27)}
            fill={i % 2 ? '#e9dcb8' : '#17181c'}
          />
          <path
            d={wedge(i * 18 - 9, i * 18 + 9, 27, 30)}
            fill={i % 2 ? '#1c8049' : '#c9302c'}
          />
          <path
            d={wedge(i * 18 - 9, i * 18 + 9, 30, 37)}
            fill={i % 2 ? '#e9dcb8' : '#17181c'}
          />
          <path
            d={wedge(i * 18 - 9, i * 18 + 9, 37, 40)}
            fill={i % 2 ? '#1c8049' : '#c9302c'}
          />
        </g>
      ))}
      <circle cx='80' cy='50' r='6' fill='#1c8049' />
      <circle cx='80' cy='50' r='2.6' fill='#c9302c' />
      <g
        className={move('group-hover:-translate-x-1 group-hover:translate-y-1')}
      >
        <g transform='translate(81 22)'>
          <line
            x1='0'
            y1='0'
            x2='9'
            y2='-15'
            stroke='#d7d9df'
            strokeWidth='2'
            strokeLinecap='round'
          />
          <line
            x1='4'
            y1='-7'
            x2='11'
            y2='-19'
            stroke='#8a8f9c'
            strokeWidth='4'
            strokeLinecap='round'
          />
          <path d='M11 -19 L22 -17 L19 -29 Z' fill='#e0b84c' />
          <path d='M11 -19 L5 -30 L19 -29 Z' fill='#c99a2e' />
        </g>
      </g>
    </Frame>
  );
}

function CardFan({ poker = false }: { poker?: boolean }) {
  const card = (
    x: number,
    rot: number,
    rank: string,
    suit: string,
    red: boolean,
    hover: string,
  ) => (
    <g transform={`translate(${x} 54) rotate(${rot})`}>
      <g className={move(hover)}>
        <rect
          x='-18'
          y='-30'
          width='36'
          height='56'
          rx='5'
          fill='#fbf5e0'
          stroke='#cbbd94'
          strokeWidth='1.5'
        />
        <text
          x='-12'
          y='-17'
          fontSize='11'
          fontWeight='800'
          fill={red ? '#c0262d' : '#1b1d22'}
        >
          {rank}
        </text>
        <text
          x='0'
          y='8'
          textAnchor='middle'
          fontSize='24'
          fill={red ? '#c0262d' : '#1b1d22'}
        >
          {suit}
        </text>
      </g>
    </g>
  );
  return (
    <Frame>
      {card(
        52,
        -16,
        poker ? 'A' : '7',
        poker ? '♠' : '♥',
        !poker,
        'group-hover:-translate-x-2 group-hover:-rotate-6',
      )}
      {card(80, 0, poker ? 'A' : '8', '♥', true, 'group-hover:-translate-y-2')}
      {card(
        108,
        16,
        poker ? 'A' : '9',
        poker ? '♣' : '♥',
        !poker,
        'group-hover:translate-x-2 group-hover:rotate-6',
      )}
    </Frame>
  );
}

const Remo = () => <CardFan />;
const Poker = () => <CardFan poker />;

function CardArchive() {
  return (
    <div
      aria-hidden
      role='presentation'
      className='relative flex size-full items-center justify-center overflow-hidden bg-[#292129]'
    >
      <span className='absolute size-16 -translate-x-5 rotate-[-17deg] rounded-md border border-[#8e759c] bg-[#46384c]' />
      <span className='absolute size-16 translate-x-5 rotate-[17deg] rounded-md border border-[#a0713d] bg-[#674526]' />
      <span className='relative grid size-16 place-items-center rounded-md border border-[#ebbe82] bg-[#e5b46d] font-serif text-4xl text-[#4d2f1b] transition-transform group-hover:-translate-y-1'>
        ♦
      </span>
    </div>
  );
}

/** Werewolf: a wolf's head against the moon. */
function Werewolf() {
  return (
    <Frame>
      <rect width='160' height='100' fill='#120f26' />
      <circle cx='112' cy='34' r='22' fill='#f4efd2' />
      <circle cx='104' cy='28' r='22' fill='#120f26' />
      <g className={move('group-hover:-translate-y-1')}>
        <path
          d='M48 70 L54 40 L64 52 L84 52 L94 40 L100 70 C100 84 88 92 74 92 C60 92 48 84 48 70Z'
          fill='#2a2740'
          stroke='#d4584f'
          strokeWidth='2.5'
          strokeLinejoin='round'
        />
        <path
          d='M62 68 L68 66 M86 68 L80 66'
          stroke='#ffd36b'
          strokeWidth='3'
          strokeLinecap='round'
        />
        <path
          d='M68 80 L74 84 L80 80 M74 84 V74'
          stroke='#d4584f'
          strokeWidth='2.5'
          strokeLinecap='round'
          fill='none'
        />
      </g>
      <path
        d='M0 90 C30 82 60 96 90 88 C120 80 140 94 160 86 V100 H0Z'
        fill='#ffffff'
        opacity='0.07'
      />
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

function Fm() {
  const dots: [number, number, string][] = [
    [34, 50, GOLD],
    [54, 28, GREEN],
    [54, 43, GREEN],
    [54, 57, GREEN],
    [54, 72, GREEN],
    [80, 34, BLUE],
    [80, 50, BLUE],
    [80, 66, BLUE],
    [110, 32, RED],
    [116, 50, RED],
    [110, 68, RED],
  ];
  return (
    <Frame>
      <rect
        x='18'
        y='12'
        width='124'
        height='76'
        rx='5'
        fill='#12241b'
        stroke={GREEN}
        strokeWidth='1.5'
      />
      <line
        x1='80'
        y1='12'
        x2='80'
        y2='88'
        stroke={GREEN}
        strokeOpacity='0.4'
      />
      <circle
        cx='80'
        cy='50'
        r='13'
        fill='none'
        stroke={GREEN}
        strokeOpacity='0.4'
      />
      <rect
        x='18'
        y='32'
        width='14'
        height='36'
        fill='none'
        stroke={GREEN}
        strokeOpacity='0.4'
      />
      <rect
        x='128'
        y='32'
        width='14'
        height='36'
        fill='none'
        stroke={GREEN}
        strokeOpacity='0.4'
      />
      <g className={move('group-hover:translate-x-1')}>
        {dots.map(([x, y, fill], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r='3.6'
            fill={fill}
            stroke='#0e1015'
            strokeWidth='1'
          />
        ))}
      </g>
    </Frame>
  );
}

function Karambol() {
  return (
    <Frame>
      <rect
        x='34'
        y='10'
        width='92'
        height='80'
        rx='8'
        fill='#2a2018'
        stroke='#5a4230'
        strokeWidth='2'
      />
      <rect x='41' y='17' width='78' height='66' rx='4' fill='#c8a97e' />
      <circle cx='46' cy='22' r='4.5' fill='#0e1015' />
      <circle cx='114' cy='22' r='4.5' fill='#0e1015' />
      <circle cx='46' cy='78' r='4.5' fill='#0e1015' />
      <circle cx='114' cy='78' r='4.5' fill='#0e1015' />
      <circle
        cx='80'
        cy='48'
        r='13'
        fill='none'
        stroke='#7a4e32'
        strokeWidth='1'
        opacity='0.6'
      />
      <circle cx='80' cy='48' r='4' fill={RED} />
      <circle cx='71' cy='44' r='3.6' fill={INK} />
      <circle cx='89' cy='44' r='3.6' fill='#1c1e24' />
      <circle cx='74' cy='55' r='3.6' fill='#1c1e24' />
      <circle cx='86' cy='55' r='3.6' fill={INK} />
      <g className={move('group-hover:-translate-y-2')}>
        <circle
          cx='80'
          cy='73'
          r='5'
          fill={GOLD}
          stroke='#5a4230'
          strokeWidth='1.2'
        />
      </g>
    </Frame>
  );
}

function Doom() {
  return (
    <Frame>
      <rect width='160' height='56' fill='#280c0f' />
      <rect y='56' width='160' height='44' fill='#1a1417' />
      {/* Mars horizon glow */}
      <circle cx='80' cy='46' r='22' fill={RED} opacity='0.22' />
      {/* Imp silhouette */}
      <g className={move('group-hover:scale-110')}>
        <circle cx='80' cy='40' r='11' fill='#8f242e' />
        <polygon points='70,34 65,24 75,30' fill='#d99b66' />
        <polygon points='90,34 95,24 85,30' fill='#d99b66' />
        <circle cx='76' cy='39' r='1.8' fill={GOLD} />
        <circle cx='84' cy='39' r='1.8' fill={GOLD} />
      </g>
      {/* Shotgun barrel at bottom */}
      <rect x='72' y='62' width='7' height='34' rx='1' fill='#454b57' />
      <rect x='81' y='62' width='7' height='34' rx='1' fill='#353a44' />
      <rect x='71' y='88' width='18' height='12' rx='2' fill='#5c3d28' />
    </Frame>
  );
}

function Doom2() {
  return (
    <Frame>
      <rect width='160' height='56' fill='#2a1109' />
      <rect y='56' width='160' height='44' fill='#181412' />
      <polygon points='30,56 50,24 72,56' fill='#3d1d12' />
      <polygon points='92,56 116,18 140,56' fill='#4a2315' />
      <g className={move('group-hover:-translate-y-1')}>
        <rect x='69' y='56' width='9' height='40' rx='1' fill='#4c5361' />
        <rect x='82' y='56' width='9' height='40' rx='1' fill='#3a404c' />
        <rect x='67' y='86' width='26' height='14' rx='2' fill='#634028' />
      </g>
    </Frame>
  );
}

function Wolf3d() {
  return (
    <Frame>
      <rect width='160' height='52' fill='#1c212b' />
      <rect y='52' width='160' height='48' fill='#2b2e36' />
      {/* Stone castle walls */}
      <rect
        x='14'
        y='18'
        width='34'
        height='64'
        fill='#3f495c'
        stroke='#262d3a'
      />
      <rect
        x='112'
        y='18'
        width='34'
        height='64'
        fill='#3f495c'
        stroke='#262d3a'
      />
      {/* Gold treasure & classic pistol */}
      <g className={move('group-hover:scale-105')}>
        <polygon points='72,56 88,56 92,66 68,66' fill={GOLD} />
        <rect x='76' y='72' width='8' height='24' rx='1' fill='#525a69' />
      </g>
    </Frame>
  );
}

function Gelud() {
  return (
    <Frame>
      <rect width='160' height='68' fill='#151624' />
      <rect y='68' width='160' height='32' fill='#242535' />
      {/* Health bars */}
      <rect x='14' y='10' width='52' height='5' rx='2' fill={BLUE} />
      <rect x='94' y='10' width='52' height='5' rx='2' fill={RED} />
      {/* P1 (Blue) */}
      <g className={move('group-hover:translate-x-2')}>
        <rect x='40' y='44' width='14' height='24' rx='2' fill={BLUE} />
        <circle cx='47' cy='36' r='7' fill='#f1c7a4' />
        <rect x='40' y='31' width='14' height='3' fill={GOLD} />
        <rect x='52' y='48' width='16' height='5' rx='2' fill='#f1c7a4' />
      </g>
      {/* Impact spark */}
      <circle cx='80' cy='50' r='5' fill={GOLD} opacity='0.85' />
      {/* P2 (Red) */}
      <g className={move('group-hover:-translate-x-2')}>
        <rect x='106' y='44' width='14' height='24' rx='2' fill={RED} />
        <circle cx='113' cy='36' r='7' fill='#f1c7a4' />
        <rect x='106' y='31' width='14' height='3' fill={INK} />
        <rect x='92' y='48' width='16' height='5' rx='2' fill='#f1c7a4' />
      </g>
    </Frame>
  );
}

const ART: Record<string, () => React.JSX.Element> = {
  wordle: Wordle,
  snake: Snake,
  'snake-daily': SnakeDaily,
  'snake-duel': SnakeDuel,
  '2048': Game2048,
  minesweeper: Minesweeper,
  tetris: Tetris,
  doom: Doom,
  doom2: Doom2,
  wolf3d: Wolf3d,
  gelud: Gelud,
  connect4: Connect4,
  suit: Suit,
  karambol: Karambol,
  uno: Uno,
  sekata: Sekata,
  mahjong: Mahjong,
  'mahjong-hk': Mahjong,
  dart: Dart,
  remo: Remo,
  poker: Poker,
  'card-archive': CardArchive,
  werewolf: Werewolf,
  monkeys: Monkeys,
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
  fm: Fm,
};

/** The menu drawing for a game id; the parent needs the `group` class for hover motion. */
export default function GameArt({ id }: { id: string }) {
  const Art = ART[id];
  return Art ? <Art /> : null;
}
