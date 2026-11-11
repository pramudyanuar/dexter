import * as React from 'react';

import { parse, RANK_LABEL, SUIT_GLYPH } from '@/lib/games/remo-cards';

const SIZE = {
  lg: 'h-28 w-20 rounded-xl text-xl',
  md: 'h-24 w-[4.2rem] rounded-xl text-lg',
  sm: 'h-[4.4rem] w-[3.1rem] rounded-lg text-sm',
  xs: 'h-9 w-7 rounded-md text-[11px]',
} as const;

const CENTER = {
  lg: 'text-5xl',
  md: 'text-4xl',
  sm: 'text-3xl',
  xs: 'text-base',
} as const;

export type CardSize = keyof typeof SIZE;

/**
 * A playing card: ivory, rounded, with the rank and suit in two corners and a
 * big suit in the middle. A joker shows a star, and what it stands for when it
 * has been placed in a combination.
 */
export default function PlayingCard({
  id,
  as,
  size = 'md',
  selected,
  hint,
  dim,
  onClick,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  className = '',
  style,
}: {
  id: string;
  /** What a joker stands for, shown on it */
  as?: { rank: number; suit: 'S' | 'H' | 'D' | 'C' };
  size?: CardSize;
  selected?: boolean;
  /** A ring that says "this one" (a card you could take, a card that fits) */
  hint?: boolean;
  dim?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = parse(id);
  const joker = c.suit === null;
  const shown = joker && as ? as : null;
  const suit = c.suit ?? shown?.suit ?? null;
  const red = suit === 'H' || suit === 'D';
  const Tag = onClick ? 'button' : 'div';
  const name = joker
    ? shown
      ? `Joker as ${RANK_LABEL[shown.rank]} ${SUIT_GLYPH[shown.suit]}`
      : 'Joker'
    : `${RANK_LABEL[c.rank]} ${SUIT_GLYPH[c.suit!]}`;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      data-card={id}
      aria-label={name}
      aria-pressed={onClick ? !!selected : undefined}
      style={style}
      className={`relative flex shrink-0 flex-col items-center justify-center border border-[#cfc6ad] bg-gradient-to-br from-[#fffdf5] to-[#f1ead6] font-black shadow-[0_2px_0_rgb(0_0_0/0.18),0_8px_14px_-6px_rgb(0_0_0/0.5)] transition-[transform,box-shadow,opacity] duration-150 select-none ${
        SIZE[size]
      } ${red ? 'text-[#c0262d]' : 'text-[#1b1d22]'} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_4px_0_rgb(0_0_0/0.18),0_12px_18px_-6px_rgb(0_0_0/0.55)] active:scale-95'
          : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        selected ? '-translate-y-3 ring-4 ring-[#d9b45a]' : ''
      } ${hint ? 'ring-2 ring-[#d9b45a]/80' : ''} ${dim ? 'opacity-45' : ''} ${className}`}
    >
      {joker && !shown ? (
        <>
          <span className='absolute top-1 left-1.5 text-[0.6em] tracking-tight text-[#6b3fa0] uppercase'>
            Jkr
          </span>
          <span className={`${CENTER[size]} text-[#6b3fa0]`}>★</span>
        </>
      ) : (
        <>
          <span className='absolute top-1 left-1.5 flex flex-col items-center leading-[1.05]'>
            <span>{RANK_LABEL[shown?.rank ?? c.rank]}</span>
            <span className='text-[0.9em]'>{SUIT_GLYPH[suit!]}</span>
          </span>
          <span className={CENTER[size]}>{SUIT_GLYPH[suit!]}</span>
          {joker && (
            <span className='absolute right-1 bottom-0.5 text-[0.7em] text-[#6b3fa0]'>
              ★
            </span>
          )}
          {size !== 'xs' && !joker && (
            <span className='absolute right-1.5 bottom-1 flex rotate-180 flex-col items-center leading-[1.05]'>
              <span>{RANK_LABEL[c.rank]}</span>
              <span className='text-[0.9em]'>{SUIT_GLYPH[c.suit!]}</span>
            </span>
          )}
        </>
      )}
    </Tag>
  );
}

/** The back of a card: the draw pile, and other players' hands. */
export function CardBack({
  size = 'md',
  className = '',
  style,
}: {
  size?: CardSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={`relative flex shrink-0 items-center justify-center border-2 border-[#f4ecd0] bg-[#14573e] shadow-[0_2px_0_rgb(0_0_0/0.25),0_6px_10px_-4px_rgb(0_0_0/0.6)] ${SIZE[size]} ${className}`}
    >
      <span className='absolute inset-1 rounded-[inherit] border border-[#d9b45a]/70 bg-[repeating-linear-gradient(45deg,#1b6b4c_0_4px,#14573e_4px_8px)]' />
      <span className='relative text-[#d9b45a] opacity-90'>♠</span>
    </span>
  );
}
