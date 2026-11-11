'use client';

import * as React from 'react';

import { Card, Color, COLORS, stackable, UnoView } from '@/lib/games/uno';
import { useOfflineUno } from '@/lib/games/useOfflineUno';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import { NameEditor, seatLabel, seatTitle } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';

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
  R: 'merah',
  Y: 'kuning',
  G: 'hijau',
  B: 'biru',
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
}: {
  card: Card;
  playable?: boolean;
  dim?: boolean;
  onClick?: () => void;
  size?: 'md' | 'lg';
  tilt?: number;
  animate?: 'deal' | 'play';
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
          transform: animate ? undefined : `rotate(${tilt}deg)`,
        } as React.CSSProperties
      }
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-[3px] border-white font-black shadow-md transition-[transform,box-shadow,opacity] duration-200 select-none ${
        big ? 'h-32 w-[5.5rem]' : 'h-[5.25rem] w-14'
      } ${animate === 'deal' ? 'a-deal' : animate === 'play' ? 'a-play' : ''} ${
        playable
          ? 'z-10 -translate-y-2 cursor-pointer shadow-lg ring-2 ring-accent hover:-translate-y-4 hover:scale-110 hover:shadow-xl'
          : ''
      } ${dim ? 'opacity-50 saturate-50' : ''}`}
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

/** A distinct, muted hue per seat for its avatar tile. */
const SEAT_HUE = [
  '#c6504e',
  '#c58a33',
  '#3f9460',
  '#4471c2',
  '#8f5bc0',
  '#c25c93',
  '#3f9fb0',
  '#86993f',
];

/** A generic player portrait: the initial on a coloured tile. No game art. */
function Avatar({
  seat,
  label,
  active,
}: {
  seat: number;
  label: string;
  active: boolean;
}) {
  const initial = (label.trim()[0] ?? String(seat + 1)).toUpperCase();
  const hue = SEAT_HUE[seat % SEAT_HUE.length];
  return (
    <span
      aria-hidden
      className={`relative flex size-11 items-center justify-center rounded-xl border text-lg font-bold text-white shadow-md transition-transform ${
        active ? 'a-glow scale-105 border-accent' : 'border-white/15'
      }`}
      style={{
        background: `linear-gradient(150deg, ${hue}, color-mix(in oklab, ${hue} 62%, #000))`,
      }}
    >
      {/* a soft top highlight so the tile reads as a rounded chip */}
      <span className='absolute inset-x-1 top-1 h-1/3 rounded-md bg-white/15' />
      <span className='relative drop-shadow'>{initial}</span>
    </span>
  );
}

/** A little card-shaped badge showing how many cards a player holds. */
function CountCard({ count }: { count: number }) {
  return (
    <span
      className='flex h-6 min-w-5 items-center justify-center rounded-[5px] border-2 border-white bg-[#17181d] px-1 text-xs font-bold text-white shadow'
      aria-label={`${count} kartu`}
    >
      {count}
    </span>
  );
}

/** The current-colour wheel: four wedges, the colour in play popped forward. */
function ColorWheel({
  color,
  className,
}: {
  color: Color;
  className?: string;
}) {
  const C = 50;
  const R = 46;
  const pt = (deg: number): [number, number] => [
    C + R * Math.cos((deg * Math.PI) / 180),
    C + R * Math.sin((deg * Math.PI) / 180),
  ];
  const wedge = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${C} ${C} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };
  // seams on the diagonals: top, right, bottom, left quadrants
  const WEDGE: { c: Color; a: [number, number] }[] = [
    { c: 'R', a: [225, 315] },
    { c: 'Y', a: [315, 405] },
    { c: 'B', a: [45, 135] },
    { c: 'G', a: [135, 225] },
  ];
  return (
    <svg
      viewBox='0 0 100 100'
      className={className}
      aria-label={`warna ${COLOR_NAME[color]}`}
    >
      {WEDGE.map(({ c, a }) => {
        const on = c === color;
        return (
          <path
            key={c}
            d={wedge(a[0], a[1])}
            fill={BG[c]}
            opacity={on ? 1 : 0.26}
            style={{
              transformOrigin: '50px 50px',
              transform: on ? 'scale(1.05)' : 'scale(0.9)',
              transition:
                'transform 0.3s var(--ease), opacity 0.3s var(--ease)',
            }}
          />
        );
      })}
      <circle cx={C} cy={C} r='13' fill='var(--paper)' />
      <circle
        cx={C}
        cy={C}
        r='13'
        fill='none'
        stroke='rgb(255 255 255 / 0.12)'
      />
    </svg>
  );
}

