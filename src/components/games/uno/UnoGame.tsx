'use client';

import * as React from 'react';

import {
  Card,
  COLORS,
  DARK_COLORS,
  EMOTES,
  stackable,
  UnoView,
} from '@/lib/games/uno';
import { UNO_MERCY_LIMIT, UNO_PLAYERS } from '@/lib/games/uno-rules';
import type { UnoXView } from '@/lib/games/unox';
import type { GameId } from '@/lib/rooms/types';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import { LangProvider, seatName as seatNameFor } from '@/components/games/lang';
import PlayersPanel from '@/components/games/PlayersPanel';
import RoomBar from '@/components/games/RoomBar';
import RoomChat from '@/components/games/RoomChat';
import { Removed, WaitingRoom } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';
import RoomNotice from '@/components/games/RoomNotice';
import {
  BG,
  CardBack,
  COLOR_NAME,
  ColorShape,
  describe,
  face,
  Side,
  SideContext,
  UnoCard,
} from '@/components/games/uno/UnoCard';
import {
  Avatar,
  CountUp,
  EmoteBubble,
  seatColor,
} from '@/components/games/uno/UnoFx';
import UnoGuide from '@/components/games/uno/UnoGuide';
import useUnoSfx, { UnoSound } from '@/components/games/uno/useUnoSfx';

const ORDINAL = ['1st', '2nd', '3rd'];
const placeText = (place: number) =>
  `${ORDINAL[place] ?? `${place + 1}th`} place`;
/** "You draw", "Sari draws" */
const verb = (seat: number, you: number, base: string) =>
  seat === you ? base : `${base}s`;
const cardCountText = (count: number) =>
  `${count} ${count === 1 ? 'card' : 'cards'}`;

/** Stable small pseudo-random from a string, so a card stays where it landed. */
const hash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
};
/** A scattered offset and tilt for a card sitting in the discard pile. */
function scatterFor(card: Card, i: number) {
  const h = hash(`${card.c}${card.v}:${i}`);
  return {
    rot: (h % 46) - 23, // -23..22 deg
    x: ((h >> 3) % 22) - 11,
    y: ((h >> 7) % 18) - 9,
  };
}

/**
 * Everyone sits around an oval table. `you` are at the bottom; the others are
 * spread evenly around the rest of the ring in turn order, so it works for two
 * up to eight players. Returns a seat's position as table percentages.
 */
function seatPos(seat: number, you: number, players: number) {
  const rel = (((seat - you) % players) + players) % players;
  const angle = Math.PI / 2 + (2 * Math.PI * rel) / players; // bottom = you
  return {
    left: 50 + 45 * Math.cos(angle),
    top: 50 + 43 * Math.sin(angle),
    angle,
  };
}

type IconKind =
  | 'skip'
  | 'reverse'
  | 'plus2'
  | 'plus4'
  | 'wild'
  | 'caught'
  | 'wrong'
  | 'accept'
  | 'uno'
  | 'catch'
  | 'draw'
  | 'play'
  | 'flip'
  | 'swap';

/** A small line icon for every kind of table event. */
function EventIcon({
  kind,
  className = 'size-5',
}: {
  kind: IconKind;
  className?: string;
}) {
  const line = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const card = (x: number, y: number) => (
    <rect x={x} y={y} width='11' height='15' rx='2' {...line} />
  );
  return (
    <svg viewBox='0 0 24 24' className={className} aria-hidden>
      {kind === 'skip' && (
        <>
          <circle cx='12' cy='12' r='9' {...line} />
          <path d='M5.6 5.6l12.8 12.8' {...line} />
        </>
      )}
      {kind === 'reverse' && (
        <path
          d='M17 3l4 4-4 4M21 7H9a5 5 0 0 0-5 5M7 21l-4-4 4-4M3 17h12a5 5 0 0 0 5-5'
          {...line}
        />
      )}
      {(kind === 'plus2' || kind === 'plus4') && (
        <>
          {card(3, 6)}
          {card(10, 3)}
          <path d='M15.5 8.5v5M13 11h5' {...line} />
        </>
      )}
      {kind === 'wild' && (
        <>
          <path d='M12 12V3a9 9 0 0 1 9 9z' fill='#e0483d' />
          <path d='M12 12h9a9 9 0 0 1-9 9z' fill='#f2c21a' />
          <path d='M12 12v9a9 9 0 0 1-9-9z' fill='#2f9e5a' />
          <path d='M12 12H3a9 9 0 0 1 9-9z' fill='#3b82e0' />
        </>
      )}
      {kind === 'caught' && (
        <>
          <circle cx='12' cy='12' r='9' {...line} />
          <path d='M7.5 12.5l3 3 6-7' {...line} />
        </>
      )}
      {kind === 'wrong' && (
        <>
          <circle cx='12' cy='12' r='9' {...line} />
          <path d='M8.5 8.5l7 7M15.5 8.5l-7 7' {...line} />
        </>
      )}
      {kind === 'accept' && (
        <>
          {card(6.5, 3)}
          <path d='M12 14v6m-3-3l3 3 3-3' {...line} />
        </>
      )}
      {kind === 'uno' && (
        <>
          <circle cx='12' cy='12' r='9' {...line} />
          <path d='M12 7v6.5M12 16.5v.5' {...line} />
        </>
      )}
      {kind === 'catch' && (
        <>
          <circle cx='12' cy='12' r='8' {...line} />
          <circle cx='12' cy='12' r='2.5' {...line} />
          <path d='M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4' {...line} />
        </>
      )}
      {kind === 'draw' && (
        <>
          {card(6.5, 4)}
          <path d='M12 9.5v5M9.5 12h5' {...line} />
        </>
      )}
      {kind === 'flip' && (
        <path
          d='M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4'
          {...line}
        />
      )}
      {kind === 'swap' && (
        <path d='M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4' {...line} />
      )}
      {kind === 'play' && (
        <>
          {card(6.5, 4)}
          <path d='M9 9h6M9 12h3' {...line} />
        </>
      )}
    </svg>
  );
}

/** Which icon goes with the last thing that happened. */
function iconOf(e: NonNullable<UnoView['last']>): IconKind {
  if (e.kind === 'play') {
    if (e.mercy?.length) return 'wrong';
    const v = e.card?.v;
    if (e.flipped) return 'flip';
    if (e.swapped !== undefined) return 'swap';
    if (e.rotated || v === 'V' || v === 'WR4') return 'reverse';
    if (v === 'S' || v === 'SE') return 'skip';
    if (v === 'D' || v === 'D1' || v === 'D5' || v === 'D4' || v === 'WD2')
      return 'plus2';
    if (v === 'F' || v === 'W6' || v === 'W10' || v === 'WDC') return 'plus4';
    if (v === 'W' || v === 'WRL') return 'wild';
    return 'play';
  }
  if (e.kind === 'challenge') return e.caught ? 'caught' : 'wrong';
  if (e.kind === 'pass') return 'skip';
  if (e.kind === 'take') return 'draw';
  return e.kind;
}

function lastText(
  view: UnoView,
  you: number,
  names: (string | null)[],
  mercyLimit: number,
) {
  const e = view.last;
  if (!e) return null;
  const drawn = cardCountText(e.drew?.count ?? 0);
  const who = seatNameFor('en', e.seat, you, names);
  const out = (seat: number) => {
    const place = view.places.indexOf(seat);
    return place !== -1 && view.counts[seat] === 0
      ? ` Out of cards: ${placeText(place)}!`
      : '';
  };
  const extras = () => {
    let t = '';
    if (e.dumped) t += ` ${verb(e.seat, you, 'drop')} ${e.dumped} more.`;
    if (e.flipped) t += ` Now on the ${e.flipped} side.`;
    if (e.swapped !== undefined)
      t += ` ${who} swapped hands with ${seatNameFor('en', e.swapped, you, names)}.`;
    if (e.rotated) t += ' Everyone passed their hand along.';
    if (e.drew && e.kind === 'play') {
      t += ` ${seatNameFor('en', e.drew.seat, you, names)} ${verb(e.drew.seat, you, 'draw')} ${e.drew.count}.`;
    }
    if (e.mercy?.length) {
      t += ` ${e.mercy
        .map((m) => seatNameFor('en', m, you, names))
        .join(
          ', ',
        )} hit ${mercyLimit} cards and ${e.mercy.length > 1 ? 'are' : 'is'} out!`;
    }
    return t;
  };
  if (e.kind === 'take')
    return `${who} ${verb(e.seat, you, 'take')} ${drawn}.${extras()}`;
  if (e.kind === 'play' && e.card && e.cards) {
    const colors = e.cards
      .map((c) => (c.c === 'W' ? '' : COLOR_NAME[c.c]))
      .join(', ');
    return `${who} stacked ${e.cards.length} cards of ${face(e.card)} (${colors}).${out(e.seat)}`;
  }
  if (e.kind === 'play' && e.card) {
    return `${who} ${verb(e.seat, you, 'play')} ${describe(e.card)}${e.color ? `, color ${COLOR_NAME[e.color]}` : ''}.${extras()}${out(e.seat)}`;
  }
  if (e.kind === 'draw') {
    const pass = e.passed ? ` and ${verb(e.seat, you, 'pass')}` : '';
    return `${who} ${verb(e.seat, you, 'draw')} ${drawn}${pass}.${extras()}`;
  }
  if (e.kind === 'uno') return `${who} ${verb(e.seat, you, 'call')} UNO!`;
  if (e.kind === 'accept')
    return `${who} ${verb(e.seat, you, 'accept')} the +4 and ${verb(e.seat, you, 'draw')} ${drawn}.`;
  const target = seatNameFor('en', e.target ?? 0, you, names);
  if (e.kind === 'challenge') {
    return e.caught
      ? `${who} ${verb(e.seat, you, 'challenge')} ${target} and ${e.seat === you ? 'were' : 'was'} right! ${target} ${verb(e.target ?? 0, you, 'draw')} ${drawn}.`
      : `${who} ${verb(e.seat, you, 'challenge')} ${target} but ${e.seat === you ? 'were' : 'was'} wrong and ${verb(e.seat, you, 'draw')} ${drawn}.`;
  }
  if (e.kind === 'catch') {
    return `${who} ${verb(e.seat, you, 'catch')} ${target} forgetting UNO. ${target} ${verb(e.target ?? 0, you, 'draw')} ${drawn}.`;
  }
  return `${who} ${verb(e.seat, you, 'skip')}.`;
}
/** Where a seat is, measured from the middle of the table (for flying cards). */
const fromCenter = (p: { left: number; top: number }) => ({
  x: `calc(${(p.left - 50).toFixed(1)} * 1cqw)`,
  y: `calc(${(p.top - 50).toFixed(1)} * 1cqh)`,
});
/** A seat's spot on the table, kept clear of the edges on a narrow screen. */
const seatStyle = (p: { left: number; top: number }): React.CSSProperties => ({
  left: `clamp(calc(var(--mini-w) * 2.4), ${p.left.toFixed(1)}%, calc(100% - var(--mini-w) * 2.4))`,
  top: `clamp(calc(var(--mini-w) * 2.2), ${p.top.toFixed(1)}%, calc(100% - var(--mini-w) * 2.2))`,
});

