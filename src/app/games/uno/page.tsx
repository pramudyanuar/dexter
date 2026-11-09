'use client';

import * as React from 'react';

import { Card, Color, COLORS, stackable, UnoView } from '@/lib/games/uno';
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

const ORDINAL = ['pertama', 'kedua', 'ketiga', 'keempat'];
const placeText = (place: number) => `juara ${ORDINAL[place] ?? place + 1}`;

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
  const pileRef = React.useRef<HTMLDivElement>(null);

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Uno untuk 2 sampai 4 pemain di device berbeda. Pembuat room memulai permainan setelah semua bergabung.'
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
        onCreate={r.create}
        onJoin={r.join}
      />
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
            <li key={seat} className='flex justify-between py-2 text-sm'>
              <span className={taken ? '' : 'text-mute'}>
                {taken
                  ? seatTitle(seat, you, names)
                  : `kursi ${seat + 1} kosong`}
              </span>
              {seat === 0 && taken && (
                <span className='text-hash'>pembuat</span>
              )}
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

  const others = view.counts
    .map((count, seat) => ({ count, seat }))
    .filter((p) => p.seat !== you);

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

      <ul
        className='mb-4 flex flex-wrap justify-center gap-3'
        aria-label='Pemain lain'
      >
        {others.map(({ count, seat }) => {
          const active = !over && view.turn === seat;
          const place = view.places.indexOf(seat);
          return (
            <li
              key={seat}
              data-seat={seat}
              className={`rounded-md border px-3 py-2 text-center text-xs transition-colors ${
                active
                  ? 'a-glow border-accent bg-accent/10 text-ink'
                  : 'border-line text-mute'
              }`}
            >
              <p>{seatName(seat)}</p>
              <div
                aria-hidden
                className='mx-auto my-1.5 flex h-10 items-center justify-center'
                style={{ width: 28 + Math.min(count, 7) * 7 }}
              >
                {Array.from({ length: Math.min(count, 8) }, (_, i) => (
                  <CardBack
                    key={i}
                    size='sm'
                    className='-ml-5 first:ml-0'
                    style={{ rotate: `${(i - Math.min(count, 8) / 2) * 4}deg` }}
                  />
                ))}
              </div>
              <p className='text-base text-ink'>{count}</p>
              {count === 1 && !over && place === -1 && (
                <p className='a-wiggle font-bold text-hash'>UNO!</p>
              )}
              {place !== -1 && (
                <p className='font-bold text-accent'>
                  {place === 0 ? '🏆 ' : ''}#{place + 1}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p
        key={`${over}-${myTurn}-${view.turn}`}
        className='a-slide-up mb-4 text-center text-sm'
        aria-live='polite'
      >
        {banner}
      </p>

      <div className='mb-4 flex items-center justify-center gap-6 rounded-xl bg-card/60 py-5'>
        <button
          type='button'
          aria-label='Tarik kartu'
          disabled={!view.canDraw || r.busy}
          onClick={() => r.move({ type: 'draw' })}
          className='group relative flex h-32 w-[5.5rem] items-center justify-center disabled:opacity-70'
        >
          {/* a little stack behind the top of the pile */}
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
          <span className='relative mt-24 rounded-full bg-paper/90 px-2 py-0.5 text-xs'>
            tarik · {view.drawCount}
          </span>
        </button>

        <div
          ref={pileRef}
          data-testid='pile'
          data-drop={drag}
          className={`relative rounded-xl p-1.5 text-center transition-all duration-200 ${
            drag === 'over'
              ? 'scale-110 bg-accent/25 ring-4 ring-accent'
              : drag === 'drag'
                ? 'a-glow ring-dashed bg-accent/10 ring-2 ring-accent/60'
                : ''
          }`}
        >
          {drag !== 'idle' && (
            <span className='a-fade absolute -top-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-accent'>
              {drag === 'over' ? 'lepas!' : 'seret ke sini'}
            </span>
          )}
          <div
            key={`${view.top.c}${view.top.v}-${view.counts.join('.')}-${view.turn}`}
          >
            <UnoCard
              card={view.top}
              size='lg'
              animate='play'
              tilt={(view.counts.reduce((a, b) => a + b, 0) % 7) - 3}
            />
          </div>
        </div>

        <div className='text-center text-xs text-mute'>
          <p>warna</p>
          <span
            key={view.color}
            data-color={view.color}
            className='a-pop mt-1 inline-block size-7 rounded-full border-2 border-white shadow-md'
            style={{ background: BG[view.color] }}
          />
          <p className='mt-1 text-ink'>{COLOR_NAME[view.color]}</p>
        </div>
      </div>

      <p
        className='mb-3 min-h-4 text-center text-xs text-mute'
        data-testid='last-event'
      >
        {lastText(view, you, names)}
      </p>

      {over && view.places.length > 0 && (
        <ol
          className='a-slide-up mx-auto mb-3 w-full max-w-xs divide-y divide-line border-y border-line text-sm'
          aria-label='Peringkat'
        >
          {view.places.map((seat, i) => (
            <li key={seat} className='flex justify-between py-1.5'>
              <span className={seat === you ? 'text-accent' : ''}>
                {i + 1}. {seatTitle(seat, you, names)}
              </span>
              <span className='text-mute'>
                {i === 0
                  ? '🏆'
                  : view.counts[seat] > 0
                    ? `sisa ${view.counts[seat]} kartu`
                    : ''}
              </span>
            </li>
          ))}
        </ol>
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

      <div
        data-testid='hand'
        aria-label='Kartumu'
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
        berlaku. Yang kartunya habis duluan juara, sisanya lanjut sampai tinggal
        satu. Room hilang sendiri setelah 2 jam.
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