const ORDINAL = ['pertama', 'kedua', 'ketiga', 'keempat'];
const placeText = (place: number) => `juara ${ORDINAL[place] ?? place + 1}`;

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
    top: 50 + 39 * Math.sin(angle),
    angle,
  };
}
/** Pixel offset a card flies in from (toward a seat) or out to (a draw). */
const offsetTo = (left: number, top: number) => ({
  x: ((left - 50) / 50) * 232,
  y: ((top - 50) / 50) * 150,
});

function lastText(view: UnoView, you: number, names: (string | null)[]) {
  const e = view.last;
  if (!e) return null;
  const who = seatLabel(e.seat, you, names);
  if (e.kind === 'play' && e.card && e.cards) {
    const place = view.places.indexOf(e.seat);
    const done =
      place !== -1 && view.counts[e.seat] === 0
        ? ` Kartunya habis, ${placeText(place)}!`
        : '';
    const colors = e.cards
      .map((c) => (c.c === 'W' ? '' : COLOR_NAME[c.c]))
      .join(', ');
    return `${who} menumpuk ${e.cards.length} kartu ${face(e.card)} (${colors}).${done}`;
  }
  if (e.kind === 'play' && e.card) {
    const place = view.places.indexOf(e.seat);
    const done =
      place !== -1 && view.counts[e.seat] === 0
        ? ` Kartunya habis, ${placeText(place)}!`
        : '';
    return `${who} memainkan ${describe(e.card)}${e.color ? `, warna ${COLOR_NAME[e.color]}` : ''}.${done}`;
  }
  if (e.kind === 'draw') {
    return e.passed
      ? `${who} menarik kartu dan melewati giliran.`
      : `${who} menarik kartu.`;
  }
  if (e.kind === 'uno') return `${who} teriak UNO!`;
  if (e.kind === 'catch') {
    const caught = seatLabel(e.target ?? 0, you, names);
    return `${who} menangkap ${caught} yang lupa teriak UNO. ${caught} tarik 2 kartu.`;
  }
  return `${who} melewati giliran.`;
}

type DragState = 'idle' | 'drag' | 'over';

