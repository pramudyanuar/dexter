'use client';

import * as React from 'react';

import { Card, Color, COLORS, stackable, UnoView } from '@/lib/games/uno';
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

const BG: Record<Card['c'], string> = {
  R: 'hsl(2 75% 52%)',
  Y: 'hsl(46 95% 52%)',
  G: 'hsl(135 55% 40%)',
  B: 'hsl(215 75% 52%)',
  W: 'hsl(0 0% 14%)',
};
const DARK: Record<Card['c'], string> = {
  R: 'hsl(2 75% 36%)',
  Y: 'hsl(40 90% 40%)',
  G: 'hsl(135 55% 26%)',
  B: 'hsl(215 75% 36%)',
  W: 'hsl(0 0% 7%)',
};
const SYMBOL: Record<string, string> = {
  S: '⊘',
  V: '⇄',
  D: '+2',
  W: 'W',
  F: '+4',
};
const COLOR_NAME: Record<Color, string> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
};
const WILD_BG =
  'conic-gradient(from 45deg, hsl(2 75% 52%) 0 25%, hsl(46 95% 52%) 0 50%, hsl(135 55% 40%) 0 75%, hsl(215 75% 52%) 0 100%)';

const face = (card: Card) => SYMBOL[card.v] ?? card.v;
const describe = (card: Card) =>
  card.c === 'W'
    ? card.v === 'F'
      ? 'wild +4'
      : 'wild'
    : `${COLOR_NAME[card.c]} ${face(card)}`;

/** Card-face symbol, drawn as SVG so it stays crisp at any size. */
function Glyph({ v, className }: { v: string; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
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
  if (v === 'V') {
    return (
      <svg {...common} strokeWidth={2.6}>
        <path d='M4 9h14M14 5l4 4-4 4' />
        <path d='M20 15H6M10 11l-4 4 4 4' />
      </svg>
    );
  }
  return (
    <span className={`${className} leading-none font-black`} aria-hidden>
      {SYMBOL[v] ?? v}
    </span>
  );
}

function UnoCard({
  card,
  playable,
  dim,
  onClick,
  size = 'md',
  tilt = 0,
  animate,
  delay,
}: {
  card: Card;
  playable?: boolean;
  dim?: boolean;
  onClick?: () => void;
  size?: 'md' | 'lg';
  tilt?: number;
  animate?: 'deal' | 'play' | 'draw';
  /** ms to wait before the entry animation starts */
  delay?: number;
}) {
  const Tag = onClick ? 'button' : 'div';
  const wild = card.c === 'W';
  const big = size === 'lg';
  const small =
    card.v === 'D' || card.v === 'F' || card.v === 'S' || card.v === 'V';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-card={`${card.c}${card.v}`}
      data-playable={playable ? 'true' : undefined}
      aria-label={describe(card)}
      style={
        {
          background: wild ? WILD_BG : BG[card.c],
          color: card.c === 'Y' ? '#1b1b1b' : '#fff',
          '--tilt': `${tilt}deg`,
          animationDelay: delay ? `${delay}ms` : undefined,
          transform: animate ? undefined : `rotate(${tilt}deg)`,
        } as React.CSSProperties
      }
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-[3px] border-white font-black shadow-md transition-[transform,box-shadow,opacity] duration-200 select-none ${
        big ? 'h-32 w-[5.5rem]' : 'h-[5.25rem] w-14'
      } ${animate === 'deal' ? 'a-deal' : animate === 'play' ? 'a-play' : animate === 'draw' ? 'a-draw-in' : ''} ${
        playable
          ? 'z-10 -translate-y-2 cursor-pointer shadow-lg ring-2 ring-accent hover:-translate-y-4 hover:scale-110 hover:shadow-xl'
          : ''
      } ${dim ? 'brightness-50 saturate-50' : ''}`}
    >
      {/* tilted white oval, like a real card */}
      <span
        aria-hidden
        className='absolute inset-x-[10%] top-[8%] bottom-[8%] -rotate-[24deg] rounded-[50%] bg-white/95 shadow-inner'
      />
      <span
        aria-hidden
        style={{
          color: wild ? '#1b1b1b' : DARK[card.c],
          background: 'transparent',
        }}
        className='relative flex items-center justify-center'
      >
        <Glyph
          v={card.v}
          className={
            small
              ? big
                ? 'size-12 text-4xl'
                : 'size-8 text-2xl'
              : big
                ? 'text-6xl'
                : 'text-4xl'
          }
        />
      </span>
      {/* corner indexes */}
      <span
        aria-hidden
        className={`absolute top-1 left-1.5 leading-none drop-shadow ${
          big ? 'text-sm' : 'text-[10px]'
        }`}
      >
        {face(card)}
      </span>
      <span
        aria-hidden
        className={`absolute right-1.5 bottom-1 rotate-180 leading-none drop-shadow ${
          big ? 'text-sm' : 'text-[10px]'
        }`}
      >
        {face(card)}
      </span>
    </Tag>
  );
}

/** Face-down card: the draw pile, and other players' hands. */
function CardBack({
  size = 'md',
  className = '',
  style,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}) {
  const dims =
    size === 'lg'
      ? 'h-32 w-[5.5rem] text-2xl'
      : size === 'md'
        ? 'h-24 w-16 text-lg'
        : 'h-10 w-7 text-[9px]';
  return (
    <span
      aria-hidden
      style={{
        background: `linear-gradient(145deg, ${BG.W}, ${DARK.W})`,
        ...style,
      }}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-[3px] border-white font-black shadow-md ${dims} ${className}`}
    >
      <span className='absolute inset-x-[8%] top-[10%] bottom-[10%] -rotate-[24deg] rounded-[50%] bg-err' />
      <span className='relative -rotate-[24deg] text-hash italic drop-shadow'>
        UNO
      </span>
    </span>
  );
}

