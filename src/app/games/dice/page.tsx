'use client';

import * as React from 'react';

import { DiceView, higher } from '@/lib/games/liarsdice';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch, seatLabel } from '@/components/games/RoomGate';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({
  value,
  size = 'md',
  hl,
  dim,
  delay = 0,
  animate,
}: {
  value: number;
  size?: 'sm' | 'md';
  hl?: boolean;
  dim?: boolean;
  delay?: number;
  animate?: boolean;
}) {
  return (
    <span
      role='img'
      aria-label={`dadu ${value}`}
      data-die={value}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
      className={`${animate ? 'a-roll' : ''} grid shrink-0 grid-cols-3 grid-rows-3 rounded-lg border-2 bg-white p-1 shadow-[0_3px_5px_rgb(0_0_0/0.35),inset_0_-3px_4px_rgb(0_0_0/0.12)] ${
        size === 'sm' ? 'size-8 gap-0' : 'size-12 gap-px p-1.5'
      } ${hl ? 'border-accent ring-2 ring-accent' : 'border-zinc-300'} ${dim ? 'opacity-40' : ''}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className='flex items-center justify-center'>
          {PIPS[value].includes(i) && (
            <span
              className={`rounded-full ${value === 1 ? 'bg-err' : 'bg-zinc-800'} ${
                size === 'sm' ? 'size-1.5' : 'size-2.5'
              }`}
            />
          )}
        </span>
      ))}
    </span>
  );
}

function BidPanel({
  bid,
  totalDice,
  busy,
  onBid,
  onCall,
}: {
  bid: DiceView['bid'];
  totalDice: number;
  busy: boolean;
  onBid: (qty: number, face: number) => void;
  onCall: () => void;
}) {
  // start on the lowest legal raise
  const first = !bid
    ? { qty: 1, face: 2 }
    : bid.face < 6
      ? { qty: bid.qty, face: bid.face + 1 }
      : { qty: bid.qty + 1, face: 1 };
  const [qty, setQty] = React.useState(first.qty);
  const [face, setFace] = React.useState(first.face);
  const valid = higher(bid, qty, face) && qty <= totalDice;

  return (
    <div className='a-slide-up mx-auto w-full max-w-sm rounded-lg border border-line p-3'>
      <div className='flex items-center justify-center gap-3'>
        <button
          type='button'
          aria-label='Kurangi jumlah'
          onClick={() => setQty((n) => Math.max(1, n - 1))}
          className='size-9 rounded-md border border-line bg-card text-lg active:scale-90'
        >
          −
        </button>
        <span className='w-10 text-center text-2xl' data-testid='qty'>
          {qty}
        </span>
        <button
          type='button'
          aria-label='Tambah jumlah'
          onClick={() => setQty((n) => Math.min(totalDice, n + 1))}
          className='size-9 rounded-md border border-line bg-card text-lg active:scale-90'
        >
          +
        </button>
        <span className='text-mute'>×</span>
        <div className='flex gap-1' role='group' aria-label='Angka dadu'>
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <button
              key={f}
              type='button'
              aria-label={`Angka ${f}`}
              aria-pressed={face === f}
              onClick={() => setFace(f)}
              className={`rounded-md p-0.5 transition-transform active:scale-90 ${
                face === f
                  ? 'scale-110 ring-2 ring-accent'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <Die value={f} size='sm' />
            </button>
          ))}
        </div>
      </div>
      <div className='mt-3 flex justify-center gap-6 text-sm'>
        <button
          type='button'
          disabled={!valid || busy}
          onClick={() => onBid(qty, face)}
          className='text-accent hover:underline disabled:opacity-40'
        >
          tawar {qty} × {face}
        </button>
        {bid && (
          <button
            type='button'
            disabled={busy}
            onClick={onCall}
            className='a-wiggle text-err hover:underline'
          >
            bohong!
          </button>
        )}
      </div>
      {!valid && (
        <p className='mt-2 text-center text-xs text-mute'>
          Tawaran harus lebih tinggi: jumlah lebih banyak, atau jumlah sama
          dengan angka lebih besar.
        </p>
      )}
    </div>
  );
}