/**
 * Cards always move one at a time, so everyone can follow a stack going down
 * or a long draw: this is the beat between two cards. A long run speeds up, so
 * it never takes more than a few seconds.
 */
const TOSS_STEP = 240;
const DEAL_MAX = 14;
const dealStep = (count: number) =>
  Math.round(Math.min(280, 3400 / Math.max(1, Math.min(count, DEAL_MAX))));
/** How many cards the last play put on the pile (a stack, or a Discard All). */
const playedCount = (e: UnoView['last']) =>
  e?.kind === 'play' ? (e.cards?.length ?? 1 + (e.dumped ?? 0)) : 0;

type DragState = 'idle' | 'drag' | 'over';

/** A hand card you can click, or drag onto the discard pile. */
function HandCard({
  card,
  index,
  id,
  back,
  playable,
  dim,
  animate,
  delay,
  fan,
  drop,
  gap,
  dropRef,
  onPlay,
  onDrop,
  onDrag,
  order,
}: {
  card: Card;
  /** Where the card is in the hand, and a name that stays with it as the hand changes */
  index: number;
  id: string;
  /** Flip: the other face, shown instead while the hand is turned over */
  back?: { card: Card; side: Side };
  playable: boolean;
  dim: boolean;
  /** Played by dropping on the pile; defaults to onPlay */
  onDrop?: () => void;
  /** Position in a stack being built (1 = first), if selected */
  order?: number;
  animate?: 'deal' | 'draw' | 'flip' | 'swap';
  delay?: number;
  /** Tilt, and how far the card sits down the curve of the fan */
  fan: number;
  drop: number;
  /** Distance to the card before it (negative: they overlap) */
  gap?: number;
  dropRef: React.RefObject<HTMLDivElement | null>;
  onPlay: () => void;
  onDrag: (state: DragState) => void;
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [settling, setSettling] = React.useState(false);
  const origin = React.useRef<{ x: number; y: number } | null>(null);
  const moved = React.useRef(false);
  const handled = React.useRef(false);
  const slot = React.useRef<HTMLDivElement>(null);

  // a drawn card comes from the draw pile itself, wherever that is on screen
  React.useLayoutEffect(() => {
    const el = slot.current;
    const pile = document.querySelector('[data-draw-pile]');
    if (animate !== 'draw' || !el || !pile) return;
    const a = el.getBoundingClientRect();
    const b = pile.getBoundingClientRect();
    el.style.setProperty(
      '--in-x',
      `${b.left + b.width / 2 - (a.left + a.width / 2)}px`,
    );
    el.style.setProperty(
      '--in-y',
      `${b.top + b.height / 2 - (a.top + a.height / 2)}px`,
    );
  }, [animate]);

  /** A playable card leans towards the mouse over it. */
  const lean = (e: React.PointerEvent | null) => {
    const el = slot.current;
    if (!el) return;
    if (!e || !playable || e.pointerType !== 'mouse' || origin.current) {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      return;
    }
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.style.setProperty('--ry', `${(x * 26).toFixed(1)}deg`);
    el.style.setProperty('--rx', `${(-y * 20).toFixed(1)}deg`);
  };

  const isOver = (e: React.PointerEvent) => {
    const rect = dropRef.current?.getBoundingClientRect();
    if (!rect) return false;
    const pad = 36; // forgiving, a finger is not precise
    return (
      e.clientX > rect.left - pad &&
      e.clientX < rect.right + pad &&
      e.clientY > rect.top - pad &&
      e.clientY < rect.bottom + pad
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!playable || e.button > 0) return;
    origin.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    handled.current = false;
    setSettling(false);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const from = origin.current;
    if (!from) return lean(e);
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (!moved.current && Math.hypot(dx, dy) < 8) return;
    moved.current = true;
    setPos({ x: dx, y: dy });
    onDrag(isOver(e) ? 'over' : 'drag');
  };

  const finish = (e: React.PointerEvent, cancel = false) => {
    if (!origin.current) return;
    const dropped = moved.current && !cancel && isOver(e);
    origin.current = null;
    onDrag('idle');
    if (dropped) {
      setPos(null); // the pile plays its own animation for the new top card
      (onDrop ?? onPlay)();
    } else if (moved.current) {
      setSettling(true); // spring back to the hand
      setPos(null);
    } else if (!cancel) {
      // a plain tap. Handled here because pointer capture sends the click
      // to this wrapper rather than the card button underneath.
      handled.current = true;
      onPlay();
    }
  };

  const dragging = pos !== null;

  return (
    <div
      ref={slot}
      data-key={id}
      data-hand-index={index}
      onPointerLeave={() => lean(null)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={(e) => finish(e, true)}
      onClickCapture={(e) => {
        // a drag or a tap was already handled on pointer up: swallow its click
        // (keyboard presses have no pointer events and still click the card)
        if (moved.current || handled.current) {
          moved.current = false;
          handled.current = false;
          e.stopPropagation();
        }
      }}
      className={`uno-hand-slot ${playable ? 'touch-none' : ''}`}
      style={{
        marginLeft: gap,
        zIndex: dragging ? 50 : undefined,
        transform: dragging
          ? `translate(${pos.x}px, ${pos.y}px) rotate(${pos.x * 0.06}deg) scale(1.18)`
          : `translateY(${drop}px) rotate(${fan}deg)`,
        transformOrigin: dragging ? 'center' : undefined,
        transition: dragging
          ? 'none'
          : settling
            ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 0.3s var(--ease)',
        cursor: playable ? (dragging ? 'grabbing' : 'grab') : undefined,
        filter: dragging
          ? 'drop-shadow(0 14px 14px rgb(0 0 0 / 0.35))'
          : undefined,
      }}
    >
      {back ? (
        <UnoCard
          key='back'
          card={back.card}
          side={back.side}
          animate='flip'
          delay={delay}
        />
      ) : (
        <UnoCard
          card={card}
          playable={playable && !dragging}
          dim={dim}
          animate={animate}
          delay={delay}
          onClick={playable ? onPlay : undefined}
        />
      )}
      {order !== undefined && (
        <span
          aria-hidden
          className='pointer-events-none absolute -top-5 left-1/2 z-20 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black shadow'
        >
          {order}
        </span>
      )}
    </div>
  );
}

/**
 * How a hand of `count` cards fits a row `width` wide: cards overlap as much as
 * they have to, and a hand too big for one row is split over two.
 */
export function fitHand(count: number, width: number, card: number) {
  if (!width || !card || count <= 1) return { rows: 1, step: null };
  const loose = card * 0.82;
  const tight = Math.max(20, card * 0.34);
  const stepFor = (n: number) =>
    n <= 1 ? loose : Math.min(loose, (width - card) / (n - 1));
  const rows = stepFor(count) < tight ? 2 : 1;
  return { rows, step: stepFor(Math.ceil(count / rows)) };
}

/** The width of the hand and of a card in it, re-measured when the screen changes. */
function useHandBox(count: number) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState({ width: 0, card: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const card = el.querySelector<HTMLElement>('.uno-card')?.offsetWidth ?? 0;
      const width = el.clientWidth - 20;
      setBox((b) =>
        b.width === width && b.card === card ? b : { width, card },
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);
  return { ref, ...box };
}

/** A face-up thumbnail row (or face-down backs) for a seat at the table. */
function MiniFan({
  count,
  cards,
  side,
  flipAt,
}: {
  count: number;
  /** The faces this viewer can see, if any */
  cards: Card[] | null;
  side?: Side;
  /** Flip: turn the cards over, starting this many ms from now */
  flipAt?: number;
}) {
  const max = cards ? 12 : 7;
  const shown = Math.min(count, max);
  const step = shown > 1 ? Math.min(0.5, 3.3 / (shown - 1)) : 1;
  const spread = shown > 1 ? Math.min(7, 40 / shown) : 0;
  return (
    <div
      aria-hidden
      className='flex items-end justify-center'
      style={{ height: 'calc(var(--mini-w) * 1.6)' }}
    >
      {Array.from({ length: shown }, (_, i) => {
        const style: React.CSSProperties = {
          marginLeft: i ? `calc(var(--mini-w) * ${step - 1})` : undefined,
          rotate: `${(i - (shown - 1) / 2) * spread}deg`,
          transformOrigin: '50% 120%',
        };
        const card = cards?.[i];
        return card ? (
          <UnoCard
            key={i}
            card={card}
            side={side}
            mini
            w='var(--mini-w)'
            animate={flipAt === undefined ? undefined : 'flip'}
            delay={flipAt === undefined ? undefined : flipAt + i * 35}
            style={style}
          />
        ) : (
          <CardBack key={i} w='var(--mini-w)' style={style} />
        );
      })}
    </div>
  );
}

/** A bundle of cards flying from one seat to another when hands change owners. */
function SwapFx({
  moves,
  label,
  sub,
}: {
  moves: {
    from: { left: number; top: number };
    to: { left: number; top: number };
  }[];
  label: string;
  sub: string;
}) {
  return (
    <div
      aria-hidden
      data-testid='swap-fx'
      className='pointer-events-none absolute inset-0 z-40'
    >
      {moves.map(({ from, to }, i) => {
        // swing out sideways from the straight line, so crossing hands pass
        const dx = to.left - from.left;
        const dy = to.top - from.top;
        const len = Math.hypot(dx, dy) || 1;
        const bend = moves.length === 2 ? 14 : 7;
        return (
          <div
            key={i}
            className='a-swap-move absolute -translate-x-1/2 -translate-y-1/2'
            style={
              {
                '--fx': `${from.left}%`,
                '--fy': `${from.top}%`,
                '--tx': `${to.left}%`,
                '--ty': `${to.top}%`,
                animationDelay: `${i * 60}ms`,
              } as React.CSSProperties
            }
          >
            <div
              className='a-swap-arc relative flex'
              style={
                {
                  '--ax': `calc(${((-dy / len) * bend).toFixed(1)} * 1cqmin)`,
                  '--ay': `calc(${((dx / len) * bend).toFixed(1)} * 1cqmin)`,
                  animationDelay: `${i * 60}ms`,
                } as React.CSSProperties
              }
            >
              {[-14, 0, 14].map((tilt, n) => (
                <CardBack
                  key={tilt}
                  w='calc(var(--mini-w) * 1.5)'
                  style={{
                    rotate: `${tilt}deg`,
                    marginLeft: n ? 'calc(var(--mini-w) * -0.9)' : undefined,
                    transformOrigin: '50% 120%',
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className='a-swap-label absolute inset-x-0 top-[14%] flex flex-col items-center gap-1'>
        <span
          className='font-black tracking-tight text-info drop-shadow-[0_4px_0_rgb(0_0_0/0.5)]'
          style={{ fontSize: 'min(11cqw, 13cqh)', lineHeight: 1 }}
        >
          {label}
        </span>
        <span className='rounded-full bg-paper/90 px-3 py-0.5 text-sm font-semibold text-ink'>
          {sub}
        </span>
      </div>
    </div>
  );
}

const MEDAL = {
  1: { from: 'hsl(46 96% 60%)', to: 'hsl(36 90% 38%)', h: '6.5rem' },
  2: { from: 'hsl(215 16% 78%)', to: 'hsl(215 12% 44%)', h: '4.6rem' },
  3: { from: 'hsl(26 62% 58%)', to: 'hsl(22 55% 32%)', h: '3.4rem' },
} as const;

/**
 * The result: the winner under a crown on the top step, 2nd and 3rd beside
 * them, each step rising in turn, and everyone else listed below.
 */
function Podium({
  places,
  you,
  names,
  left,
}: {
  places: number[];
  you: number;
  names: (string | null)[];
  /** Cards each seat was still holding */
  left: number[];
}) {
  // podium order: 2nd on the left, 1st in the middle, 3rd on the right
  const steps: { seat: number; rank: 1 | 2 | 3 }[] = [];
  if (places[1] !== undefined) steps.push({ seat: places[1], rank: 2 });
  if (places[0] !== undefined) steps.push({ seat: places[0], rank: 1 });
  if (places[2] !== undefined) steps.push({ seat: places[2], rank: 3 });
  const mine = places.indexOf(you);
  const name = (seat: number) => seatNameFor('en', seat, you, names);

  return (
    <div data-testid='podium'>
      <p className='text-center text-[11px] font-bold tracking-[0.25em] text-mute uppercase'>
        Game over
      </p>
      <h2 className='mt-1 mb-4 text-center text-2xl font-black tracking-tight'>
        {mine === 0 ? (
          <span className='text-[hsl(46_96%_60%)]'>You win!</span>
        ) : (
          <>
            <span className='text-[hsl(46_96%_60%)]'>{name(places[0])}</span>{' '}
            wins
          </>
        )}
      </h2>
      <div className='flex items-end justify-center gap-2'>
        {steps.map(({ seat, rank }) => {
          const medal = MEDAL[rank];
          // the steps come up 3rd, 2nd, then the winner
          const wait = 1.5 + (3 - rank) * 0.25;
          return (
            <div
              key={seat}
              className='flex w-[30%] max-w-28 flex-col items-center'
            >
              <div
                className='a-pop flex flex-col items-center'
                style={{ animationDelay: `${wait + 0.35}s` }}
              >
                {rank === 1 && (
                  <svg
                    viewBox='0 0 24 16'
                    className='a-bob mb-0.5 w-8 drop-shadow-[0_0_8px_hsl(46_96%_60%/0.7)]'
                    fill='hsl(46 96% 58%)'
                    aria-hidden
                  >
                    <path d='M2 15h20l1.5-11-6 4.5L12 1 6.500 8.500l-6-4.500z' />
                  </svg>
                )}
                <span
                  className={`flex items-center justify-center rounded-full font-black text-white uppercase ring-2 ${
                    rank === 1 ? 'size-14 text-2xl' : 'size-10 text-base'
                  }`}
                  style={
                    {
                      background: seatColor(seat),
                      '--tw-ring-color': medal.from,
                      boxShadow:
                        rank === 1 ? `0 0 24px ${medal.from}` : undefined,
                    } as React.CSSProperties
                  }
                >
                  {name(seat).trim().charAt(0)}
                </span>
                <span
                  className={`mt-1 max-w-full truncate text-xs ${
                    seat === you ? 'font-bold text-accent' : 'text-ink'
                  }`}
                >
                  {name(seat)}
                </span>
                <span className='mb-1 text-[10px] text-mute'>
                  {left[seat] > 0
                    ? `${left[seat]} ${left[seat] === 1 ? 'card' : 'cards'} left`
                    : 'out of cards'}
                </span>
              </div>
              <div
                className={`a-rise relative flex w-full items-start justify-center overflow-hidden rounded-t-lg pt-1.5 ${
                  rank === 1 ? 'a-shine' : ''
                }`}
                style={{
                  height: medal.h,
                  background: `linear-gradient(180deg, ${medal.from}, ${medal.to})`,
                  animationDelay: `${wait}s`,
                }}
              >
                <span className='text-2xl font-black text-black/70 tabular-nums'>
                  {rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className='h-1 rounded-full bg-line-strong' />
      {places.length > 3 && (
        <ol className='mx-auto mt-3 w-full max-w-xs space-y-1'>
          {places.slice(3).map((seat, i) => (
            <li
              key={seat}
              className='a-slide-up flex items-center gap-2 rounded-lg bg-surface/70 px-2.5 py-1 text-xs'
              style={{ animationDelay: `${2.5 + i * 0.1}s` }}
            >
              <span className='w-5 font-bold text-mute tabular-nums'>
                {i + 4}
              </span>
              <span
                className='flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white uppercase'
                style={{ background: seatColor(seat) }}
              >
                {name(seat).trim().charAt(0)}
              </span>
              <span
                className={`min-w-0 flex-1 truncate ${
                  seat === you ? 'font-bold text-accent' : ''
                }`}
              >
                {name(seat)}
              </span>
              {left[seat] > 0 && (
                <span className='text-mute'>{left[seat]} left</span>
              )}
            </li>
          ))}
        </ol>
      )}
      {mine > 0 && (
        <p className='mt-3 text-center text-sm text-mute'>
          You finished{' '}
          <span className='font-bold text-ink'>{placeText(mine)}</span>.
        </p>
      )}
    </div>
  );
}

/** Keyboard shortcuts for the two quick actions: U to call UNO, T to catch. */
function UnoKeys({
  enabled,
  onUno,
  onCatch,
}: {
  enabled: boolean;
  onUno?: () => void;
  onCatch?: () => void;
}) {
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable]')) return;
      const key = e.key.toLowerCase();
      if (key === 'u' && onUno) onUno();
      else if (key === 't' && onCatch) onCatch();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onUno, onCatch]);
  return null;
}

type UnoKind = Extract<GameId, 'uno' | 'unoflip' | 'unomercy'>;
const PLAYER_RANGE = `${UNO_PLAYERS.min} sampai ${UNO_PLAYERS.max} pemain`;

const BLURB: Record<UnoKind, string> = {
  uno: `# Uno untuk ${PLAYER_RANGE} di device berbeda. Pembuat room memulai permainan setelah semua bergabung.`,
  unoflip: `# Uno Flip: kartu dua sisi. Kartu FLIP membalik semuanya ke sisi gelap yang jauh lebih kejam. ${PLAYER_RANGE}.`,
  unomercy: `# Uno No Mercy: hukuman bisa ditumpuk, 7 tukar kartu, 0 oper kartu. Pemain gugur saat mencapai batas kartu room. ${PLAYER_RANGE}.`,
};

/** Your own cards: one fanned row, or two when there are too many for the screen. */
function Hand({
  hand,
  backs,
  backSide,
  isPlayable,
  dim,
  orderOf,
  entry,
  dropRef,
  onDrag,
  onPlay,
  onDrop,
}: {
  hand: Card[];
  /** Flip: the other faces, shown instead of the hand while it is turned over */
  backs: Card[] | null;
  backSide: Side;
  isPlayable: (index: number) => boolean;
  dim: boolean;
  orderOf: (index: number) => number | undefined;
  entry: (
    index: number,
  ) => { animate: 'deal' | 'draw' | 'flip' | 'swap'; delay: number } | null;
  dropRef: React.RefObject<HTMLDivElement | null>;
  onDrag: (state: DragState) => void;
  onPlay: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  const { ref, width, card } = useHandBox(hand.length);
  const { rows, step } = fitHand(hand.length, width, card);
  const per = Math.ceil(hand.length / rows);
  const all = hand.map((_, i) => i);
  const lines = rows === 1 ? [all] : [all.slice(0, per), all.slice(per)];
  // a name per card that survives the hand changing around it
  const seen = new Map<string, number>();
  const ids = hand.map((c) => {
    const kind = `${c.c}${c.v}`;
    const nth = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, nth);
    return `${kind}#${nth}`;
  });

  // when a card leaves or arrives, the others slide to their new places
  const places = React.useRef(new Map<string, { x: number; y: number }>());
  const measured = React.useRef(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = new Map<string, { x: number; y: number }>();
    el.querySelectorAll<HTMLElement>('[data-key]').forEach((slot) => {
      const at = { x: slot.offsetLeft, y: slot.offsetTop };
      const key = slot.dataset.key ?? '';
      next.set(key, at);
      const was = places.current.get(key);
      if (
        measured.current &&
        was &&
        (was.x !== at.x || was.y !== at.y) &&
        typeof slot.animate === 'function'
      ) {
        slot.animate(
          [
            { translate: `${was.x - at.x}px ${was.y - at.y}px` },
            { translate: '0 0' },
          ],
          { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
    });
    places.current = next;
    measured.current = card > 0;
  });

  return (
    <div
      ref={ref}
      data-testid='hand'
      data-rows={rows}
      aria-label='Your hand'
      className='relative z-20 flex shrink-0 flex-col items-center px-2.5'
      style={{
        paddingTop: 'calc(var(--card-hand) * 0.28)',
        paddingBottom: 'calc(var(--card-hand) * 0.2)',
      }}
    >
      {lines.map((line, row) => {
        const mid = (line.length - 1) / 2;
        const tilt =
          line.length > 1 ? Math.min(2.6, 20 / (line.length - 1)) : 0;
        return (
          <div
            key={row}
            className='flex justify-center'
            style={{
              marginTop: row ? 'calc(var(--card-hand) * -0.72)' : undefined,
            }}
          >
            {line.map((index, k) => {
              const playable = isPlayable(index);
              const e = entry(index);
              const c = hand[index];
              const back = backs?.[index];
              return (
                <HandCard
                  key={ids[index]}
                  id={ids[index]}
                  index={index}
                  card={c}
                  back={back ? { card: back, side: backSide } : undefined}
                  playable={playable && !back}
                  dim={dim && !playable}
                  animate={e?.animate}
                  delay={e?.delay}
                  fan={(k - mid) * tilt}
                  drop={mid > 0 ? ((k - mid) / mid) ** 2 * card * 0.1 : 0}
                  gap={k && step !== null ? step - card : undefined}
                  dropRef={dropRef}
                  onDrag={onDrag}
                  onPlay={() => onPlay(index)}
                  onDrop={() => onDrop(index)}
                  order={orderOf(index)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const narrow = (node: React.ReactNode) => (
  <div className='mx-auto w-full max-w-xl pt-2'>{node}</div>
);

function Uno({ game }: { game: UnoKind }) {
  const r = useRoom<UnoXView>(game);
  const [choosing, setChoosing] = React.useState<number | null>(null);
  /** A No Mercy 7 waiting for the player to swap hands with */
  const [swapping, setSwapping] = React.useState<number | null>(null);
  /** Cards picked for a same-number stack, in play order */
  const [picked, setPicked] = React.useState<{
    version: number;
    cards: number[];
  } | null>(null);
  // anything new from the server (a move, a draw) ends a half-built stack.
  // Reactions are not moves: they are counted out, so one never replays the
  // last card's animation or closes a prompt.
  const version = (r.room?.version ?? 0) - (r.room?.state?.emote?.n ?? 0);
  const stack = picked?.version === version ? picked.cards : null;
  const setStack = (cards: number[] | null) =>
    setPicked(cards ? { version, cards } : null);
  const [drag, setDrag] = React.useState<DragState>('idle');
  /** The room version whose results pop-up was closed */
  const [podiumClosed, setPodiumClosed] = React.useState(-1);
  /** The seat whose cards are being looked at up close */
  const [inspect, setInspect] = React.useState<number | null>(null);
  /** Flip: the version at which you turned your hand over to see its other side */
  const [turnedAt, setTurnedAt] = React.useState(-1);
  const pileRef = React.useRef<HTMLDivElement>(null);
  /** Where the card you just played was, measured from the pile it flies to */
  const [flight, setFlight] = React.useState<{
    x: number;
    y: number;
    scale: number;
  } | null>(null);
  const [emoting, setEmoting] = React.useState(false);
  const [guide, setGuide] = React.useState(false);
  const sfx = useUnoSfx();

  // every event has its sound, and your turn taps you on the shoulder
  const heard = React.useRef<{ version: number; turn: number } | null>(null);
  const state = r.room?.status === 'waiting' ? null : (r.room?.state ?? null);
  const me = r.session?.you ?? -1;
  const ended = r.room?.status === 'over';
  React.useEffect(() => {
    if (!state) return;
    const before = heard.current;
    heard.current = { version, turn: ended ? -1 : state.turn };
    // the table as it was when you sat down makes no noise
    if (!before || before.version === version) return;
    const e = state.last;
    if (ended) {
      sfx.play(state.winner === me ? 'win' : 'lose');
      return;
    }
    if (e?.kind === 'play') {
      const v = e.card?.v ?? '';
      // one flick per card that goes down
      for (let k = 0; k < Math.min(7, playedCount(e)); k++)
        setTimeout(() => sfx.play('card'), k * TOSS_STEP);
      const extra: UnoSound | null = e.mercy?.length
        ? 'bad'
        : e.swapped !== undefined || e.rotated
          ? 'swap'
          : v === 'L'
            ? 'flip'
            : v === 'S' || v === 'SE'
              ? 'skip'
              : v === 'V' || v === 'WR4'
                ? 'reverse'
                : e.card?.c === 'W'
                  ? 'wild'
                  : null;
      if (extra) setTimeout(() => sfx.play(extra), 180);
      if (e.drew?.seat === me) sfx.buzz([30, 40, 30]);
    } else if (e?.kind === 'uno') sfx.play('uno');
    else if (e?.kind === 'catch' || e?.kind === 'challenge') sfx.play('bad');
    else if (e && !e.drew) sfx.play('draw');
    // and one for every card pulled from the pile, in time with it flying out
    if (e?.drew) {
      const step = dealStep(e.drew.count);
      for (let k = 0; k < Math.min(DEAL_MAX, e.drew.count); k++)
        setTimeout(() => sfx.play('draw'), 60 + k * step);
    }
    if (state.turn === me && before.turn !== me) {
      setTimeout(() => sfx.play('turn'), 420);
      sfx.buzz(45);
    }
    // only a new event should be heard
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ended]);
  const emoteN = state?.emote?.n ?? 0;
  const emoteSeen = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!state) return;
    const before = emoteSeen.current;
    emoteSeen.current = emoteN;
    if (before !== null && before !== emoteN) sfx.play('emote');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emoteN, !state]);

  if (!r.session) {
    return narrow(
      <RoomLobby
        blurb={BLURB[game]}
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
        onCreate={r.create}
        onJoin={r.join}
      />,
    );
  }

  // taken out of the room (disconnected, or too many missed turns)
  if (r.room && r.room.seat === null) return narrow(<Removed r={r} />);

  const { room } = r;
  const you = r.session.you;
  const names = room?.names ?? [];
  const seatName = (seat: number) => seatNameFor('en', seat, you, names);
  const view = room?.state ?? null;
  const playing = room?.status === 'playing' || room?.status === 'over';

  // ------------------------------------------------------------ waiting room
  if (room && room.status === 'waiting') return narrow(<WaitingRoom r={r} />);

  if (!room || !view || !playing) {
    return narrow(
      <>
        <RoomBar code={r.session.code} share={false} onLeave={r.leave} />
        <p className='text-center text-sm text-mute'>Connecting…</p>
        {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
      </>,
    );
  }

  // ------------------------------------------------------------------- game
  const over = room.status === 'over';
  const mercyLimit = view.mercyLimit ?? UNO_MERCY_LIMIT.default;
  const mercyWarningAt = Math.max(1, mercyLimit - 5);
  const myPlace = view.places.indexOf(you);
  const out = myPlace !== -1;
  /** Done playing (out of cards, or knocked out) while the others go on */
  const watching = !over && (out || !!view.peek);
  const myTurn = !over && !out && view.turn === you;
  const side: Side = view.side ?? 'light';
  const otherSide: Side = side === 'dark' ? 'light' : 'dark';
  const turned = turnedAt === version && !!view.backs;

  /** The cards of a seat this viewer may look at, and which face they are. */
  const visible = (seat: number): { cards: Card[]; side: Side } | null => {
    const real = view.peek?.[seat];
    if (real?.length) return { cards: real, side };
    const backs = seat === you ? null : view.backs?.[seat];
    return backs?.length ? { cards: backs, side: otherSide } : null;
  };

  let banner: React.ReactNode;
  if (over) {
    banner =
      view.winner === you ? (
        <span className='text-accent'>You win!</span>
      ) : (
        <span className='text-err'>{seatName(view.winner ?? 0)} wins.</span>
      );
  } else if (watching) {
    banner = (
      <span className='text-accent'>
        {out ? `${placeText(myPlace)}!` : 'You are out.'} Tap a player to see
        their cards.
      </span>
    );
  } else if (view.challenge) {
    banner = view.canChallenge ? (
      <span className='text-err'>
        {seatName(view.challenge.from)} played +4. Accept or challenge?
      </span>
    ) : (
      <span className='text-mute'>
        Waiting for {seatName(view.challenge.victim)} to answer the +4…
      </span>
    );
  } else if (view.penalty > 0) {
    banner = myTurn ? (
      <span className='text-err'>
        {view.penalty} cards stacked on you. Answer with a draw card, or take
        them.
      </span>
    ) : (
      <span className='text-hash'>
        {view.penalty} cards stacked on {seatName(view.turn)}…
      </span>
    );
  } else if (view.stuck) {
    banner = (
      <span className='text-hash'>No card fits. Draw from the pile.</span>
    );
  } else if (myTurn) {
    banner = <span className='text-accent'>Your turn</span>;
  } else {
    banner = (
      <span className='text-mute'>{seatName(view.turn)}&apos;s turn…</span>
    );
  }

  const playStack = (cards: number[]) => {
    setStack(null);
    r.move({ type: 'play', index: cards[0], also: cards.slice(1) });
  };

  const stackOptions = stack ? stackable(view.hand, stack[0]) : [];

  /** In No Mercy a 7 swaps hands, so it needs a player to swap with. */
  const swaps = (card: Card) => view.variant === 'nomercy' && card.v === '7';

  /** Notes where a hand card is, so it can fly to the pile from right there. */
  const launch = (index: number) => {
    const el = document.querySelector<HTMLElement>(
      `[data-hand-index="${index}"] .uno-card`,
    );
    const pile = pileRef.current;
    if (!el || !pile) return;
    const a = el.getBoundingClientRect();
    const b = pile.getBoundingClientRect();
    const top = pile.querySelector<HTMLElement>('.uno-card');
    setFlight({
      x: a.left + a.width / 2 - (b.left + b.width / 2),
      y: a.top + a.height / 2 - (b.top + b.height / 2),
      scale: top?.offsetWidth ? el.offsetWidth / top.offsetWidth : 1,
    });
  };

  const playCard = (index: number) => {
    const card = view.hand[index];
    if (stack) {
      // building a stack: tap to add or remove cards of the same number
      if (index === stack[0]) return;
      setStack(
        stack.includes(index)
          ? stack.filter((i) => i !== index)
          : [...stack, index],
      );
      return;
    }
    launch(index);
    if (card.c === 'W') setChoosing(index);
    else if (swaps(card)) setSwapping(index);
    else if (
      !(view.variant === 'nomercy' && card.v === '0') &&
      !view.canPass &&
      stackable(view.hand, index).length > 0
    )
      setStack([index]);
    else r.move({ type: 'play', index });
  };

  /** Dropping a card on the pile plays it, with the stack if one is open. */
  const dropCard = (index: number) => {
    launch(index);
    if (!stack) {
      if (view.hand[index].c === 'W') setChoosing(index);
      else if (swaps(view.hand[index])) setSwapping(index);
      else r.move({ type: 'play', index });
      return;
    }
    playStack(stack.includes(index) ? stack : [...stack, index]);
  };

  const players = view.players;
  // the draw pile is drawn as a stack: taller while there are more cards
  const layers = Math.max(1, Math.min(6, Math.ceil(view.drawCount / 15)));
  const catchable = view.catchable.filter((seat) => seat !== you);
  // cards that just landed in your own hand (always at the end)
  const drewMine =
    view.last?.drew?.seat === you
      ? Math.min(view.last.drew.count, view.hand.length)
      : 0;
  const others = view.counts
    .map((count, seat) => ({ count, seat }))
    .filter((p) => p.seat !== you);

  // Cards tossed onto the pile fly in from the player who played them. A
  // stack (or a Discard All) goes down one card after the other.
  const tossed = Math.min(view.pile.length, playedCount(view.last));
  const tossFor = (card: Card, i: number) => {
    const nth = i - (view.pile.length - tossed);
    if (view.last?.kind !== 'play' || nth < 0) return null;
    const delay = nth * TOSS_STEP;
    if (view.last.seat === you && flight) {
      // your own card leaves from exactly where it was in your hand; the pile
      // slot it lands in is turned, so the way there is turned back
      const rot = scatterFor(card, i).rot;
      const turn = (rot * Math.PI) / 180;
      const x = flight.x * Math.cos(turn) + flight.y * Math.sin(turn);
      const y = -flight.x * Math.sin(turn) + flight.y * Math.cos(turn);
      return {
        x: `${x.toFixed(0)}px`,
        y: `${y.toFixed(0)}px`,
        spin: -rot,
        scale: flight.scale,
        own: true,
        delay,
      };
    }
    const p = seatPos(view.last.seat, you, players);
    return {
      ...fromCenter(p),
      spin: p.left < 50 ? 150 : -150,
      scale: 0.55,
      own: false,
      delay,
    };
  };

  // cards pulled from the pile fly out to whoever drew them (+2/+4, draw, catch);
  // your own land in your hand instead, each in its place
  const drew = view.last?.drew?.seat === you ? null : (view.last?.drew ?? null);
  const drewTo = drew
    ? {
        ...fromCenter(seatPos(drew.seat, you, players)),
        count: Math.min(drew.count, DEAL_MAX),
        step: dealStep(drew.count),
      }
    : null;

  // hands changing owners (No Mercy's 7 and 0) fly across the table
  const swapFx = (() => {
    const e = view.last;
    if (over || e?.kind !== 'play') return null;
    // your own hand is below the table
    const at = (seat: number) =>
      seat === you ? { left: 50, top: 104 } : seatPos(seat, you, players);
    if (e.swapped !== undefined) {
      return {
        mine: e.seat === you || e.swapped === you,
        seats: [e.seat, e.swapped],
        label: 'SWAP!',
        sub: `${seatName(e.seat)} ↔ ${seatName(e.swapped)}`,
        moves: [
          { from: at(e.seat), to: at(e.swapped) },
          { from: at(e.swapped), to: at(e.seat) },
        ],
      };
    }
    if (e.rotated) {
      // everyone still holding cards handed them to the next player
      const live = view.counts.flatMap((n, seat) => (n > 0 ? [seat] : []));
      const next = (seat: number) => {
        let to = seat;
        for (let guard = 0; guard < players; guard++) {
          to = (to + view.dir + players) % players;
          if (view.counts[to] > 0) break;
        }
        return to;
      };
      return {
        mine: view.hand.length > 0,
        seats: live,
        label: 'PASS IT ON!',
        sub: 'Every hand moves one seat',
        moves: live.map((seat) => ({ from: at(seat), to: at(next(seat)) })),
      };
    }
    return null;
  })();

  // a banner so skips, reverses and draws are obvious
  const effect = (() => {
    const e = view.last;
    if (!e || swapFx) return null;
    const draws = (seat: number) => verb(seat, you, 'draw');
    const n = e.drew?.count ?? 0;
    const drawn = cardCountText(n);
    if (e.mercy?.length) {
      return {
        icon: 'wrong' as IconKind,
        big: 'NO MERCY!',
        sub: `${e.mercy.map((m) => seatName(m)).join(', ')} hit ${mercyLimit} cards`,
        tone: 'text-err',
      };
    }
    if (e.kind === 'challenge') {
      const target = e.target ?? 0;
      return e.caught
        ? {
            icon: 'caught' as IconKind,
            big: 'BUSTED!',
            sub: `${seatName(target)} bluffed and ${draws(target)} ${drawn}`,
            tone: 'text-accent',
          }
        : {
            icon: 'wrong' as IconKind,
            big: 'WRONG GUESS!',
            sub: `${seatName(e.seat)} ${draws(e.seat)} ${drawn}`,
            tone: 'text-err',
          };
    }
    if (e.kind === 'catch') {
      const target = e.target ?? 0;
      return {
        icon: 'catch' as IconKind,
        big: 'CAUGHT!',
        sub: `${seatName(e.seat)} ${verb(e.seat, you, 'catch')} ${seatName(target)}: no UNO, ${draws(target)} ${drawn}`,
        tone: 'text-err',
      };
    }
    if (e.kind === 'uno') {
      return {
        icon: 'uno' as IconKind,
        big: 'UNO!',
        sub: `${seatName(e.seat)} ${verb(e.seat, you, 'call')} UNO`,
        tone: 'text-accent',
      };
    }
    if (e.kind === 'take') {
      return {
        icon: 'plus4' as IconKind,
        big: `+${n}`,
        sub: `${seatName(e.seat)} ${verb(e.seat, you, 'take')} ${drawn}`,
        tone: 'text-err',
      };
    }
    if (e.kind !== 'play' || !e.card) return null;
    const v = e.card.v;
    const who = seatName(e.seat);
    const victimSeat = e.drew?.seat ?? view.challenge?.victim ?? -1;
    const victim = seatName(victimSeat);
    const hit = `${victim} ${draws(victimSeat)} ${drawn}`;
    // No Mercy: the stack waiting for the next player
    const stacked = `${seatName(view.turn)}: stack or take ${view.penalty}`;
    const big = (icon: IconKind, text: string, sub: string, tone: string) => ({
      icon,
      big: text,
      sub,
      tone,
    });
    if (v === 'S') return big('skip', 'SKIPPED!', who, 'text-err');
    if (v === 'SE')
      return big('skip', 'SKIP EVERYONE!', `${who} goes again`, 'text-err');
    if (v === 'V') return big('reverse', 'REVERSE!', who, 'text-info');
    if (v === 'L')
      return big('flip', 'FLIP!', `Now the ${e.flipped} side`, 'text-accent');
    if (v === 'D')
      return big('plus2', '+2', view.penalty ? stacked : hit, 'text-hash');
    if (v === 'D1') return big('plus2', '+1', hit, 'text-hash');
    if (v === 'D5') return big('plus4', '+5', hit, 'text-err');
    if (v === 'WD2') return big('plus2', '+2', hit, 'text-hash');
    if (v === 'WDC') return big('plus4', 'DRAW COLOR', hit, 'text-err');
    if (v === 'D4') return big('plus4', '+4', stacked, 'text-err');
    if (v === 'W6') return big('plus4', '+6', stacked, 'text-err');
    if (v === 'W10') return big('plus4', '+10', stacked, 'text-err');
    if (v === 'WR4') return big('reverse', 'REVERSE +4', stacked, 'text-err');
    if (v === 'WRL') return big('wild', 'ROULETTE!', hit, 'text-err');
    if (v === 'DA')
      return big(
        'play',
        'DISCARD ALL',
        `${who} dropped ${e.dumped ?? 0} more`,
        'text-info',
      );
    if (v === 'F') {
      if (!view.challenge && !e.drew) return null;
      return {
        icon: 'plus4' as IconKind,
        big: '+4',
        sub: view.challenge ? `${victim}: accept or challenge?` : hit,
        tone: 'text-err',
      };
    }
    if (v === 'W' || e.card.c === 'W')
      return {
        icon: 'wild' as IconKind,
        big: 'WILD!',
        sub: `Color is now ${COLOR_NAME[view.color]}`,
        tone: 'text-accent',
      };
    return null;
  })();

  // The everyday cards (skip, reverse, +1, +2, a plain wild) only mark the
  // player they hit; the whole-table banner is kept for the big moments.
  const minor = (() => {
    const e = view.last;
    if (!effect || over || e?.kind !== 'play' || !e.card || e.mercy?.length)
      return null;
    const v = e.card.v;
    if (v === 'S') {
      // whoever sits between the player and the one whose turn it is now
      let seat = e.seat;
      for (let guard = 0; guard < players; guard++) {
        seat = (seat + view.dir + players) % players;
        if (view.counts[seat] > 0 && !view.places.includes(seat)) break;
      }
      return { seat, text: 'SKIP' };
    }
    if (v === 'D' || v === 'D1' || v === 'WD2') {
      const seat = view.penalty ? view.turn : (e.drew?.seat ?? null);
      return seat === null
        ? null
        : { seat, text: view.penalty ? effect.big : `+${e.drew?.count ?? 0}` };
    }
    if (v === 'V') return { seat: null, text: 'REVERSE' };
    if (v === 'W') return { seat: null, text: COLOR_NAME[view.color] };
    return null;
  })();
  /** Where a seat is on the table; you are at the near edge. */
  const spot = (seat: number | null): React.CSSProperties =>
    seat === null
      ? { left: '50%', top: '20%' }
      : seat === you
        ? { left: '50%', top: '88%' }
        : seatStyle(seatPos(seat, you, players));
  const clock = !over ? room.waiting : null;

  /** How a card of your hand comes in: drawn, swapped in, flipped over, or dealt. */
  const entry = (index: number) => {
    if (drewMine && index >= view.hand.length - drewMine) {
      return {
        animate: 'draw' as const,
        delay:
          60 + (index - (view.hand.length - drewMine)) * dealStep(drewMine),
      };
    }
    if (swapFx?.mine)
      return { animate: 'swap' as const, delay: 900 + index * 45 };
    // a flip rolls over the table: the pile, each player in turn, then you
    if (view.last?.kind === 'play' && view.last.flipped)
      return {
        animate: 'flip' as const,
        delay: 250 + others.length * 130 + index * 40,
      };
    if (!view.last) return { animate: 'deal' as const, delay: index * 70 };
    return null;
  };

  const looking = inspect !== null && !over ? visible(inspect) : null;
  const flipped = view.last?.kind === 'play' && !!view.last.flipped;

  return (
    <SideContext.Provider value={side}>
      <LangProvider value='en'>
        {view.winner === you && <Confetti />}
        {over && view.places.length > 0 && podiumClosed !== version && (
          <div
            className='a-fade fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-3'
            // the winning card is held up first
            style={{ animationDelay: '1.3s' }}
          >
            <div
              role='dialog'
              aria-label='Results'
              className='a-pop relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-[hsl(46_96%_60%/0.45)] bg-card p-5 shadow-[0_0_60px_-10px_hsl(46_96%_60%/0.45)]'
              style={{ animationDelay: '1.3s' }}
            >
              <Podium
                places={view.places}
                you={you}
                names={names}
                left={view.counts}
              />
              <div className='mt-4 flex justify-center gap-2'>
                <button
                  type='button'
                  onClick={r.rematch}
                  disabled={r.busy}
                  className='uno-btn uno-btn-go'
                >
                  Play again
                </button>
                <button
                  type='button'
                  onClick={() => setPodiumClosed(version)}
                  className='uno-btn uno-btn-quiet'
                >
                  See the table
                </button>
              </div>
            </div>
          </div>
        )}
        <PlayersPanel
          room={room}
          you={you}
          turn={over ? null : view.turn}
          detail={(seat) => (
            <span className='text-xs font-semibold text-ink tabular-nums'>
              {view.places.includes(seat)
                ? 'done'
                : view.variant === 'nomercy'
                  ? `${view.counts[seat]}/${mercyLimit}`
                  : cardCountText(view.counts[seat])}
            </span>
          )}
        />

        {/* one screen, top to bottom: what is going on, the table, your hand */}
        <div className='uno-stage flex min-h-0 flex-1 flex-col overflow-hidden xl:pr-[20.5rem] xl:pl-[16.5rem]'>
          {/* a fixed-height strip, so whatever it says never moves the table */}
          <div className='uno-head mx-auto h-[3.6rem] w-full max-w-lg shrink-0 overflow-hidden px-1'>
            <p
              key={`${over}-${myTurn}-${view.turn}`}
              className='a-slide-up truncate text-center text-sm font-medium'
              aria-live='polite'
            >
              {view.variant === 'flip' && (
                <span
                  data-testid='side-chip'
                  className={`mr-2 rounded-full border px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide uppercase ${
                    side === 'dark'
                      ? 'border-[hsl(268_50%_55%)] bg-[hsl(268_50%_22%)] text-white'
                      : 'border-line-strong bg-white text-black'
                  }`}
                >
                  {side} side
                </span>
              )}
              {banner}
            </p>
            <RoomNotice
              room={room}
              you={you}
              receivedAt={r.receivedAt}
              onKick={r.kick}
              busy={r.busy}
              code={r.session.code}
              onLeave={r.leave}
              quiet
            />
          </div>

          {/* ------------------------------------------------- the table */}
          <div className='uno-table relative mx-auto min-h-0 w-full max-w-4xl flex-1'>
            <div className='uno-table-in absolute inset-0'>
              {/* felt */}
              <div
                key={`felt-${side}`}
                data-side={side}
                className={`absolute inset-x-[7%] inset-y-[9%] rounded-[45%] border shadow-[inset_0_0_60px_rgb(0_0_0/0.45)] transition-colors duration-500 ${
                  side === 'dark'
                    ? 'border-[hsl(268_50%_40%)] bg-[hsl(268_40%_14%)]/80'
                    : 'border-line-strong bg-card/60'
                } ${flipped ? 'a-flipboard' : ''}`}
              />
              {/* the colour in play glows under the piles */}
              <div
                aria-hidden
                className='pointer-events-none absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl transition-colors duration-700'
                style={{
                  width: 'min(62cqw, 80cqh)',
                  height: 'min(46cqw, 60cqh)',
                  background: BG[view.color],
                }}
              />
              {/* arrows of dashes flowing around the felt the way play goes; a reverse flashes it */}
              <svg
                key={`${view.dir}-${view.last?.kind === 'play' && view.last.card?.v === 'V' ? version : 0}`}
                aria-hidden
                data-testid='direction'
                data-dir={view.dir}
                viewBox='0 0 100 100'
                preserveAspectRatio='none'
                className={`pointer-events-none absolute inset-x-[7%] inset-y-[9%] h-[82%] w-[86%] overflow-visible ${
                  view.last?.kind === 'play' && view.last.card?.v === 'V'
                    ? 'a-ring-flash'
                    : ''
                }`}
              >
                <rect
                  x='1'
                  y='1'
                  width='98'
                  height='98'
                  rx='45'
                  ry='45'
                  pathLength='100'
                  fill='none'
                  stroke='var(--accent)'
                  strokeOpacity='0.55'
                  strokeWidth='2.5'
                  strokeLinecap='round'
                  strokeDasharray='1.2 2.8'
                  vectorEffect='non-scaling-stroke'
                  className={view.dir === 1 ? 'a-flow' : 'a-flow-rev'}
                />
              </svg>

              {others.map(({ count, seat }, order) => {
                const active = !over && view.turn === seat;
                const nearMercyLimit =
                  view.variant === 'nomercy' && count >= mercyWarningAt;
                const place = view.places.indexOf(seat);
                const pos = seatPos(seat, you, players);
                const safe = count === 1 && view.calledUno[seat];
                const canCatch = view.catchable.includes(seat) && !over;
                const just =
                  !over &&
                  view.last?.kind === 'play' &&
                  view.last.seat === seat &&
                  !!view.last.card;
                const got = !over && view.last?.drew?.seat === seat;
                const swapped = !!swapFx?.seats.includes(seat);
                const lit = just || got || swapped;
                const seen = visible(seat);
                const Tag = seen ? 'button' : 'div';
                return (
                  <Tag
                    key={seat}
                    type={seen ? 'button' : undefined}
                    onClick={seen ? () => setInspect(seat) : undefined}
                    aria-label={
                      seen ? `Look at ${seatName(seat)}'s cards` : undefined
                    }
                    data-seat={seat}
                    className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${
                      seen ? 'cursor-zoom-in' : ''
                    }`}
                    style={{
                      ...seatStyle(pos),
                      width: 'calc(var(--mini-w) * 4.8)',
                    }}
                  >
                    <span
                      key={lit ? `hit-${version}` : 'idle'}
                      className={`flex max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-[11px] transition-colors ${
                        just || swapped ? 'a-hit' : ''
                      } ${
                        active
                          ? 'a-glow border-accent bg-accent/20 font-semibold text-ink'
                          : lit
                            ? 'border-accent bg-paper/70 text-ink'
                            : 'border-line bg-paper/70 text-mute'
                      }`}
                    >
                      <Avatar
                        seat={seat}
                        name={seatName(seat)}
                        clock={
                          active && clock?.seats.includes(seat)
                            ? {
                                left: clock.remaining,
                                of: clock.seconds,
                                key: version,
                              }
                            : null
                        }
                      />
                      <span className='truncate'>{seatName(seat)}</span>
                    </span>
                    <div
                      className={`transition-transform duration-200 ${
                        seen ? 'group-hover:scale-110' : ''
                      } ${active ? 'a-bob-soft' : ''} ${
                        count === 1 && !over ? 'uno-one' : ''
                      }`}
                    >
                      <MiniFan
                        key={flipped ? `flip-${version}` : 'fan'}
                        count={count}
                        cards={seen?.cards ?? null}
                        side={seen?.side}
                        flipAt={flipped ? 250 + order * 130 : undefined}
                      />
                    </div>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold ${
                        nearMercyLimit ? 'a-wiggle text-err' : 'text-ink'
                      }`}
                    >
                      <CountUp
                        value={count}
                        step={got ? dealStep(view.last!.drew!.count) : 70}
                      />
                      {nearMercyLimit && (
                        <span className='text-[10px] font-normal'>
                          /{mercyLimit}
                        </span>
                      )}
                      {(just || got) && (
                        <span
                          key={`just-${version}`}
                          className={`a-pop rounded-full px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                            got ? 'bg-err text-paper' : 'bg-accent text-paper'
                          }`}
                        >
                          {got ? (
                            <>
                              +
                              <CountUp
                                from={0}
                                value={view.last!.drew!.count}
                                step={dealStep(view.last!.drew!.count)}
                              />
                            </>
                          ) : (
                            face(view.last!.card!)
                          )}
                        </span>
                      )}
                      {place !== -1 ? (
                        <span className='text-[11px] font-bold text-accent'>
                          {place === 0 ? 'winner' : `#${place + 1}`}
                        </span>
                      ) : canCatch ? (
                        <span className='a-wiggle text-[11px] whitespace-nowrap text-err'>
                          no UNO!
                        </span>
                      ) : safe ? (
                        <span className='text-[11px] font-bold whitespace-nowrap text-accent'>
                          UNO ✓
                        </span>
                      ) : null}
                    </span>
                  </Tag>
                );
              })}

              {/* cards pulled from the pile, flying to whoever drew them */}
              {drewTo && (
                <div key={`drew-${version}`} aria-hidden>
                  {Array.from({ length: drewTo.count }, (_, i) => (
                    <div
                      key={i}
                      className='a-draw absolute top-[46%] left-1/2 z-30'
                      style={
                        {
                          '--to-x': drewTo.x,
                          '--to-y': drewTo.y,
                          '--spin': `${((i % 3) - 1) * 20}deg`,
                          animationDelay: `${i * drewTo.step}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <CardBack w='calc(var(--pile-w) * 0.6)' />
                    </div>
                  ))}
                </div>
              )}

              {swapFx && (
                <SwapFx
                  key={`swap-${version}`}
                  moves={swapFx.moves}
                  label={swapFx.label}
                  sub={swapFx.sub}
                />
              )}

              {/* a wild's new colour washes out from the pile */}
              {!over && view.last?.kind === 'play' && view.last.color && (
                <span
                  key={`ripple-${version}`}
                  aria-hidden
                  className='a-ripple pointer-events-none absolute top-[46%] left-1/2 rounded-full'
                  style={{
                    width: 'min(95cqw, 130cqh)',
                    height: 'min(95cqw, 130cqh)',
                    background: `radial-gradient(circle, transparent 35%, ${BG[view.color]} 60%, transparent 72%)`,
                  }}
                />
              )}

              {/* what the last action card did: a stamp on the player it hit… */}
              {effect && minor && (
                <div
                  key={`mini-${version}`}
                  aria-hidden
                  data-testid='seat-fx'
                  className='pointer-events-none absolute z-[45] -translate-x-1/2 -translate-y-1/2'
                  style={spot(minor.seat)}
                >
                  <div
                    className={`a-stamp flex flex-col items-center drop-shadow-[0_4px_0_rgb(0_0_0/0.55)] ${effect.tone}`}
                  >
                    <span
                      className={effect.icon === 'reverse' ? 'a-half-turn' : ''}
                      style={{
                        width: 'min(15cqw, 18cqh)',
                        height: 'min(15cqw, 18cqh)',
                      }}
                    >
                      <EventIcon kind={effect.icon} className='size-full' />
                    </span>
                    <span
                      className='font-black tracking-tight uppercase'
                      style={{ fontSize: 'min(6cqw, 7.5cqh)', lineHeight: 1 }}
                    >
                      {minor.text}
                    </span>
                  </div>
                </div>
              )}
              {/* …or, for the big moments, the whole table */}
              {effect && !minor && !over && (
                <div
                  key={`fx-${version}`}
                  aria-hidden
                  className='a-fx-quick pointer-events-none absolute inset-0 z-[45] flex flex-col items-center justify-center rounded-[2rem] bg-black/40'
                >
                  <span
                    className={`mb-1 drop-shadow-[0_6px_0_rgb(0_0_0/0.45)] ${effect.tone}`}
                    style={{
                      width: 'min(24cqw, 28cqh)',
                      height: 'min(24cqw, 28cqh)',
                    }}
                  >
                    <EventIcon kind={effect.icon} className='size-full' />
                  </span>
                  <span
                    className={`text-center font-black tracking-tight drop-shadow-[0_6px_0_rgb(0_0_0/0.45)] ${effect.tone}`}
                    style={{ fontSize: 'min(13cqw, 17cqh)', lineHeight: 1 }}
                  >
                    {effect.big}
                  </span>
                  <span className='mt-2 max-w-[90%] rounded-full bg-paper/90 px-4 py-1 text-center text-sm font-semibold text-ink sm:text-lg'>
                    {effect.sub}
                  </span>
                </div>
              )}

              {/* a reaction pops up over whoever sent it */}
              {view.emote && (
                <EmoteBubble
                  key={`emote-${view.emote.n}`}
                  emoji={view.emote.e}
                  style={
                    view.emote.seat === you
                      ? { left: '50%', top: '80%' }
                      : spot(view.emote.seat)
                  }
                />
              )}

              {/* center: draw pile, discard pile, colour */}
              <div
                className='uno-center absolute top-[46%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center'
                style={{ gap: 'calc(var(--pile-w) * 0.45)' }}
              >
                <button
                  type='button'
                  aria-label='Draw a card'
                  data-draw-pile
                  disabled={!view.canDraw || r.busy}
                  onClick={() => r.move({ type: 'draw' })}
                  className='group relative flex items-center justify-center disabled:opacity-80'
                  style={{
                    width: 'var(--pile-w)',
                    height: 'calc(var(--pile-w) * 1.5)',
                  }}
                >
                  {/* a stack: the more cards left, the taller it looks */}
                  {Array.from({ length: layers }, (_, i) => {
                    const top = i === layers - 1;
                    const back = (i - layers + 1) * 2.5;
                    const cls =
                      top && view.canDraw && !r.busy
                        ? 'a-bob ring-2 ring-accent group-hover:scale-105'
                        : top
                          ? 'group-hover:scale-[1.03]'
                          : 'brightness-75';
                    return (
                      <span
                        key={i}
                        className='absolute'
                        style={{
                          translate: `${back}px ${-back}px`,
                          rotate: top ? undefined : `${i % 2 ? 1.2 : -1.2}deg`,
                        }}
                      >
                        {/* a Flip deck has no back: the pile shows its other side */}
                        {top && view.drawBack ? (
                          <UnoCard
                            key={`${view.drawBack.c}${view.drawBack.v}-${view.drawCount}`}
                            card={view.drawBack}
                            side={otherSide}
                            w='var(--pile-w)'
                            animate={flipped ? 'flip' : undefined}
                            className={cls}
                          />
                        ) : (
                          <CardBack w='var(--pile-w)' className={cls} />
                        )}
                      </span>
                    );
                  })}
                  <span className='absolute top-full mt-1.5 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] whitespace-nowrap'>
                    draw · {view.drawCount}
                  </span>
                </button>

                <div
                  ref={pileRef}
                  data-testid='pile'
                  data-drop={drag}
                  className={`relative rounded-xl transition-all duration-200 ${
                    drag === 'over'
                      ? 'scale-105 bg-accent/20 ring-4 ring-accent'
                      : drag === 'drag'
                        ? 'a-glow ring-dashed bg-accent/10 ring-2 ring-accent/60'
                        : ''
                  }`}
                  style={{
                    width: 'calc(var(--pile-w) * 1.15)',
                    height: 'calc(var(--pile-w) * 1.6)',
                  }}
                >
                  {drag !== 'idle' && (
                    <span className='a-fade absolute -top-5 left-1/2 z-50 -translate-x-1/2 text-xs whitespace-nowrap text-accent'>
                      {drag === 'over' ? 'drop!' : 'drag here'}
                    </span>
                  )}
                  {/* the messy stack of recent discards */}
                  {view.pile.map((card, i) => {
                    const isTop = i === view.pile.length - 1;
                    const s = scatterFor(card, i);
                    const toss = tossFor(card, i);
                    return (
                      <div
                        key={`${card.c}${card.v}-${i}`}
                        className='absolute top-1/2 left-1/2'
                        style={{
                          zIndex: isTop && over ? 60 : i,
                          transform: `translate(-50%, -50%) translate(${s.x * 0.7}px, ${s.y * 0.7}px) rotate(${s.rot}deg)`,
                        }}
                      >
                        {toss ? (
                          <div
                            key={version}
                            className='a-toss'
                            style={
                              {
                                '--from-x': toss.x,
                                '--from-y': toss.y,
                                '--spin': `${toss.spin}deg`,
                                '--from-scale': toss.scale,
                                // a card waiting its turn is not there yet
                                '--from-o': toss.delay ? 0 : toss.own ? 1 : 0.7,
                                animationDuration: toss.own
                                  ? '0.55s'
                                  : undefined,
                                animationDelay: `${toss.delay}ms`,
                              } as React.CSSProperties
                            }
                          >
                            <UnoCard
                              card={card}
                              w='var(--pile-w)'
                              className={isTop && over ? 'a-winzoom' : ''}
                              style={
                                isTop && over
                                  ? { animationDelay: `${toss.delay + 500}ms` }
                                  : undefined
                              }
                            />
                          </div>
                        ) : (
                          <UnoCard
                            card={card}
                            w='var(--pile-w)'
                            animate={flipped ? 'flip' : undefined}
                            className={isTop && over ? 'a-winzoom' : ''}
                          />
                        )}
                      </div>
                    );
                  })}
                  <span
                    key={view.color}
                    data-color={view.color}
                    aria-label={`color ${COLOR_NAME[view.color]}`}
                    className='a-pop absolute -right-3 -bottom-3 z-50 flex size-8 items-center justify-center rounded-full border-2 border-white shadow-lg'
                    style={{ background: BG[view.color] }}
                  >
                    <ColorShape color={view.color} className='size-4' />
                  </span>
                  {view.penalty > 0 && (
                    <span
                      key={`pen-${view.penalty}`}
                      className='a-pop absolute -top-3 -left-3 z-50 flex size-10 items-center justify-center rounded-full border-2 border-white bg-err text-sm font-black text-white shadow-lg'
                    >
                      +{view.penalty}
                    </span>
                  )}
                </div>
              </div>

              {/* a closer look at one player's cards */}
              {looking && inspect !== null && (
                <div
                  role='dialog'
                  aria-label={`${seatName(inspect)}'s cards`}
                  className='a-fade absolute inset-0 z-50 flex items-center justify-center rounded-[2rem] bg-black/55 p-3'
                  onClick={() => setInspect(null)}
                >
                  <div
                    className='a-pop flex max-h-full w-full max-w-md flex-col gap-2 overflow-y-auto rounded-2xl border border-line-strong bg-card p-3 shadow-2xl'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className='flex items-center justify-between gap-3 text-sm'>
                      <span className='min-w-0 truncate font-semibold'>
                        {seatName(inspect)} · {looking.cards.length}{' '}
                        {looking.cards.length === 1 ? 'card' : 'cards'}
                      </span>
                      <button
                        type='button'
                        onClick={() => setInspect(null)}
                        aria-label='Close'
                        className='px-1 text-lg leading-none text-mute hover:text-ink'
                      >
                        ×
                      </button>
                    </div>
                    <p className='text-xs text-mute'>
                      {view.peek
                        ? 'You are done, so you see what they are holding.'
                        : `Flip cards have two faces: this is their ${looking.side} side, the one facing you.`}
                    </p>
                    <div className='flex flex-wrap justify-center gap-1.5'>
                      {looking.cards.map((card, i) => (
                        <UnoCard
                          key={i}
                          card={card}
                          side={looking.side}
                          w='clamp(2.2rem, 11cqw, 3.4rem)'
                          animate='deal'
                          delay={i * 30}
                        />
                      ))}
                    </div>
                    {view.peek && view.backs?.[inspect]?.length ? (
                      <>
                        <p className='text-xs text-mute'>
                          Their {otherSide} side:
                        </p>
                        <div className='flex flex-wrap justify-center gap-1.5'>
                          {view.backs[inspect].map((card, i) => (
                            <UnoCard
                              key={i}
                              card={card}
                              side={otherSide}
                              w='clamp(1.8rem, 8cqw, 2.6rem)'
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              {/* prompts and actions float over the near edge of the table */}
              <div className='uno-actions pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-1'>
                <div className='pointer-events-auto flex max-w-full flex-col items-center gap-2 pb-1 empty:hidden'>
                  {stack && (
                    <div
                      className='uno-prompt flex flex-col items-center gap-2 text-center'
                      role='group'
                      aria-label='Stack cards'
                    >
                      <p className='text-xs text-mute'>
                        Stacking {face(view.hand[stack[0]])}s: pick more{' '}
                        {face(view.hand[stack[0]])} cards. The last card sets
                        the color.
                      </p>
                      <div className='flex flex-wrap justify-center gap-2'>
                        <button
                          type='button'
                          onClick={() => playStack(stack)}
                          disabled={r.busy}
                          className='uno-btn uno-btn-go'
                        >
                          play {stack.length}{' '}
                          {stack.length === 1 ? 'card' : 'cards'}
                        </button>
                        {stack.length < stackOptions.length + 1 && (
                          <button
                            type='button'
                            onClick={() =>
                              playStack([stack[0], ...stackOptions])
                            }
                            disabled={r.busy}
                            className='uno-btn'
                          >
                            stack all ({stackOptions.length + 1})
                          </button>
                        )}
                        <button
                          type='button'
                          onClick={() => setStack(null)}
                          className='uno-btn uno-btn-quiet'
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {choosing !== null && (
                    <div
                      className='uno-prompt flex flex-col items-center gap-2'
                      role='group'
                      aria-label='Pick a color'
                    >
                      <p className='text-xs'>Pick a color:</p>
                      <div className='flex gap-2'>
                        {(view.side === 'dark' ? DARK_COLORS : COLORS).map(
                          (color) => (
                            <button
                              key={color}
                              type='button'
                              aria-label={`Color ${COLOR_NAME[color]}`}
                              data-pick-color={color}
                              title={COLOR_NAME[color]}
                              onClick={() => {
                                r.move({
                                  type: 'play',
                                  index: choosing,
                                  color,
                                });
                                setChoosing(null);
                              }}
                              className='flex size-12 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 active:scale-95'
                              style={{ background: BG[color] }}
                            >
                              <ColorShape color={color} className='size-6' />
                            </button>
                          ),
                        )}
                        <button
                          type='button'
                          onClick={() => setChoosing(null)}
                          className='uno-btn uno-btn-quiet'
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {swapping !== null && (
                    <div
                      className='uno-prompt flex flex-col items-center gap-2'
                      role='group'
                      aria-label='Pick a player to swap with'
                    >
                      <p className='text-xs'>Swap hands with:</p>
                      <div className='flex flex-wrap justify-center gap-2'>
                        {others
                          .filter((p) => !view.places.includes(p.seat))
                          .map(({ seat, count }) => (
                            <button
                              key={seat}
                              type='button'
                              onClick={() => {
                                r.move({
                                  type: 'play',
                                  index: swapping,
                                  target: seat,
                                });
                                setSwapping(null);
                              }}
                              disabled={r.busy}
                              className='uno-btn'
                            >
                              {seatName(seat)} · {count}
                            </button>
                          ))}
                        <button
                          type='button'
                          onClick={() => setSwapping(null)}
                          className='uno-btn uno-btn-quiet'
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {view.penalty > 0 && view.canDraw && !over && (
                    <button
                      type='button'
                      onClick={() => r.move({ type: 'draw' })}
                      disabled={r.busy}
                      className='a-wiggle uno-btn uno-btn-bad'
                    >
                      TAKE {view.penalty} CARDS
                    </button>
                  )}

                  {view.canChallenge && view.challenge && !over && (
                    <div
                      className='uno-prompt flex flex-col items-center gap-2 text-center'
                      role='group'
                      aria-label='Answer the +4'
                    >
                      <p className='text-sm'>
                        Challenge if you think {seatName(view.challenge.from)}{' '}
                        holds a{' '}
                        <span
                          className='inline-flex items-center gap-1 font-bold'
                          style={{ color: BG[view.challenge.color] }}
                        >
                          <ColorShape
                            color={view.challenge.color}
                            className='size-4'
                          />
                          {COLOR_NAME[view.challenge.color]}
                        </span>{' '}
                        card.
                      </p>
                      <p className='text-xs text-mute'>
                        Right: they draw 4. Wrong: you draw 6.
                      </p>
                      <div className='flex flex-wrap justify-center gap-2'>
                        <button
                          type='button'
                          onClick={() => r.move({ type: 'challenge' })}
                          disabled={r.busy}
                          className='uno-btn uno-btn-bad'
                        >
                          CHALLENGE!
                        </button>
                        <button
                          type='button'
                          onClick={() => r.move({ type: 'accept' })}
                          disabled={r.busy}
                          className='uno-btn'
                        >
                          Accept, draw 4
                        </button>
                      </div>
                    </div>
                  )}

                  {(view.stuck && view.canDraw) || view.canPass ? (
                    <div className='flex flex-wrap items-center justify-center gap-2'>
                      {view.stuck && view.canDraw && (
                        <button
                          type='button'
                          onClick={() => r.move({ type: 'draw' })}
                          disabled={r.busy}
                          className='a-bob uno-btn uno-btn-go'
                        >
                          draw a card
                        </button>
                      )}
                      {view.canPass && (
                        <button
                          type='button'
                          onClick={() => r.move({ type: 'pass' })}
                          disabled={r.busy}
                          className='uno-btn'
                        >
                          pass, keep it
                        </button>
                      )}
                    </div>
                  ) : null}

                  {!over && (view.canCallUno || catchable.length > 0) && (
                    <div className='flex flex-wrap items-center justify-center gap-2'>
                      {view.canCallUno && (
                        <button
                          type='button'
                          onClick={() => r.move({ type: 'uno' })}
                          disabled={r.busy}
                          aria-label='Call UNO'
                          aria-keyshortcuts='U'
                          className='a-bob uno-btn uno-btn-warn'
                        >
                          CALL UNO!
                          <kbd>U</kbd>
                        </button>
                      )}
                      {catchable.map((seat, i) => (
                        <button
                          key={seat}
                          type='button'
                          onClick={() =>
                            r.move({ type: 'catch', target: seat })
                          }
                          disabled={r.busy}
                          aria-keyshortcuts={i === 0 ? 'T' : undefined}
                          className='a-wiggle uno-btn uno-btn-bad'
                        >
                          CATCH {seatName(seat).toUpperCase()}!
                          {i === 0 && <kbd>T</kbd>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className='mx-auto flex h-7 w-full max-w-4xl shrink-0 items-center justify-center gap-2 px-1 text-xs text-mute'>
            <p
              className={`flex min-w-0 items-center gap-1.5 ${r.error ? 'text-err' : ''}`}
              data-testid='last-event'
            >
              {!r.error && view.last && (
                <EventIcon
                  kind={iconOf(view.last)}
                  className='size-4 shrink-0'
                />
              )}
              <span className='truncate'>
                {r.error || lastText(view, you, names, mercyLimit)}
              </span>
            </p>
            <button
              type='button'
              aria-label='How to play'
              onClick={() => setGuide(true)}
              className='flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface/70 text-xs font-bold text-ink transition-transform hover:scale-110'
            >
              ?
            </button>
            <div className='relative shrink-0'>
              <button
                type='button'
                aria-label='Send a reaction'
                aria-expanded={emoting}
                onClick={() => setEmoting((on) => !on)}
                className='flex size-6 items-center justify-center rounded-full border border-line-strong bg-surface/70 text-sm leading-none transition-transform hover:scale-110'
              >
                <span aria-hidden>😀</span>
              </button>
              {emoting && (
                <div
                  role='group'
                  aria-label='Reactions'
                  className='a-pop absolute bottom-full left-1/2 z-50 mb-2 flex -translate-x-1/2 gap-1 rounded-full border border-line-strong bg-card p-1 shadow-2xl'
                >
                  {EMOTES.map((e) => (
                    <button
                      key={e}
                      type='button'
                      aria-label={`React ${e}`}
                      onClick={() => {
                        setEmoting(false);
                        r.move({ type: 'emote', e });
                      }}
                      className='flex size-9 items-center justify-center rounded-full text-xl leading-none transition-transform hover:scale-125 active:scale-90'
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type='button'
              aria-label={sfx.muted ? 'Turn sound on' : 'Turn sound off'}
              aria-pressed={!sfx.muted}
              onClick={() => sfx.setMuted(!sfx.muted)}
              className='flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface/70 text-ink transition-transform hover:scale-110'
            >
              <svg
                viewBox='0 0 24 24'
                className='size-3.5'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
                aria-hidden
              >
                <path d='M4 9v6h4l5 4V5L8 9H4z' />
                {sfx.muted ? (
                  <path d='M17 9l5 6M22 9l-5 6' />
                ) : (
                  <path d='M17 8.5a5 5 0 0 1 0 7' />
                )}
              </svg>
            </button>
            {/* Flip: your cards have another side, and you may look at it */}
            {view.backs && view.hand.length > 0 && (
              <button
                type='button'
                aria-pressed={turned}
                onClick={() => setTurnedAt(turned ? -1 : version)}
                className='flex shrink-0 items-center gap-1 rounded-full border border-line-strong bg-surface/70 px-2.5 py-0.5 text-[11px] font-medium text-ink transition-colors hover:border-[var(--mute)]'
              >
                <EventIcon kind='flip' className='size-3.5' />
                {turned ? 'back to my hand' : `see ${otherSide} side`}
              </button>
            )}
          </div>

          <Hand
            hand={view.hand}
            backs={turned ? (view.backs?.[you] ?? null) : null}
            backSide={otherSide}
            isPlayable={(index) =>
              !r.busy &&
              (stack
                ? stack[0] === index || stackOptions.includes(index)
                : view.playable.includes(index))
            }
            dim={!over}
            orderOf={(index) => {
              const at = stack?.indexOf(index) ?? -1;
              return at === -1 ? undefined : at + 1;
            }}
            entry={entry}
            dropRef={pileRef}
            onDrag={setDrag}
            onPlay={playCard}
            onDrop={dropCard}
          />
        </div>

        {guide && (
          <UnoGuide
            game={game}
            mercyLimit={mercyLimit}
            turnSeconds={clock?.seconds}
            onClose={() => setGuide(false)}
          />
        )}

        <UnoKeys
          enabled={!over && !out && !r.busy}
          onUno={view.canCallUno ? () => r.move({ type: 'uno' }) : undefined}
          onCatch={
            catchable.length > 0
              ? () => r.move({ type: 'catch', target: catchable[0] })
              : undefined
          }
        />
      </LangProvider>
    </SideContext.Provider>
  );
}

export default function UnoGame({
  game,
  shell = true,
}: {
  game: UnoKind;
  /** Wrap in the game frame; off when the caller already provides one */
  shell?: boolean;
}) {
  const mounted = useMounted();
  const body = mounted ? (
    <>
      <Uno game={game} />
      <LangProvider value='en'>
        {/* up in the corner on a phone, so it never sits on your cards */}
        <RoomChat game={game} corner='top' />
      </LangProvider>
    </>
  ) : null;
  return shell ? (
    <GameShell name={game} fit>
      {body}
    </GameShell>
  ) : (
    body
  );
}