const ORDINAL = ['1st', '2nd', '3rd'];
const placeText = (place: number) =>
  `${ORDINAL[place] ?? `${place + 1}th`} place`;
/** "You draw", "Sari draws" */
const verb = (seat: number, you: number, base: string) =>
  seat === you ? base : `${base}s`;

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
/** Pixel offset a card flies in from (toward a seat) or out to (a draw). */
const offsetTo = (left: number, top: number) => ({
  x: ((left - 50) / 50) * 232,
  y: ((top - 50) / 50) * 150,
});

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
  | 'play';

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
    const v = e.card?.v;
    if (v === 'S') return 'skip';
    if (v === 'V') return 'reverse';
    if (v === 'D') return 'plus2';
    if (v === 'F') return 'plus4';
    if (v === 'W') return 'wild';
    return 'play';
  }
  if (e.kind === 'challenge') return e.caught ? 'caught' : 'wrong';
  if (e.kind === 'pass') return 'skip';
  return e.kind;
}

function lastText(view: UnoView, you: number, names: (string | null)[]) {
  const e = view.last;
  if (!e) return null;
  const who = seatNameFor('en', e.seat, you, names);
  const out = (seat: number) => {
    const place = view.places.indexOf(seat);
    return place !== -1 && view.counts[seat] === 0
      ? ` Out of cards: ${placeText(place)}!`
      : '';
  };
  if (e.kind === 'play' && e.card && e.cards) {
    const colors = e.cards
      .map((c) => (c.c === 'W' ? '' : COLOR_NAME[c.c]))
      .join(', ');
    return `${who} stacked ${e.cards.length} cards of ${face(e.card)} (${colors}).${out(e.seat)}`;
  }
  if (e.kind === 'play' && e.card) {
    return `${who} ${verb(e.seat, you, 'play')} ${describe(e.card)}${e.color ? `, color ${COLOR_NAME[e.color]}` : ''}.${out(e.seat)}`;
  }
  if (e.kind === 'draw') {
    return e.passed
      ? `${who} ${verb(e.seat, you, 'draw')} a card and ${verb(e.seat, you, 'pass')}.`
      : `${who} ${verb(e.seat, you, 'draw')} a card.`;
  }
  if (e.kind === 'uno') return `${who} ${verb(e.seat, you, 'call')} UNO!`;
  if (e.kind === 'accept')
    return `${who} ${verb(e.seat, you, 'accept')} the +4 and ${verb(e.seat, you, 'draw')} 4 cards.`;
  const target = seatNameFor('en', e.target ?? 0, you, names);
  if (e.kind === 'challenge') {
    return e.caught
      ? `${who} ${verb(e.seat, you, 'challenge')} ${target} and ${e.seat === you ? 'were' : 'was'} right! ${target} ${verb(e.target ?? 0, you, 'draw')} 4 cards.`
      : `${who} ${verb(e.seat, you, 'challenge')} ${target} but ${e.seat === you ? 'were' : 'was'} wrong and ${verb(e.seat, you, 'draw')} 6 cards.`;
  }
  if (e.kind === 'catch') {
    return `${who} ${verb(e.seat, you, 'catch')} ${target} forgetting UNO. ${target} ${verb(e.target ?? 0, you, 'draw')} 2 cards.`;
  }
  return `${who} ${verb(e.seat, you, 'skip')}.`;
}