function Dice() {
  const r = useRoom<DiceView>('dice');
  return (
    <RoomGate
      r={r}
      blurb='# Dadu bohong untuk 2 sampai 4 pemain. Tawar jumlah dadu yang ada di meja (angka 1 jadi joker), atau tantang "bohong!" kalau kamu tidak percaya.'
    >
      {({ room, you }) => {
        const v = room.state;
        const over = v.winner !== null;
        const myTurn = !over && v.turn === you;
        const rv = v.reveal;
        const mineLeft = v.counts[you] > 0;
        const bidKey = v.bid ? `${v.bid.qty}-${v.bid.face}` : 'none';

        return (
          <>
            {over && v.winner === you && <Confetti />}

            <ul
              className='mb-4 flex flex-wrap justify-center gap-2'
              aria-label='Pemain'
            >
              {v.counts.map((count, seat) => {
                const active = !over && v.turn === seat;
                return (
                  <li
                    key={seat}
                    data-seat={seat}
                    className={`rounded-md border px-3 py-1.5 text-center text-xs transition-colors ${
                      active
                        ? 'a-glow border-accent bg-accent/10'
                        : 'border-line text-mute'
                    } ${count === 0 ? 'line-through opacity-40' : ''}`}
                  >
                    <p>{seatLabel(seat, you, room.names)}</p>
                    <p
                      className='mt-1 flex justify-center gap-0.5'
                      aria-label={`${count} dadu`}
                    >
                      {Array.from({ length: count }, (_, i) => (
                        <span
                          key={i}
                          className='size-2.5 rounded-sm bg-ink/70'
                        />
                      ))}
                      {count === 0 && '—'}
                    </p>
                  </li>
                );
              })}
            </ul>

            <p
              key={`${v.turn}-${v.round}-${v.winner}`}
              className='a-slide-up mb-3 text-center text-sm'
              aria-live='polite'
            >
              {over ? (
                v.winner === you ? (
                  <span className='text-accent'>
                    Kamu pemain terakhir. Menang!
                  </span>
                ) : (
                  <span className='text-err'>
                    {seatLabel(v.winner!, you, room.names)} menang.
                  </span>
                )
              ) : !mineLeft ? (
                <span className='text-mute'>
                  Kamu sudah habis dadu. Menonton…
                </span>
              ) : myTurn ? (
                <span className='text-accent'>Giliranmu</span>
              ) : (
                <span className='text-mute'>
                  Giliran {seatLabel(v.turn, you, room.names)}…
                </span>
              )}
            </p>

            {rv && (
              <div
                key={`reveal-${v.round}-${v.winner}`}
                className='a-pop mb-4 rounded-lg border border-line bg-card/70 p-3'
                data-testid='reveal'
              >
                <p className='mb-2 text-center text-xs'>
                  {seatLabel(rv.caller, you, room.names)} menantang tawaran{' '}
                  {seatLabel(rv.bid.seat, you, room.names)}:{' '}
                  <b>
                    {rv.bid.qty} × {rv.bid.face}
                  </b>
                  . Ternyata ada <b className='text-hash'>{rv.total}</b>.{' '}
                  <span className='text-err'>
                    {seatLabel(rv.loser, you, room.names)} kehilangan 1 dadu.
                  </span>
                </p>
                <div className='space-y-1.5'>
                  {rv.dice.map((dice, seat) => (
                    <div key={seat} className='flex items-center gap-2'>
                      <span className='w-16 shrink-0 text-xs text-mute'>
                        {seatLabel(seat, you, room.names)}
                      </span>
                      <span className='flex flex-wrap gap-1'>
                        {dice.map((d, i) => (
                          <Die
                            key={i}
                            value={d}
                            size='sm'
                            animate
                            delay={i * 80 + seat * 120}
                            hl={
                              d === rv.bid.face ||
                              (rv.bid.face !== 1 && d === 1)
                            }
                            dim={
                              !(
                                d === rv.bid.face ||
                                (rv.bid.face !== 1 && d === 1)
                              )
                            }
                          />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!over && (
              <div className='mb-4 text-center' data-testid='current-bid'>
                <p className='text-xs text-mute'>tawaran saat ini</p>
                {v.bid ? (
                  <p
                    key={bidKey}
                    className='a-pop mt-1 flex items-center justify-center gap-2 text-2xl'
                  >
                    <b>{v.bid.qty}</b> × <Die value={v.bid.face} size='sm' />
                    <span className='text-xs text-mute'>
                      oleh {seatLabel(v.bid.seat, you, room.names)}
                    </span>
                  </p>
                ) : (
                  <p className='mt-1 text-mute'>belum ada</p>
                )}
              </div>
            )}

            {v.myDice.length > 0 && (
              <div className='mb-4 flex flex-col items-center'>
                <p className='mb-2 text-xs text-mute'>dadumu (rahasia)</p>
                <div
                  key={`mine-${v.round}`}
                  className='flex flex-wrap justify-center gap-2'
                >
                  {v.myDice.map((d, i) => (
                    <Die key={i} value={d} animate delay={i * 90} />
                  ))}
                </div>
              </div>
            )}

            {myTurn && (
              <BidPanel
                key={`${bidKey}-${v.round}`}
                bid={v.bid}
                totalDice={v.totalDice}
                busy={r.busy}
                onBid={(qty, face) => r.move({ type: 'bid', qty, face })}
                onCall={() => r.move({ type: 'call' })}
              />
            )}

            {over && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Yang salah (penawar atau penantang) kehilangan 1 dadu. Pemain
              terakhir yang punya dadu menang. Room hilang sendiri setelah 2
              jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function DicePage() {
  const mounted = useMounted();

  return (
    <GameShell name='dadu-bohong' wide>
      {mounted ? <Dice /> : null}
    </GameShell>
  );
}
