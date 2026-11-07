'use client';

import * as React from 'react';

import { DominoView, End, Tile } from '@/lib/games/domino';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch, seatLabel } from '@/components/games/RoomGate';

const PIPS: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Half({ n, small }: { n: number; small?: boolean }) {
  return (
    <span className='grid size-full grid-cols-3 grid-rows-3 p-[3px]'>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className='flex items-center justify-center'>
          {PIPS[n].includes(i) && (
            <span
              className={`rounded-full bg-zinc-800 ${small ? 'size-1.5' : 'size-2'}`}
            />
          )}
        </span>
      ))}
    </span>
  );
}

/** One tile. `vertical` is how tiles in the hand are shown; the chain lies flat. */
function DominoTile({
  tile,
  vertical,
  playable,
  dim,
  onClick,
  selected,
  animate,
  hidden,
}: {
  tile: Tile;
  vertical?: boolean;
  playable?: boolean;
  dim?: boolean;
  onClick?: () => void;
  selected?: boolean;
  animate?: boolean;
  hidden?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-tile={`${tile[0]}-${tile[1]}`}
      data-playable={playable ? 'true' : undefined}
      aria-label={`kartu ${tile[0]} dan ${tile[1]}`}
      className={`${animate ? 'a-pop' : ''} flex shrink-0 overflow-hidden rounded-md border-2 bg-[#f8f4e8] shadow-[0_2px_4px_rgb(0_0_0/0.4)] transition-all duration-200 ${
        vertical ? 'h-[4.5rem] w-9 flex-col' : 'h-9 w-[4.5rem] flex-row'
      } ${
        playable
          ? 'z-10 -translate-y-2 cursor-pointer border-accent ring-2 ring-accent hover:-translate-y-4 hover:scale-110'
          : 'border-zinc-400'
      } ${selected ? '-translate-y-4 scale-110 ring-4' : ''} ${dim ? 'opacity-50' : ''}`}
    >
      <span className='size-full'>{!hidden && <Half n={tile[0]} />}</span>
      <span
        className={`bg-zinc-400 ${vertical ? 'h-px w-full' : 'h-full w-px'}`}
      />
      <span className='size-full'>{!hidden && <Half n={tile[1]} />}</span>
    </Tag>
  );
}

function lastText(v: DominoView, you: number) {
  const e = v.last;
  if (!e) return '';
  const who = seatLabel(e.seat, you);
  if (e.kind === 'play' && e.tile)
    return `${who} memasang ${e.tile[0]}-${e.tile[1]}.`;
  if (e.kind === 'draw') return `${who} menarik kartu.`;
  return `${who} melewati giliran.`;
}

