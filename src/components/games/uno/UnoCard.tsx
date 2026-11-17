'use client';

import * as React from 'react';

import { Card, Color, DARK_COLORS } from '@/lib/games/uno';

export const BG: Record<Card['c'], string> = {
  R: 'hsl(2 78% 52%)',
  Y: 'hsl(46 96% 52%)',
  G: 'hsl(138 58% 40%)',
  B: 'hsl(215 80% 52%)',
  P: 'hsl(325 80% 58%)',
  T: 'hsl(176 72% 36%)',
  O: 'hsl(24 94% 54%)',
  U: 'hsl(268 60% 54%)',
  W: 'hsl(240 4% 16%)',
};
export const DARK: Record<Card['c'], string> = {
  R: 'hsl(2 75% 34%)',
  Y: 'hsl(38 92% 38%)',
  G: 'hsl(138 58% 24%)',
  B: 'hsl(215 78% 34%)',
  P: 'hsl(325 72% 36%)',
  T: 'hsl(176 72% 20%)',
  O: 'hsl(24 88% 34%)',
  U: 'hsl(268 58% 30%)',
  W: 'hsl(240 6% 5%)',
};
export const SYMBOL: Record<string, string> = {
  S: '⊘',
  V: '⇄',
  D: '+2',
  W: 'W',
  F: '+4',
  L: '⟲',
  D1: '+1',
  D5: '+5',
  SE: '⊘',
  WD2: '+2',
  WDC: '+C',
  D4: '+4',
  DA: 'ALL',
  WR4: '+4',
  W6: '+6',
  W10: '+10',
  WRL: '?',
};
export const COLOR_NAME: Record<Color, string> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'pink',
  T: 'teal',
  O: 'orange',
  U: 'purple',
};

/**
 * Every colour has its own shape, so cards can be told apart without relying on
 * colour: circle for red, square for blue, star for yellow, triangle for green.
 */
const SHAPE_PATH: Record<Color, React.ReactNode> = {
  R: <circle cx='12' cy='12' r='8.5' />,
  B: <rect x='4' y='4' width='16' height='16' rx='2' />,
  Y: (
    <path d='M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.2 1.3-6.6L2.5 9.4l6.6-.8z' />
  ),
  G: <path d='M12 3.5L21.5 20.5h-19z' strokeLinejoin='round' />,
  P: <path d='M12 2.5l9 9.5-9 9.5-9-9.5z' strokeLinejoin='round' />,
  T: <path d='M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z' strokeLinejoin='round' />,
  O: <path d='M12 2.8l9 6.6-3.4 10.6H6.4L3 9.4z' strokeLinejoin='round' />,
  U: (
    <path d='M12 20.5S3 14.8 3 8.6a4.6 4.6 0 0 1 9-1.2 4.6 4.6 0 0 1 9 1.2c0 6.200-9 11.900-9 11.900z' />
  ),
};

export function ColorShape({
  color,
  className = 'size-4',
  fill = '#fff',
  stroke = 'rgb(0 0 0 / 0.75)',
  style,
}: {
  color: Color;
  className?: string;
  fill?: string;
  stroke?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox='0 0 24 24'
      className={className}
      style={style}
      fill={fill}
      stroke={stroke}
      strokeWidth='1.8'
      aria-hidden
    >
      {SHAPE_PATH[color]}
    </svg>
  );
}

const wheel = (colors: Card['c'][]) =>
  `conic-gradient(from 45deg, ${colors
    .map((c, i) => `${BG[c]} ${i * 25}% ${(i + 1) * 25}%`)
    .join(', ')})`;
const WILD_LIGHT = wheel(['R', 'Y', 'G', 'B']);
const WILD_DARK = wheel(['P', 'O', 'T', 'U']);

export type Side = 'light' | 'dark';

/** Which side of a Flip deck is showing (always light in the other games). */
export const SideContext = React.createContext<Side>('light');

export const face = (card: Card) => SYMBOL[card.v] ?? card.v;
export const describe = (card: Card) =>
  card.c === 'W'
    ? card.v === 'F'
      ? 'wild +4'
      : card.v === 'W'
        ? 'wild'
        : `wild ${face(card)}`
    : `${COLOR_NAME[card.c]} ${face(card)}`;

/** Card-face symbol, drawn as SVG so it stays crisp at any size. */
function Glyph({ v, size }: { v: string; size: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: {
      width: size,
      height: size,
      filter: 'drop-shadow(0.05em 0.07em 0 rgb(0 0 0 / 0.8))',
    },
    'aria-hidden': true,
  };
  if (v === 'S') {
    return (
      <svg {...common}>
        <circle cx='12' cy='12' r='8' />
        <path d='M6.5 17.5l11-11' />
      </svg>
    );
  }
  if (v === 'SE') {
    return (
      <svg {...common}>
        <circle cx='12' cy='12' r='9' />
        <path d='M5.5 18.5l13-13M9 20l11-11' />
      </svg>
    );
  }
  if (v === 'L') {
    return (
      <svg {...common} strokeWidth={2.8}>
        <path d='M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4' />
      </svg>
    );
  }
  if (v === 'V') {
    return (
      <svg {...common} strokeWidth={2.8}>
        <path d='M4 9h14M14 5l4 4-4 4' />
        <path d='M20 15H6M10 11l-4 4 4 4' />
      </svg>
    );
  }
  return null;
}

const DRAWN = new Set(['S', 'SE', 'L', 'V']);

/**
 * One card. Everything inside is sized in `em`, and one `em` is a tenth of the
 * card's width, so the same card works from a thumbnail to the top of the pile:
 * give it a width with `w` (any CSS length) and the rest follows.
 */
