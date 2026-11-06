'use client';

import * as React from 'react';

import { Card, Color, COLORS, UnoView } from '@/lib/games/uno';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import RoomLobby from '@/components/games/RoomLobby';

const BG: Record<Card['c'], string> = {
  R: 'hsl(2 75% 52%)',
  Y: 'hsl(46 95% 52%)',
  G: 'hsl(135 55% 40%)',
  B: 'hsl(215 75% 52%)',
  W: 'hsl(0 0% 14%)',
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

const face = (card: Card) => SYMBOL[card.v] ?? card.v;
const describe = (card: Card) =>
  card.c === 'W'
    ? card.v === 'F'
      ? 'wild +4'
      : 'wild'
    : `${COLOR_NAME[card.c]} ${face(card)}`;

function UnoCard({
  card,
  playable,
  dim,
  onClick,
  size = 'md',
}: {
  card: Card;
  playable?: boolean;
  dim?: boolean;
  onClick?: () => void;
  size?: 'md' | 'lg';
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-card={`${card.c}${card.v}`}
      data-playable={playable ? 'true' : undefined}
      aria-label={describe(card)}
      style={{
        background: BG[card.c],
        color: card.c === 'Y' ? '#1b1b1b' : '#fff',
      }}
      className={`flex shrink-0 items-center justify-center rounded-md border-2 font-bold shadow-sm ${
        size === 'lg' ? 'h-24 w-16 text-2xl' : 'h-16 w-11 text-lg'
      } ${
        playable
          ? 'cursor-pointer border-ink ring-2 ring-accent'
          : 'border-white/30'
      } ${dim ? 'opacity-45' : ''}`}
    >
      {face(card)}
    </Tag>
  );
}

const seatName = (seat: number, you: number) =>
  seat === you ? 'Kamu' : `Pemain ${seat + 1}`;

function lastText(view: UnoView, you: number) {
  const e = view.last;
  if (!e) return null;
  const who = seatName(e.seat, you);
  if (e.kind === 'play' && e.card) {
    return `${who} memainkan ${describe(e.card)}${e.color ? `, warna ${COLOR_NAME[e.color]}` : ''}.`;
  }
  if (e.kind === 'draw') {
    return e.passed
      ? `${who} menarik kartu dan melewati giliran.`
      : `${who} menarik kartu.`;
  }
  return `${who} melewati giliran.`;
}

function Uno() {
  const r = useRoom<UnoView>('uno');
  const [choosing, setChoosing] = React.useState<number | null>(null);

  if (!r.session) {
    return (
      <RoomLobby
        command='uno --online'
        blurb='# Uno untuk 2 sampai 4 pemain di device berbeda. Pembuat room memulai permainan setelah semua bergabung.'
        busy={r.busy}
        error={r.error}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  const { room } = r;
  const you = r.session.you;
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
                {taken ? seatName(seat, you) : `kursi ${seat + 1} kosong`}
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
              [mulai dengan {joined} pemain]
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
  const myTurn = !over && view.turn === you;

  let banner: React.ReactNode;
  if (over) {
    banner =
      view.winner === you ? (
        <span className='text-accent'>Kamu menang!</span>
      ) : (
        <span className='text-err'>
          {seatName(view.winner ?? 0, you)} menang.
        </span>
      );
  } else if (myTurn) {
    banner = <span className='text-accent'>Giliranmu</span>;
  } else {
    banner = (
      <span className='text-mute'>Giliran {seatName(view.turn, you)}…</span>
    );
  }

  const playCard = (index: number) => {
    const card = view.hand[index];
    if (card.c === 'W') setChoosing(index);
    else r.move({ type: 'play', index });
  };

  const others = view.counts
    .map((count, seat) => ({ count, seat }))
    .filter((p) => p.seat !== you);

  return (
    <>
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
        className='mb-3 flex flex-wrap justify-center gap-2'
        aria-label='Pemain lain'
      >
        {others.map(({ count, seat }) => (
          <li
            key={seat}
            data-seat={seat}
            className={`rounded-sm border px-3 py-1.5 text-center text-xs ${
              !over && view.turn === seat
                ? 'border-accent text-ink'
                : 'border-line text-mute'
            }`}
          >
            <p>{seatName(seat, you)}</p>
            <p className='text-base text-ink'>{count}</p>
            {count === 1 && !over && (
              <p className='font-bold text-hash'>UNO!</p>
            )}
          </li>
        ))}
      </ul>

      <p className='mb-3 text-center text-sm' aria-live='polite'>
        {banner}
      </p>

      <div className='mb-3 flex items-center justify-center gap-5'>
        <button
          type='button'
          aria-label='Tarik kartu'
          disabled={!view.canDraw || r.busy}
          onClick={() => r.move({ type: 'draw' })}
          className='flex h-24 w-16 flex-col items-center justify-center rounded-md border-2 border-line bg-card text-xs enabled:cursor-pointer enabled:border-accent enabled:ring-2 enabled:ring-accent/40 disabled:opacity-60'
        >
          <span>tarik</span>
          <span className='text-mute'>{view.drawCount}</span>
        </button>

        <div className='text-center'>
          <UnoCard card={view.top} size='lg' />
        </div>

        <div className='text-center text-xs text-mute'>
          <p>warna</p>
          <span
            data-color={view.color}
            className='mt-1 inline-block size-6 rounded-full border border-line'
            style={{ background: BG[view.color] }}
          />
          <p className='mt-1 text-ink'>{COLOR_NAME[view.color]}</p>
        </div>
      </div>

      <p
        className='mb-3 min-h-4 text-center text-xs text-mute'
        data-testid='last-event'
      >
        {lastText(view, you)}
      </p>

      {choosing !== null && (
        <div
          className='mb-3 flex flex-col items-center gap-2'
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
                className='size-10 rounded-full border-2 border-white/40'
                style={{ background: BG[color] }}
              />
            ))}
            <button
              type='button'
              onClick={() => setChoosing(null)}
              className='px-2 text-xs text-mute hover:text-ink'
            >
              [batal]
            </button>
          </div>
        </div>
      )}

      <div className='mb-2 flex items-center justify-center gap-4 text-xs'>
        {view.canPass && (
          <button
            type='button'
            onClick={() => r.move({ type: 'pass' })}
            disabled={r.busy}
            className='text-info hover:underline'
          >
            [lewati, simpan kartunya]
          </button>
        )}
        {over && (
          <button
            type='button'
            onClick={r.rematch}
            disabled={r.busy}
            className='text-info hover:underline'
          >
            [main lagi]
          </button>
        )}
      </div>

      <div
        data-testid='hand'
        aria-label='Kartumu'
        className='mt-auto flex flex-wrap justify-center gap-1.5 pt-2'
      >
        {view.hand.map((card, index) => {
          const playable = view.playable.includes(index);
          return (
            <UnoCard
              key={`${index}-${card.c}${card.v}`}
              card={card}
              playable={playable}
              dim={myTurn && !playable}
              onClick={playable && !r.busy ? () => playCard(index) : undefined}
            />
          );
        })}
      </div>

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}

      <p className='pt-4 text-center text-xs text-mute'>
        Cocokkan warna atau angka. Wild +4 hanya jika tidak punya warna yang
        berlaku. Room hilang sendiri setelah 2 jam.
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