/** A hand card you can click, or drag onto the discard pile. */
function HandCard({
  card,
  playable,
  dim,
  animate,
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
  animate?: 'deal';
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
              {seatTitle(seat, you, names)}
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
                  juara
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
              #{i + 4} {seatTitle(seat, you, names)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Uno() {
  const online = useRoom<UnoView>('uno');
  const offline = useOfflineUno();
  // play against AI locally, or against people in a room; same board either way
  const r = offline.active ? offline : online;
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
  const pileRef = React.useRef<HTMLDivElement>(null);

  if (!r.session) {
    return (
      <>
        <RoomLobby
          blurb='# Uno untuk 2 sampai 8 pemain di device berbeda. Pembuat room memulai permainan setelah semua bergabung.'
          busy={online.busy}
          error={online.error}
          name={online.name}
          onName={online.setName}
          onCreate={online.create}
          onJoin={online.join}
        />
        <div className='mt-6 rounded-xl border border-line bg-surface/40 p-4'>
          <p className='text-sm font-medium'>Main sendiri lawan AI</p>
          <p className='mt-0.5 text-sm text-mute'>
            Langsung main offline, pilih jumlah lawan bot.
          </p>
          <div className='mt-3 flex flex-wrap gap-2 text-xs'>
            {[1, 2, 3, 5, 7].map((bots) => (
              <button
                key={bots}
                type='button'
                onClick={() => offline.begin(bots)}
                className='text-mute'
              >
                {bots} bot
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  const { room } = r;
  const you = r.session.you;
  const names = room?.names ?? [];
  const seatName = (seat: number) => seatLabel(seat, you, names);
  const view = room?.state ?? null;
  const playing = room?.status === 'playing' || room?.status === 'over';

  // ------------------------------------------------------------ waiting room
  if (room && room.status === 'waiting') {
    const joined = room.joined.filter(Boolean).length;
    return (
      <>
        <RoomBar code={r.session.code} share onLeave={r.leave} />
        <p className='mb-3 text-center text-sm' aria-live='polite'>
          Menunggu pemain ({joined}/{room.capacity})
        </p>
        <ul className='mx-auto w-full max-w-xs divide-y divide-line border-y border-line'>
          {room.joined.map((taken, seat) => (
            <li
              key={seat}
              className='flex items-center justify-between py-2 text-sm'
            >
              <span className={taken ? '' : 'text-mute'}>
                {taken
                  ? seatTitle(seat, you, names)
                  : `kursi ${seat + 1} kosong`}
              </span>
              {seat === 0 && taken ? (
                <span className='text-hash'>pembuat</span>
              ) : you === 0 && taken ? (
                <button
                  type='button'
                  onClick={() => r.kick(seat)}
                  disabled={r.busy}
                  className='text-xs text-err hover:underline disabled:opacity-40'
                >
                  keluarkan
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <div className='mt-4 text-center text-xs'>
          {you === 0 ? (
            <button
              type='button'
              onClick={r.start}
              disabled={r.busy || joined < room.minPlayers}
              className='text-info hover:underline disabled:opacity-40'
            >
              mulai dengan {joined} pemain
            </button>
          ) : (
            <span className='text-mute'>Menunggu pembuat room memulai…</span>
          )}
          {you === 0 && joined < room.minPlayers && (
            <p className='mt-1 text-mute'>
              Butuh minimal {room.minPlayers} pemain.
            </p>
          )}
        </div>
        <NameEditor r={r} />
        {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}
      </>
    );
  }

  if (!room || !view || !playing) {
    return (
      <>
        <RoomBar code={r.session.code} share={false} onLeave={r.leave} />
        <p className='text-center text-sm text-mute'>Menghubungkan…</p>
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
        <span className='text-accent'>Kamu menang!</span>
      ) : (
        <span className='text-err'>{seatName(view.winner ?? 0)} menang.</span>
      );
  } else if (out) {
    banner = (
      <span className='text-accent'>
        Kartumu habis, kamu {placeText(myPlace)}! Menonton yang lain… (giliran{' '}
        {seatName(view.turn)})
      </span>
    );
  } else if (view.stuck) {
    banner = (
      <span className='text-hash'>
        Tidak ada kartu yang cocok. Tarik kartu dari tumpukan.
      </span>
    );
  } else if (myTurn) {
    banner = <span className='text-accent'>Giliranmu</span>;
  } else {
    banner = <span className='text-mute'>Giliran {seatName(view.turn)}…</span>;
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
    if (!e || e.kind !== 'play' || !e.card) return null;
    const v = e.card.v;
    const victim = e.drew ? seatName(e.drew.seat) : '';
    if (v === 'S') return '⊘ Dilewati!';
    if (v === 'V') return '⇄ Arah dibalik!';
    if (v === 'D') return `+2 · ${victim} tarik 2`;
    if (v === 'F') return `+4 · ${victim} tarik 4`;
    if (v === 'W' || e.card.c === 'W')
      return `Wild! Warna jadi ${COLOR_NAME[view.color]}`;
    return null;
  })();

  return (
    <>
      {view.winner === you && <Confetti />}
      <RoomBar
        code={r.session.code}
        share={false}
        onLeave={r.leave}
        right={
          <span className='text-mute'>
            {view.dir === 1 ? 'searah jarum jam ↻' : 'berlawanan ↺'}
          </span>
        }
      />

      <p
        key={`${over}-${myTurn}-${view.turn}`}
        className='a-slide-up mb-3 text-center text-sm'
        aria-live='polite'
      >
        {banner}
      </p>

      {/* ------------------------------------------------- the table */}
      <div className='relative mx-auto mb-3 h-[21rem] w-full max-w-lg sm:h-80'>
        {/* a dark round table: a faint lift in the middle, a soft rim */}
        <div
          className='absolute inset-4 rounded-[46%] border border-line-strong/70 sm:inset-6'
          style={{
            background:
              'radial-gradient(60% 60% at 50% 42%, rgba(86,201,138,0.06), rgba(255,255,255,0.015) 45%, transparent 72%), var(--surface)',
            boxShadow:
              'inset 0 0 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        />

        {others.map(({ count, seat }) => {
          const active = !over && view.turn === seat;
          const place = view.places.indexOf(seat);
          const pos = seatPos(seat, you, players);
          const safe = count === 1 && view.calledUno[seat];
          const canCatch = view.catchable.includes(seat) && !over;
          const shown = Math.min(count, 6);
          return (
            <div
              key={seat}
              data-seat={seat}
              className='absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1'
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <span
                className={`max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  active ? 'bg-accent text-[#10110f]' : 'bg-surface text-mute'
                }`}
              >
                {seatName(seat)}
              </span>
              {/* a short fan of card backs behind the portrait */}
              <div
                aria-hidden
                className='flex h-5 items-end justify-center'
                style={{ width: 20 + shown * 5 }}
              >
                {Array.from({ length: shown }, (_, i) => (
                  <CardBack
                    key={i}
                    size='sm'
                    className='-ml-4 h-6 w-4 first:ml-0'
                    style={{ rotate: `${(i - shown / 2) * 6}deg` }}
                  />
                ))}
              </div>
              <div className='relative -mt-1'>
                <Avatar seat={seat} label={seatName(seat)} active={active} />
                <span className='absolute -right-2 -bottom-1'>
                  <CountCard count={count} />
                </span>
              </div>
              {place !== -1 ? (
                <span className='text-[11px] font-bold text-accent'>
                  {place === 0 ? 'juara' : `ke-${place + 1}`}
                </span>
              ) : canCatch ? (
                <button
                  type='button'
                  onClick={() => r.move({ type: 'catch', target: seat })}
                  disabled={r.busy}
                  className='a-wiggle text-[11px] text-err'
                >
                  tangkap!
                </button>
              ) : safe ? (
                <span className='text-[11px] font-bold text-accent'>UNO!</span>
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
            className='a-pop pointer-events-none absolute top-[14%] left-1/2 z-50 -translate-x-1/2 rounded-full border border-hash bg-paper/95 px-3 py-1 text-xs font-bold whitespace-nowrap text-hash shadow-lg'
          >
            {effect}
          </div>
        )}

        {/* center: draw pile, discard pile, colour */}
        <div className='absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5'>
          <button
            type='button'
            aria-label='Tarik kartu'
            disabled={!view.canDraw || r.busy}
            onClick={() => r.move({ type: 'draw' })}
            className='group relative flex h-28 w-[4.75rem] items-center justify-center disabled:opacity-70'
          >
            <CardBack
              size='lg'
              className='absolute translate-x-1 translate-y-1 opacity-70'
            />
            <CardBack
              size='lg'
              className={
                view.canDraw && !r.busy
                  ? 'a-bob absolute ring-2 ring-accent group-hover:scale-105'
                  : 'absolute'
              }
            />
            <span className='relative mt-24 rounded-full bg-paper/90 px-2 py-0.5 text-[11px] whitespace-nowrap'>
              tarik · {view.drawCount}
            </span>
          </button>

          <div
            ref={pileRef}
            data-testid='pile'
            data-drop={drag}
            className={`relative h-36 w-28 rounded-xl transition-all duration-200 ${
              drag === 'over'
                ? 'scale-105 bg-accent/20 ring-4 ring-accent'
                : drag === 'drag'
                  ? 'a-glow ring-dashed bg-accent/10 ring-2 ring-accent/60'
                  : ''
            }`}
          >
            {drag !== 'idle' && (
              <span className='a-fade absolute -top-5 left-1/2 z-50 -translate-x-1/2 text-xs whitespace-nowrap text-accent'>
                {drag === 'over' ? 'lepas!' : 'seret ke sini'}
              </span>
            )}
            {/* the current-colour wheel, sitting behind the pile */}
            <ColorWheel
              color={view.color}
              className='pointer-events-none absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_6px_18px_rgba(0,0,0,0.5)]'
            />
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
              );
            })}
          </div>
        </div>
      </div>

      <p
        className='mb-3 min-h-4 text-center text-xs text-mute'
        data-testid='last-event'
      >
        {lastText(view, you, names)}
      </p>

      {over && view.places.length > 0 && (
        <Podium places={view.places} you={you} names={names} />
      )}

      {stack && (
        <div
          className='a-slide-up mb-3 flex flex-col items-center gap-2 text-center'
          role='group'
          aria-label='Tumpuk kartu'
        >
          <p className='text-xs text-mute'>
            Tumpuk kartu {face(view.hand[stack[0]])}: pilih kartu{' '}
            {face(view.hand[stack[0]])} lain. Warna kartu terakhir yang berlaku.
          </p>
          <div className='flex gap-2 text-xs'>
            <button
              type='button'
              onClick={() => playStack(stack)}
              disabled={r.busy}
              className='text-info'
            >
              mainkan {stack.length} kartu
            </button>
            {stack.length < stackOptions.length + 1 && (
              <button
                type='button'
                onClick={() => playStack([stack[0], ...stackOptions])}
                disabled={r.busy}
                className='text-mute'
              >
                tumpuk semua ({stackOptions.length + 1})
              </button>
            )}
            <button
              type='button'
              onClick={() => setStack(null)}
              className='text-mute'
            >
              batal
            </button>
          </div>
        </div>
      )}

      {choosing !== null && (
        <div
          className='a-slide-up mb-3 flex flex-col items-center gap-2'
          role='group'
          aria-label='Pilih warna'
        >
          <p className='text-xs'>Pilih warna:</p>
          <div className='flex gap-2'>
            {COLORS.map((color) => (
              <button
                key={color}
                type='button'
                aria-label={`Warna ${COLOR_NAME[color]}`}
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
              batal
            </button>
          </div>
        </div>
      )}

      {view.canCallUno && !over && (
        <div className='mb-2 flex justify-center'>
          <button
            type='button'
            onClick={() => r.move({ type: 'uno' })}
            disabled={r.busy}
            aria-label='Teriak UNO'
            className='a-bob rounded-full border-2 border-hash bg-hash/15 px-6 py-1.5 text-base font-black tracking-wider text-hash'
          >
            TERIAK UNO!
          </button>
        </div>
      )}

      <div className='mb-2 flex items-center justify-center gap-4 text-xs'>
        {view.stuck && view.canDraw && (
          <button
            type='button'
            onClick={() => r.move({ type: 'draw' })}
            disabled={r.busy}
            className='a-bob text-info hover:underline'
          >
            tarik kartu
          </button>
        )}
        {view.canPass && (
          <button
            type='button'
            onClick={() => r.move({ type: 'pass' })}
            disabled={r.busy}
            className='text-info hover:underline'
          >
            lewati, simpan kartunya
          </button>
        )}
        {over && (
          <button
            type='button'
            onClick={r.rematch}
            disabled={r.busy}
            className='text-info hover:underline'
          >
            main lagi
          </button>
        )}
      </div>

      {/* your own seat, mirroring the opponents around the table */}
      <div className='mt-auto flex items-center gap-2 px-3 pt-2'>
        <div className='relative'>
          <Avatar seat={you} label={names[you] ?? 'Kamu'} active={myTurn} />
          <span className='absolute -right-2 -bottom-1'>
            <CountCard count={view.hand.length} />
          </span>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
            myTurn ? 'bg-accent text-[#10110f]' : 'bg-surface text-mute'
          }`}
        >
          Kamu
        </span>
        {myPlace !== -1 && (
          <span className='text-xs font-bold text-accent'>
            {myPlace === 0 ? 'juara' : `ke-${myPlace + 1}`}
          </span>
        )}
        {view.hand.length === 1 && view.calledUno[you] && myPlace === -1 && (
          <span className='text-xs font-bold text-accent'>UNO!</span>
        )}
      </div>

      <div
        data-testid='hand'
        aria-label='Kartumu'
        className='flex flex-wrap justify-center gap-y-2 px-3 pt-3'
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
              dim={myTurn && !playable}
              animate={index >= view.hand.length - 1 ? 'deal' : undefined}
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

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}

      <p className='pt-4 text-center text-xs text-mute'>
        Cocokkan warna atau angka, klik atau seret kartu ke tumpukan. Punya
        beberapa kartu dengan angka yang sama? Mainkan sekaligus. Tidak ada yang
        cocok? Tarik satu kartu: kalau bisa dimainkan boleh langsung dipakai,
        kalau tidak giliran lewat. Wild +4 hanya jika tidak punya warna yang
        berlaku. Sisa dua kartu? Teriak UNO sebelum main, kalau lupa dan sisa
        satu kartu bisa ditangkap lawan dan tarik 2. Yang kartunya habis duluan
        juara, sisanya lanjut sampai tinggal satu. Room hilang sendiri setelah 2
        jam.
      </p>
    </>
  );
}

export default function UnoPage() {
  const mounted = useMounted();

  return (
    <GameShell name='uno' wide>
      {mounted ? <Uno /> : null}
    </GameShell>
  );
}