export function UnoCard({
  card,
  w = 'var(--card-hand, 3.5rem)',
  side,
  mini,
  playable,
  dim,
  onClick,
  animate,
  delay,
  className = '',
  style,
}: {
  card: Card;
  /** The card's width; its height and every detail scale with it */
  w?: string;
  /** Which face of a Flip deck this is; told from the colour when left out */
  side?: Side;
  /** A thumbnail: just the colour and the value, no corners */
  mini?: boolean;
  playable?: boolean;
  dim?: boolean;
  onClick?: () => void;
  animate?: 'deal' | 'draw' | 'flip' | 'swap';
  /** ms to wait before the entry animation starts */
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Tag = onClick ? 'button' : 'div';
  const tableSide = React.useContext(SideContext);
  const wild = card.c === 'W';
  const dark =
    (side ??
      (wild
        ? tableSide
        : DARK_COLORS.includes(card.c as Color)
          ? 'dark'
          : 'light')) === 'dark';
  const text = face(card);
  const drawn = DRAWN.has(card.v);
  const digit = /^[0-9]$/.test(card.v);
  const center = wild && card.v === 'W' ? 'WILD' : text;
  const centerSize = digit
    ? 6.4
    : center.length >= 4
      ? 2.5
      : center.length === 3
        ? 3.2
        : 4.4;
  const ink = wild ? '#fff' : BG[card.c];
  const shadow = wild ? 'rgb(0 0 0 / 0.9)' : 'rgb(0 0 0 / 0.82)';
  const corner = (
    <span
      className='flex flex-col items-center gap-[0.25em] leading-none'
      style={{ textShadow: '0.07em 0.09em 0 rgb(0 0 0 / 0.75)' }}
    >
      {drawn ? (
        <Glyph v={card.v} size='1.7em' />
      ) : (
        <span style={{ fontSize: text.length >= 3 ? '1.15em' : '1.6em' }}>
          {text}
        </span>
      )}
      {!wild && (
        <ColorShape
          color={card.c as Color}
          className=''
          style={{ width: '1.05em', height: '1.05em' }}
        />
      )}
    </span>
  );

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-card={`${card.c}${card.v}`}
      data-face={dark ? 'dark' : 'light'}
      data-playable={playable ? 'true' : undefined}
      aria-label={describe(card)}
      style={
        {
          '--w': w,
          animationDelay: delay ? `${delay}ms` : undefined,
          ...style,
        } as React.CSSProperties
      }
      className={`uno-card ${dark ? 'uno-card-dark' : ''} ${
        animate === 'deal'
          ? 'a-deal'
          : animate === 'draw'
            ? 'a-draw-in'
            : animate === 'flip'
              ? 'a-cardflip'
              : animate === 'swap'
                ? 'a-swap-in'
                : ''
      } ${playable ? 'uno-card-live' : ''} ${dim ? 'uno-card-dim' : ''} ${className}`}
    >
      <span
        aria-hidden
        className='uno-card-face'
        style={{
          background: wild
            ? `linear-gradient(160deg, hsl(240 5% 24%), ${BG.W} 45%, ${DARK.W})`
            : `linear-gradient(160deg, color-mix(in oklab, ${BG[card.c]} 78%, white), ${BG[card.c]} 42%, ${DARK[card.c]} 135%)`,
          color: '#fff',
        }}
      >
        {/* the tilted oval of a real card: white, or the colour wheel on a wild */}
        <span
          className='uno-card-oval'
          style={{
            background: wild
              ? dark
                ? WILD_DARK
                : WILD_LIGHT
              : 'radial-gradient(ellipse at 32% 26%, #fff 0%, #f4f2ec 55%, #dedbd2 100%)',
          }}
        />
        <span
          className='relative flex items-center justify-center font-black italic'
          style={{
            color: ink,
            fontSize: `${mini ? centerSize * 1.12 : centerSize}em`,
            lineHeight: 1,
            letterSpacing: center.length >= 3 ? '-0.04em' : undefined,
            textShadow: `0.045em 0.06em 0 ${shadow}`,
          }}
        >
          {drawn ? (
            <Glyph v={card.v} size={mini ? '1.3em' : '1.15em'} />
          ) : (
            center
          )}
        </span>
        {!mini && (
          <>
            <span className='absolute top-[0.55em] left-[0.6em] font-black italic'>
              {corner}
            </span>
            <span className='absolute right-[0.6em] bottom-[0.55em] rotate-180 font-black italic'>
              {corner}
            </span>
          </>
        )}
        <span className='uno-card-gloss' />
        <span className='uno-card-sheen' />
      </span>
    </Tag>
  );
}

/** Face-down card: the draw pile, and other players' hands. */
export function CardBack({
  w = 'var(--card-hand, 3.5rem)',
  className = '',
  style,
}: {
  w?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{ '--w': w, ...style } as React.CSSProperties}
      className={`uno-card ${className}`}
    >
      <span
        className='uno-card-face'
        style={{
          background: `linear-gradient(160deg, hsl(240 5% 22%), ${BG.W} 45%, ${DARK.W})`,
        }}
      >
        <span
          className='uno-card-oval'
          style={{
            background: `linear-gradient(160deg, hsl(4 86% 60%), ${BG.R} 50%, ${DARK.R})`,
          }}
        />
        <span
          className='relative -rotate-[18deg] font-black italic'
          style={{
            fontSize: '2.9em',
            lineHeight: 1,
            color: 'hsl(48 100% 58%)',
            textShadow: '0.05em 0.07em 0 rgb(0 0 0 / 0.85)',
          }}
        >
          UNO
        </span>
        <span className='uno-card-gloss' />
      </span>
    </span>
  );
}
