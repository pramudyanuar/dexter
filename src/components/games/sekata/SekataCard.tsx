import * as React from 'react';

import type { SCard } from '@/lib/games/sekata-cards';

const FACE: Record<SCard['kind'], string> = {
  pink: 'bg-[#f8b8cd] border-[#e88aab] text-[#3a1f2b]',
  yellow: 'bg-[#f7dc6a] border-[#e0b92f] text-[#3b3110]',
  green: 'bg-[#a6dc86] border-[#6db551] text-[#1d3315]',
  blank: 'bg-[#fbf7ee] border-[#cfc7b4] text-[#3a352b]',
};

const SIZE = {
  md: 'h-24 w-[4.25rem] rounded-xl text-[1.7rem]',
  sm: 'h-[4.5rem] w-[3.25rem] rounded-lg text-xl',
  xs: 'h-8 min-w-8 rounded-md px-1.5 text-sm',
} as const;

const TAG: Record<SCard['kind'], string> = {
  pink: '',
  yellow: 'bersama',
  green: 'joker',
  blank: 'kosong',
};

/**
 * One Sekata card: a big syllable on a rounded, slightly raised face. Pink
 * cards are everyone's building blocks, yellow ones are shared, green ones are
 * your own jokers.
 */
export default function SekataCard({
  card,
  text,
  size = 'md',
  selected,
  order,
  dim,
  onClick,
  draggable,
  onDragStart,
  className = '',
  children,
}: {
  card: Pick<SCard, 'kind' | 'text'> & { id?: string };
  /** What to show instead of the card's own text (a joker's chosen syllable) */
  text?: string;
  size?: keyof typeof SIZE;
  selected?: boolean;
  /** Place in the word being built (1 = first) */
  order?: number;
  dim?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const label = (text ?? card.text).toUpperCase();
  const Tag = onClick ? 'button' : 'div';
  const joker = card.kind === 'green' || card.kind === 'blank';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      data-card={card.id}
      data-kind={card.kind}
      aria-pressed={onClick ? !!selected : undefined}
      aria-label={
        joker ? `Kartu joker${label ? ` ${label}` : ''}` : `Kartu ${label}`
      }
      className={`relative flex shrink-0 flex-col items-center justify-center border-2 font-black tracking-tight shadow-[0_3px_0_rgb(0_0_0/0.18),0_8px_14px_-6px_rgb(0_0_0/0.35)] transition-[transform,box-shadow,opacity,filter] duration-150 select-none ${
        FACE[card.kind]
      } ${SIZE[size]} ${
        onClick
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_5px_0_rgb(0_0_0/0.18),0_12px_18px_-6px_rgb(0_0_0/0.4)] active:translate-y-0 active:scale-95'
          : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
        selected ? '-translate-y-2 ring-4 ring-[#3a1f2b]/70' : ''
      } ${dim ? 'opacity-40 saturate-50' : ''} ${className}`}
    >
      {size !== 'xs' && TAG[card.kind] && (
        <span className='absolute top-1 text-[8px] font-bold tracking-widest uppercase opacity-60'>
          {TAG[card.kind]}
        </span>
      )}
      <span className={joker && !label ? 'text-lg opacity-60' : ''}>
        {label || (joker ? '★' : '')}
      </span>
      {order !== undefined && (
        <span className='absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[#3a1f2b] text-[11px] font-bold text-white'>
          {order}
        </span>
      )}
      {children}
    </Tag>
  );
}