function Domino() {
  const r = useRoom<DominoView>('domino');
  const [selected, setSelected] = React.useState<number | null>(null);

  return (
    <RoomGate
      r={r}
      command='domino --online'
      blurb='# Domino untuk 2 sampai 4 pemain. Sambung angka yang sama di ujung rantai; habiskan kartu lebih dulu untuk menang.'
    >
      {({ room, you }) => {
        const v = room.state;
        const over = room.status === 'over';
        const myTurn = !over && v.turn === you;
        const empty = v.board.length === 0;

        const play = (index: number, end: End) => {
          setSelected(null);
          r.move({ type: 'play', index, end });
        };

        const clickTile = (index: number) => {
          const ends = v.playable[index];
          if (ends.length === 0 || r.busy) return;
          // only one place for it (or an empty table): no need to ask
          if (ends.length === 1 || empty) play(index, ends[0]);
          else setSelected(selected === index ? null : index);
        };

        let banner: React.ReactNode;
        if (over) {
          banner =
            v.winner === null ? (
              <span>Buntu dan seri.</span>
            ) : v.winner === you ? (
              <span className='text-accent'>
                {v.status === 'blocked'
                  ? 'Buntu, kartumu paling ringan. Menang!'
                  : 'Kartumu habis. Menang!'}
              </span>
            ) : (
              <span className='text-err'>
                {seatLabel(v.winner, you)} menang.
              </span>
            );
        } else if (myTurn)
          banner = <span className='text-accent'>Giliranmu</span>;
        else
          banner = (
            <span className='text-mute'>Giliran {seatLabel(v.turn, you)}…</span>
          );

        const others = v.counts
          .map((count, seat) => ({ count, seat }))
          .filter((p) => p.seat !== you);

        return (
          <>
            {over && v.winner === you && <Confetti />}

            <ul
              className='mb-3 flex flex-wrap justify-center gap-3'
              aria-label='Pemain lain'
            >
              {others.map(({ count, seat }) => {
                const active = !over && v.turn === seat;
                return (
                  <li
                    key={seat}
                    data-seat={seat}
                    className={`rounded-md border px-3 py-1.5 text-center text-xs ${
                      active
                        ? 'a-glow border-accent bg-accent/10'
                        : 'border-line text-mute'
                    }`}
                  >
                    <p>{seatLabel(seat, you)}</p>
                    <div
                      className='my-1 flex justify-center -space-x-2'
                      aria-hidden
                    >
                      {Array.from({ length: Math.min(count, 7) }, (_, i) => (
                        <span
                          key={i}
                          className='h-6 w-3 rounded-sm border border-zinc-500 bg-zinc-700'
                        />
                      ))}
                    </div>
                    <p className='text-base text-ink'>{count}</p>
                  </li>
                );
              })}
            </ul>

            <p
              key={`${v.turn}-${v.status}`}
              className='a-slide-up mb-1 text-center text-sm'
              aria-live='polite'
            >
              {banner}
            </p>
            <p
              className='mb-3 min-h-4 text-center text-xs text-mute'
              data-testid='last-event'
            >
              {lastText(v, you)}
            </p>

            <div
              data-testid='board'
              className='mb-3 flex min-h-28 flex-wrap items-center justify-center gap-1 rounded-xl bg-[#1f6b4a] p-3 shadow-inner'
            >
              {empty && (
                <span className='text-sm text-white/70'>
                  {myTurn ? 'Pasang kartu pertama' : 'Menunggu kartu pertama…'}
                </span>
              )}
              {selected !== null && !empty && (
                <button
                  type='button'
                  aria-label='Pasang di kiri'
                  onClick={() => play(selected, 'L')}
                  disabled={!v.playable[selected].includes('L')}
                  className='a-bob rounded-md bg-accent/90 px-2 py-1 text-paper disabled:hidden'
                >
                  ◀
                </button>
              )}
              {v.board.map((tile, i) => (
                <DominoTile
                  key={`${i}-${tile[0]}${tile[1]}`}
                  tile={tile}
                  animate={i === 0 || i === v.board.length - 1}
                />
              ))}
              {selected !== null && !empty && (
                <button
                  type='button'
                  aria-label='Pasang di kanan'
                  onClick={() => play(selected, 'R')}
                  disabled={!v.playable[selected].includes('R')}
                  className='a-bob rounded-md bg-accent/90 px-2 py-1 text-paper disabled:hidden'
                >
                  ▶
                </button>
              )}
            </div>

            <div className='mb-2 flex items-center justify-center gap-4 text-xs'>
              <span className='text-mute'>tumpukan: {v.boneyard}</span>
              {v.canDraw && (
                <button
                  type='button'
                  onClick={() => r.move({ type: 'draw' })}
                  disabled={r.busy}
                  className='a-bob text-info hover:underline'
                >
                  [tarik kartu]
                </button>
              )}
              {v.canPass && (
                <button
                  type='button'
                  onClick={() => r.move({ type: 'pass' })}
                  disabled={r.busy}
                  className='text-info hover:underline'
                >
                  [lewati giliran]
                </button>
              )}
            </div>

            {over && v.hands && (
              <div className='a-fade mb-3 space-y-1 text-center text-xs text-mute'>
                {v.hands.map((hand, seat) =>
                  seat === you ? null : (
                    <div
                      key={seat}
                      className='flex items-center justify-center gap-2'
                    >
                      <span>{seatLabel(seat, you)}:</span>
                      <span className='flex gap-1'>
                        {hand.map((t, i) => (
                          <DominoTile key={i} tile={t} />
                        ))}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}

            <div
              data-testid='hand'
              aria-label='Kartumu'
              className='mt-auto flex flex-wrap justify-center gap-2 pt-6'
            >
              {v.hand.map((tile, index) => {
                const playable = v.playable[index].length > 0;
                return (
                  <DominoTile
                    key={`${index}-${tile[0]}${tile[1]}`}
                    tile={tile}
                    vertical
                    animate={index === v.hand.length - 1}
                    playable={playable}
                    selected={selected === index}
                    dim={myTurn && !playable}
                    onClick={
                      playable && !r.busy ? () => clickTile(index) : undefined
                    }
                  />
                );
              })}
            </div>

            {over && <Rematch r={r} />}
            <p className='pt-4 text-center text-xs text-mute'>
              Klik kartu yang menyala. Kalau cocok di dua ujung, pilih sisinya.
              Tidak punya kartu cocok? Tarik dari tumpukan. Room hilang sendiri
              setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function DominoPage() {
  const mounted = useMounted();

  return (
    <GameShell name='domino' wide>
      {mounted ? <Domino /> : null}
    </GameShell>
  );
}