type DragState = 'idle' | 'drag' | 'over';

/** A hand card you can click, or drag onto the discard pile. */
function HandCard({
  card,
  playable,
  dim,
  animate,
  delay,
  fan,
  dropRef,
  onPlay,
  onDrop,
  onDrag,
  order,
}: {
  card: Card;
  playable: boolean;
  dim: boolean;
  /** Played by dropping on the pile; defaults to onPlay */
  onDrop?: () => void;
  /** Position in a stack being built (1 = first), if selected */
  order?: number;
  animate?: 'deal' | 'draw';
  delay?: number;
  fan: number;
  dropRef: React.RefObject<HTMLDivElement | null>;
  onPlay: () => void;
  onDrag: (state: DragState) => void;
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  const [settling, setSettling] = React.useState(false);
  const origin = React.useRef<{ x: number; y: number } | null>(null);
  const moved = React.useRef(false);
  const handled = React.useRef(false);

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
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (!moved.current && Math.hypot(dx, dy) < 8) return;
    moved.current = true;
    setPos({ x: dx, y: dy });
    onDrag(isOver(e) ? 'over' : 'drag');
  };

  const finish = (e: React.PointerEvent, cancel = false) => {
    if (!origin.current) return;
    const drop = moved.current && !cancel && isOver(e);
    origin.current = null;
    onDrag('idle');
    if (drop) {
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
      className={`relative -mx-1.5 sm:-mx-1 ${playable ? 'touch-none' : ''}`}
      style={{
        zIndex: dragging ? 50 : undefined,
        transform: dragging
          ? `translate(${pos.x}px, ${pos.y}px) rotate(${pos.x * 0.06}deg) scale(1.18)`
          : `rotate(${fan}deg)`,
        transition: dragging
          ? 'none'
          : settling
            ? 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : undefined,
        cursor: playable ? (dragging ? 'grabbing' : 'grab') : undefined,
        filter: dragging
          ? 'drop-shadow(0 14px 14px rgb(0 0 0 / 0.35))'
          : undefined,
      }}
    >
      <UnoCard
        card={card}
        playable={playable && !dragging}
        dim={dim}
        animate={animate}
        delay={delay}
        onClick={playable ? onPlay : undefined}
      />
      {order !== undefined && (
        <span
          aria-hidden
          className='pointer-events-none absolute -top-4 left-1/2 z-20 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-black shadow'
        >
          {order}
        </span>
      )}
    </div>
  );
}

/** 1st / 2nd / 3rd on a podium, with any remaining places listed below. */
function Podium({
  places,
  you,
  names,
}: {
  places: number[];
  you: number;
  names: (string | null)[];
}) {
  // podium order: 2nd on the left, 1st in the middle, 3rd on the right
  const steps: { seat: number; rank: number }[] = [];
  if (places[1] !== undefined) steps.push({ seat: places[1], rank: 2 });
  if (places[0] !== undefined) steps.push({ seat: places[0], rank: 1 });
  if (places[2] !== undefined) steps.push({ seat: places[2], rank: 3 });
  const HEIGHT = { 1: 'h-24', 2: 'h-16', 3: 'h-12' } as const;

  return (
    <div className='a-slide-up mb-3'>
      <div className='flex items-end justify-center gap-2'>
        {steps.map(({ seat, rank }) => (
          <div
            key={seat}
            className='flex w-24 flex-col items-center justify-end'
          >
            <span
              className={`mb-1 max-w-full truncate text-xs ${
                seat === you ? 'font-semibold text-accent' : 'text-ink'
              }`}
            >
              {seatNameFor('en', seat, you, names)}
            </span>
            <div
              className={`flex w-full flex-col items-center justify-start gap-0.5 rounded-t-md border border-b-0 pt-2 ${
                HEIGHT[rank as 1 | 2 | 3]
              } ${
                rank === 1
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-line bg-card'
              }`}
            >
              <span
                className={`text-lg font-bold tabular-nums ${
                  rank === 1 ? 'text-accent' : 'text-ink'
                }`}
              >
                {rank}
              </span>
              {rank === 1 && (
                <span className='text-[10px] tracking-wide text-mute'>
                  winner
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {places.length > 3 && (
        <ol className='mx-auto mt-2 w-full max-w-xs text-center text-xs text-mute'>
          {places.slice(3).map((seat, i) => (
            <li key={seat}>
              #{i + 4} {seatNameFor('en', seat, you, names)}
            </li>
          ))}
        </ol>
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

function Uno() {
  const r = useRoom<UnoView>('uno');
  const [choosing, setChoosing] = React.useState<number | null>(null);
  /** Cards picked for a same-number stack, in play order */
  const [picked, setPicked] = React.useState<{
    version: number;
    cards: number[];
  } | null>(null);
  // anything new from the server (a move, a draw) ends a half-built stack
  const version = r.room?.version ?? 0;
  const stack = picked?.version === version ? picked.cards : null;
  const setStack = (cards: number[] | null) =>
    setPicked(cards ? { version, cards } : null);
  const [drag, setDrag] = React.useState<DragState>('idle');
  /** The room version whose results pop-up was closed */
  const [podiumClosed, setPodiumClosed] = React.useState(-1);
  const pileRef = React.useRef<HTMLDivElement>(null);

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Uno untuk 2 sampai 8 pemain di device berbeda. Pembuat room memulai permainan setelah semua bergabung.'
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  // taken out of the room (disconnected, or too many missed turns)
  if (r.room && r.room.seat === null) return <Removed r={r} />;

  const { room } = r;
  const you = r.session.you;
  const names = room?.names ?? [];
  const seatName = (seat: number) => seatNameFor('en', seat, you, names);
  const view = room?.state ?? null;
  const playing = room?.status === 'playing' || room?.status === 'over';

  // ------------------------------------------------------------ waiting room
  if (room && room.status === 'waiting') return <WaitingRoom r={r} />;

  if (!room || !view || !playing) {
    return (
      <>
        <RoomBar code={r.session.code} share={false} onLeave={r.leave} />
        <p className='text-center text-sm text-mute'>Connecting…</p>
        {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
      </>
    );
  }

  // ------------------------------------------------------------------- game
  const over = room.status === 'over';
  const myPlace = view.places.indexOf(you);
  const out = myPlace !== -1;
  const myTurn = !over && !out && view.turn === you;

  let banner: React.ReactNode;
  if (over) {
    banner =
      view.winner === you ? (
        <span className='text-accent'>You win!</span>
      ) : (
        <span className='text-err'>{seatName(view.winner ?? 0)} wins.</span>
      );
  } else if (out) {
    banner = (
      <span className='text-accent'>
        You are out of cards: {placeText(myPlace)}! Watching the rest…
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
    if (card.c === 'W') setChoosing(index);
    else if (!view.canPass && stackable(view.hand, index).length > 0)
      setStack([index]);
    else r.move({ type: 'play', index });
  };

  /** Dropping a card on the pile plays it, with the stack if one is open. */
  const dropCard = (index: number) => {
    if (!stack) {
      if (view.hand[index].c === 'W') setChoosing(index);
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

  // a card tossed onto the pile flies in from the player who played it
  const toss =
    view.last?.kind === 'play'
      ? (() => {
          const p = seatPos(view.last.seat, you, players);
          const o = offsetTo(p.left, p.top);
          return { x: o.x, y: o.y, spin: p.left < 50 ? 150 : -150 };
        })()
      : null;

  // cards pulled from the pile fly out to whoever drew them (+2/+4, draw, catch)
  const drew = view.last?.drew ?? null;
  const drewTo = drew
    ? (() => {
        const p = seatPos(drew.seat, you, players);
        return { ...offsetTo(p.left, p.top), count: Math.min(drew.count, 4) };
      })()
    : null;

  // a banner so skips, reverses and draws are obvious
  const effect = (() => {
    const e = view.last;
    if (!e) return null;
    const draws = (seat: number) => verb(seat, you, 'draw');
    if (e.kind === 'challenge') {
      const target = e.target ?? 0;
      return e.caught
        ? {
            icon: 'caught' as IconKind,
            big: 'BUSTED!',
            sub: `${seatName(target)} bluffed and ${draws(target)} 4 cards`,
            tone: 'text-accent',
          }
        : {
            icon: 'wrong' as IconKind,
            big: 'WRONG GUESS!',
            sub: `${seatName(e.seat)} ${draws(e.seat)} 6 cards`,
            tone: 'text-err',
          };
    }
    if (e.kind !== 'play' || !e.card) return null;
    const v = e.card.v;
    const who = seatName(e.seat);
    const victimSeat = e.drew?.seat ?? view.challenge?.victim ?? -1;
    const victim = seatName(victimSeat);
    if (v === 'S')
      return {
        icon: 'skip' as IconKind,
        big: 'SKIPPED!',
        sub: who,
        tone: 'text-err',
      };
    if (v === 'V')
      return {
        icon: 'reverse' as IconKind,
        big: 'REVERSE!',
        sub: who,
        tone: 'text-info',
      };
    if (v === 'D')
      return {
        icon: 'plus2' as IconKind,
        big: '+2',
        sub: `${victim} ${draws(victimSeat)} 2 cards`,
        tone: 'text-hash',
      };
    if (v === 'F') {
      return {
        icon: 'plus4' as IconKind,
        big: '+4',
        sub: view.challenge
          ? `${victim}: accept or challenge?`
          : `${victim} ${draws(victimSeat)} 4 cards`,
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

  return (
    <LangProvider value='en'>
      {view.winner === you && <Confetti />}
      {over && view.places.length > 0 && podiumClosed !== version && (
        <div
          role='dialog'
          aria-label='Results'
          className='a-pop fixed top-24 left-1/2 z-[65] w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-line-strong bg-card p-5 shadow-2xl'
        >
          <button
            type='button'
            onClick={() => setPodiumClosed(version)}
            aria-label='Close'
            className='absolute top-2 right-3 text-mute hover:text-ink'
          >
            ×
          </button>
          <Podium places={view.places} you={you} names={names} />
          <div className='mt-3 flex justify-center'>
            <button
              type='button'
              onClick={r.rematch}
              disabled={r.busy}
              className='rounded-full border-2 border-accent bg-accent/15 px-6 py-2 font-semibold text-accent'
            >
              Play again
            </button>
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
              : `${view.counts[seat]} ${view.counts[seat] === 1 ? 'card' : 'cards'}`}
          </span>
        )}
      />

      {/* a fixed-height strip, so whatever it says never moves the table */}
      <div className='mb-2 h-[4.25rem]'>
        <p
          key={`${over}-${myTurn}-${view.turn}`}
          className='a-slide-up text-center text-sm'
          aria-live='polite'
        >
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
        />
      </div>

      {/* ------------------------------------------------- the table */}
      <div className='relative mx-auto mb-3 h-[21rem] w-full max-w-lg sm:h-80'>
        {/* felt */}
        <div className='absolute inset-6 rounded-[40%] border border-line bg-card/50 sm:inset-8' />
        {/* arrows of dashes flowing around the felt the way play goes; a reverse flashes it */}
        <svg
          key={`${view.dir}-${view.last?.kind === 'play' && view.last.card?.v === 'V' ? version : 0}`}
          aria-hidden
          data-testid='direction'
          data-dir={view.dir}
          viewBox='0 0 100 100'
          preserveAspectRatio='none'
          className={`pointer-events-none absolute inset-6 size-[calc(100%-3rem)] overflow-visible sm:inset-8 sm:size-[calc(100%-4rem)] ${
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
            rx='40'
            ry='40'
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

        {others.map(({ count, seat }) => {
          const active = !over && view.turn === seat;
          const place = view.places.indexOf(seat);
          const pos = seatPos(seat, you, players);
          const safe = count === 1 && view.calledUno[seat];
          const canCatch = view.catchable.includes(seat) && !over;
          const shown = Math.min(count, 6);
          const just =
            !over &&
            view.last?.kind === 'play' &&
            view.last.seat === seat &&
            !!view.last.card;
          const got = !over && view.last?.drew?.seat === seat;
          const lit = just || got;
          return (
            <div
              key={seat}
              data-seat={seat}
              className='absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1'
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <span
                key={lit ? `hit-${version}` : 'idle'}
                className={`max-w-full truncate rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  just ? 'a-hit' : ''
                }${
                  active
                    ? 'a-glow border-accent bg-accent/15 text-ink'
                    : lit
                      ? 'border-accent text-ink'
                      : 'border-line text-mute'
                }`}
              >
                {seatName(seat)}
              </span>
              <div
                aria-hidden
                className='flex h-8 items-center justify-center'
                style={{ width: 18 + shown * 6 }}
              >
                {Array.from({ length: shown }, (_, i) => (
                  <CardBack
                    key={i}
                    size='sm'
                    className='-ml-4 first:ml-0'
                    style={{ rotate: `${(i - shown / 2) * 5}deg` }}
                  />
                ))}
              </div>
              <span className='flex items-center gap-1 text-sm font-semibold text-ink'>
                {count}
                {lit && (
                  <span
                    key={`just-${version}`}
                    className={`a-pop rounded-full px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                      got ? 'bg-err text-paper' : 'bg-accent text-paper'
                    }`}
                  >
                    {got
                      ? `+${view.last!.drew!.count}`
                      : `main ${face(view.last!.card!)}`}
                  </span>
                )}
              </span>
              {place !== -1 ? (
                <span className='text-[11px] font-bold text-accent'>
                  {place === 0 ? 'winner' : `#${place + 1}`}
                </span>
              ) : canCatch ? (
                <span className='a-wiggle text-[11px] text-err'>
                  forgot UNO!
                </span>
              ) : safe ? (
                <span className='text-[11px] font-bold text-accent'>UNO ✓</span>
              ) : null}
            </div>
          );
        })}

        {/* cards pulled from the pile, flying to whoever drew them */}
        {drewTo && (
          <div key={`drew-${version}`} aria-hidden>
            {Array.from({ length: drewTo.count }, (_, i) => (
              <div
                key={i}
                className='a-draw absolute top-1/2 left-1/2'
                style={
                  {
                    '--to-x': `${drewTo.x}px`,
                    '--to-y': `${drewTo.y}px`,
                    '--spin': `${(i - 1) * 20}deg`,
                    animationDelay: `${i * 90}ms`,
                  } as React.CSSProperties
                }
              >
                <CardBack size='sm' />
              </div>
            ))}
          </div>
        )}

        {/* what the last action card did */}
        {effect && !over && (
          <div
            key={`fx-${version}`}
            aria-hidden
            className='a-fx pointer-events-none fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/35'
          >
            <EventIcon
              kind={effect.icon}
              className={`mb-2 size-24 drop-shadow-[0_6px_0_rgb(0_0_0/0.45)] sm:size-32 ${effect.tone}`}
            />
            <span
              className={`text-6xl font-black tracking-tight drop-shadow-[0_6px_0_rgb(0_0_0/0.45)] sm:text-8xl ${effect.tone}`}
            >
              {effect.big}
            </span>
            <span className='mt-2 rounded-full bg-paper/90 px-4 py-1 text-base font-semibold text-ink sm:text-xl'>
              {effect.sub}
            </span>
          </div>
        )}

        {/* center: draw pile, discard pile, colour */}
        <div className='absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-7'>
          <button
            type='button'
            aria-label='Draw a card'
            disabled={!view.canDraw || r.busy}
            onClick={() => r.move({ type: 'draw' })}
            className='group relative flex h-32 w-[5.25rem] items-center justify-center disabled:opacity-70'
          >
            {/* a stack: the more cards left, the taller it looks */}
            {Array.from({ length: layers }, (_, i) => {
              const top = i === layers - 1;
              const back = (i - layers + 1) * 2.5;
              return (
                <span
                  key={i}
                  className='absolute'
                  style={{
                    translate: `${back}px ${-back}px`,
                    rotate: top ? undefined : `${i % 2 ? 1.2 : -1.2}deg`,
                  }}
                >
                  <CardBack
                    size='lg'
                    className={`scale-[0.8] ${
                      top && view.canDraw && !r.busy
                        ? 'a-bob ring-2 ring-accent group-hover:scale-[0.86]'
                        : top
                          ? 'transition-transform group-hover:scale-[0.84]'
                          : 'brightness-75'
                    }`}
                  />
                </span>
              );
            })}
            <span className='relative mt-[8.5rem] rounded-full bg-paper/90 px-2 py-0.5 text-[11px] whitespace-nowrap'>
              draw · {view.drawCount}
            </span>
          </button>

          <div
            ref={pileRef}
            data-testid='pile'
            data-drop={drag}
            className={`relative h-32 w-24 rounded-xl transition-all duration-200 ${
              drag === 'over'
                ? 'scale-105 bg-accent/20 ring-4 ring-accent'
                : drag === 'drag'
                  ? 'a-glow ring-dashed bg-accent/10 ring-2 ring-accent/60'
                  : ''
            }`}
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
              return (
                <div
                  key={`${card.c}${card.v}-${i}`}
                  className='absolute top-1/2 left-1/2'
                  style={{
                    zIndex: i,
                    transform: `translate(-50%, -50%) translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)`,
                  }}
                >
                  <div className='scale-[0.8]'>
                    {isTop && toss ? (
                      <div
                        key={version}
                        className='a-toss'
                        style={
                          {
                            '--from-x': `${toss.x}px`,
                            '--from-y': `${toss.y}px`,
                            '--spin': `${toss.spin}deg`,
                          } as React.CSSProperties
                        }
                      >
                        <UnoCard card={card} size='lg' />
                      </div>
                    ) : (
                      <UnoCard card={card} size='lg' />
                    )}
                  </div>
                </div>
              );
            })}
            <span
              key={view.color}
              data-color={view.color}
              aria-label={`color ${COLOR_NAME[view.color]}`}
              className='a-pop absolute -right-2 -bottom-2 z-50 size-6 rounded-full border-2 border-white shadow-md'
              style={{ background: BG[view.color] }}
            />
          </div>
        </div>
      </div>

      <p
        className='mt-1 mb-2 flex h-5 items-center justify-center gap-1.5 text-xs text-mute'
        data-testid='last-event'
      >
        {view.last && <EventIcon kind={iconOf(view.last)} className='size-4' />}
        {lastText(view, you, names)}
      </p>

      {/* prompts and actions live in one reserved zone, so the hand stays put */}
      <div className='mb-2 flex min-h-[9.5rem] flex-col items-center justify-center gap-2'>
        {stack && (
          <div
            className='flex flex-col items-center gap-2 text-center'
            role='group'
            aria-label='Stack cards'
          >
            <p className='text-xs text-mute'>
              Stacking {face(view.hand[stack[0]])}s: pick more{' '}
              {face(view.hand[stack[0]])} cards. The last card sets the color.
            </p>
            <div className='flex gap-3 text-xs'>
              <button
                type='button'
                onClick={() => playStack(stack)}
                disabled={r.busy}
                className='text-info'
              >
                play {stack.length} {stack.length === 1 ? 'card' : 'cards'}
              </button>
              {stack.length < stackOptions.length + 1 && (
                <button
                  type='button'
                  onClick={() => playStack([stack[0], ...stackOptions])}
                  disabled={r.busy}
                  className='text-mute'
                >
                  stack all ({stackOptions.length + 1})
                </button>
              )}
              <button
                type='button'
                onClick={() => setStack(null)}
                className='text-mute'
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {choosing !== null && (
          <div
            className='flex flex-col items-center gap-2'
            role='group'
            aria-label='Pick a color'
          >
            <p className='text-xs'>Pick a color:</p>
            <div className='flex gap-2'>
              {COLORS.map((color) => (
                <button
                  key={color}
                  type='button'
                  aria-label={`Color ${COLOR_NAME[color]}`}
                  data-pick-color={color}
                  onClick={() => {
                    r.move({ type: 'play', index: choosing, color });
                    setChoosing(null);
                  }}
                  className='size-11 rounded-full border-2 border-white shadow-md transition-transform hover:scale-125 active:scale-95'
                  style={{ background: BG[color] }}
                />
              ))}
              <button
                type='button'
                onClick={() => setChoosing(null)}
                className='px-2 text-xs text-mute hover:text-ink'
              >
                cancel
              </button>
            </div>
          </div>
        )}

        {view.canChallenge && view.challenge && !over && (
          <div
            className='flex flex-col items-center gap-2 text-center'
            role='group'
            aria-label='Answer the +4'
          >
            <p className='text-sm'>
              Challenge if you think {seatName(view.challenge.from)} holds a{' '}
              <span
                className='font-bold'
                style={{ color: BG[view.challenge.color] }}
              >
                {COLOR_NAME[view.challenge.color]}
              </span>{' '}
              card.
            </p>
            <p className='text-xs text-mute'>
              Right: they draw 4. Wrong: you draw 6.
            </p>
            <div className='flex gap-3'>
              <button
                type='button'
                onClick={() => r.move({ type: 'challenge' })}
                disabled={r.busy}
                className='rounded-full border-2 border-err bg-err/15 px-6 py-2 font-black text-err'
              >
                CHALLENGE!
              </button>
              <button
                type='button'
                onClick={() => r.move({ type: 'accept' })}
                disabled={r.busy}
                className='rounded-full border-2 border-line-strong px-6 py-2 font-semibold'
              >
                Accept, draw 4
              </button>
            </div>
          </div>
        )}

        {(view.stuck && view.canDraw) || view.canPass ? (
          <div className='flex items-center justify-center gap-4 text-xs'>
            {view.stuck && view.canDraw && (
              <button
                type='button'
                onClick={() => r.move({ type: 'draw' })}
                disabled={r.busy}
                className='a-bob text-info hover:underline'
              >
                draw a card
              </button>
            )}
            {view.canPass && (
              <button
                type='button'
                onClick={() => r.move({ type: 'pass' })}
                disabled={r.busy}
                className='text-info hover:underline'
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
                className='a-bob rounded-full border-2 border-hash bg-hash/15 px-6 py-2 text-base font-black tracking-wider text-hash'
              >
                CALL UNO!
                <kbd className='ml-2 rounded border border-hash/60 px-1.5 text-xs font-bold'>
                  U
                </kbd>
              </button>
            )}
            {catchable.map((seat, i) => (
              <button
                key={seat}
                type='button'
                onClick={() => r.move({ type: 'catch', target: seat })}
                disabled={r.busy}
                aria-keyshortcuts={i === 0 ? 'T' : undefined}
                className='a-wiggle rounded-full border-2 border-err bg-err/15 px-5 py-2 text-base font-black text-err'
              >
                CATCH {seatName(seat).toUpperCase()}!
                {i === 0 && (
                  <kbd className='ml-2 rounded border border-err/60 px-1.5 text-xs font-bold'>
                    T
                  </kbd>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        data-testid='hand'
        aria-label='Your hand'
        className='mt-auto flex flex-wrap justify-center gap-y-2 px-3 pt-6'
      >
        {view.hand.map((card, index) => {
          const playable = stack
            ? stack[0] === index || stackOptions.includes(index)
            : view.playable.includes(index);
          const order = stack?.indexOf(index) ?? -1;
          const mid = (view.hand.length - 1) / 2;
          return (
            <HandCard
              key={`${index}-${card.c}${card.v}`}
              card={card}
              playable={playable && !r.busy}
              dim={!over && !playable}
              animate={
                drewMine && index >= view.hand.length - drewMine
                  ? 'draw'
                  : !view.last
                    ? 'deal'
                    : undefined
              }
              delay={
                drewMine && index >= view.hand.length - drewMine
                  ? 450 + (index - (view.hand.length - drewMine)) * 140
                  : !view.last
                    ? index * 70
                    : undefined
              }
              fan={(index - mid) * 1.5}
              dropRef={pileRef}
              onDrag={setDrag}
              onPlay={() => playCard(index)}
              onDrop={() => dropCard(index)}
              order={order === -1 ? undefined : order + 1}
            />
          );
        })}
      </div>

      <UnoKeys
        enabled={!over && !out && !r.busy}
        onUno={view.canCallUno ? () => r.move({ type: 'uno' }) : undefined}
        onCatch={
          catchable.length > 0
            ? () => r.move({ type: 'catch', target: catchable[0] })
            : undefined
        }
      />

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
    </LangProvider>
  );
}

export default function UnoPage() {
  const mounted = useMounted();

  return (
    <GameShell name='uno' wide>
      {mounted ? (
        <>
          <Uno />
          <LangProvider value='en'>
            <RoomChat game='uno' />
          </LangProvider>
        </>
      ) : null}
    </GameShell>
  );
}
