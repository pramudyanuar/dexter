'use client';

import * as React from 'react';

import { CheckersView, SIZE } from '@/lib/games/checkers';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

const DISC = [
  'radial-gradient(circle at 32% 30%, #ffb4a8, #e5484d 55%, #7f1d1d)',
  'radial-gradient(circle at 32% 30%, #d4d4d8, #3f3f46 55%, #09090b)',
] as const;
const NAME = ['merah', 'hitam'] as const;
const owner = (p: number) => (p === 0 ? -1 : p <= 2 ? 0 : 1);

function Checkers() {
  const r = useRoom<CheckersView>('checkers');
  const [picked, setPicked] = React.useState<[number, number] | null>(null);

  return (
    <RoomGate
      r={r}
      blurb='# Dam (checkers) untuk dua pemain di device berbeda. Wajib memakan bidak lawan kalau bisa. Merah jalan duluan.'
      barRight={
        r.session && (
          <span className='text-mute'>
            kamu:{' '}
            <span
              className='inline-block size-2.5 rounded-full align-middle'
              style={{ background: DISC[r.session.you] }}
            />{' '}
            {NAME[r.session.you]}
          </span>
        )
      }
    >
      {({ room, you }) => {
        const s = room.state;
        const myTurn = room.status === 'playing' && s.turn === you;
        const flip = you === 1; // everyone sees their own side at the bottom

        // mid-jump, only that piece may move, so select it for the player
        const active = s.chain ?? picked;
        const targets = s.legal.filter(
          (m) => active && m.from[0] === active[0] && m.from[1] === active[1],
        );
        const movable = new Set(
          s.legal.map((m) => `${m.from[0]},${m.from[1]}`),
        );

        const click = (row: number, col: number) => {
          if (!myTurn || r.busy) return;
          const hit = targets.find((m) => m.to[0] === row && m.to[1] === col);
          if (hit) {
            setPicked(null);
            r.move({ from: hit.from, to: hit.to });
          } else if (movable.has(`${row},${col}`) && !s.chain) {
            setPicked([row, col]);
          } else if (!s.chain) {
            setPicked(null);
          }
        };

        let status: React.ReactNode;
        if (s.status === 'won') {
          status =
            s.winner === you ? (
              <span className='text-accent'>
                Semua bidak lawan habis. Kamu menang!
              </span>
            ) : (
              <span className='text-err'>Kamu kalah.</span>
            );
        } else if (s.status === 'draw') status = 'Seri.';
        else if (myTurn) {
          status = (
            <span className='text-accent'>
              {s.chain
                ? 'Lanjutkan memakan!'
                : s.legal.some((m) => m.capture)
                  ? 'Giliranmu, kamu wajib memakan'
                  : 'Giliranmu'}
            </span>
          );
        } else status = <span className='text-mute'>Giliran lawan…</span>;

        const rows = Array.from({ length: SIZE }, (_, i) =>
          flip ? SIZE - 1 - i : i,
        );

        return (
          <>
            {s.winner === you && <Confetti />}
            <div className='mb-2 flex justify-between text-xs text-mute'>
              <span>
                lawan: <span className='text-ink'>{s.counts[1 - you]}</span>
              </span>
              <span>
                kamu: <span className='text-ink'>{s.counts[you]}</span>
              </span>
            </div>
            <p
              key={`${s.turn}-${s.status}-${s.chain}`}
              className='a-slide-up mb-3 text-center text-sm'
              aria-live='polite'
            >
              {status}
            </p>

            <div
              role='grid'
              aria-label='Papan Dam'
              className='mx-auto grid w-full max-w-[28rem] grid-cols-8 overflow-hidden rounded-md border-2 border-hash/60 shadow-lg'
            >
              {rows.flatMap((row) =>
                rows.map((col) => {
                  const dark = (row + col) % 2 === 1;
                  const piece = s.board[row][col];
                  const o = owner(piece);
                  const isTarget = targets.some(
                    (m) => m.to[0] === row && m.to[1] === col,
                  );
                  const isActive = active?.[0] === row && active?.[1] === col;
                  const wasLast =
                    (s.last?.from[0] === row && s.last?.from[1] === col) ||
                    (s.last?.to[0] === row && s.last?.to[1] === col);
                  return (
                    <button
                      key={`${row}-${col}`}
                      type='button'
                      role='gridcell'
                      data-piece={piece}
                      aria-label={`Baris ${row + 1}, kolom ${col + 1}`}
                      disabled={!dark}
                      onClick={() => click(row, col)}
                      className={`relative flex aspect-square items-center justify-center ${
                        dark ? 'bg-[#8b5a2b]' : 'bg-[#f0d9b5]'
                      } ${wasLast && dark ? 'brightness-125' : ''}`}
                    >
                      {isTarget && (
                        <span className='a-glow absolute size-1/3 rounded-full bg-accent/80' />
                      )}
                      {piece !== 0 && (
                        <span
                          key={`${piece}-${row}-${col}`}
                          className={`a-pop flex size-[78%] items-center justify-center rounded-full text-lg text-yellow-300 shadow-[0_3px_4px_rgb(0_0_0/0.5),inset_0_-3px_5px_rgb(0_0_0/0.35)] ${
                            isActive ? 'scale-110 ring-4 ring-accent' : ''
                          } ${myTurn && o === you && movable.has(`${row},${col}`) ? 'cursor-pointer ring-2 ring-white/70' : ''}`}
                          style={{ background: DISC[o as 0 | 1] }}
                        >
                          {piece === 2 || piece === 4 ? '♛' : ''}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>

            {room.status === 'over' && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Klik bidakmu, lalu petak tujuan. Bidak yang sampai ujung jadi raja
              ♛ dan bisa mundur. Room hilang sendiri setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function CheckersPage() {
  const mounted = useMounted();

  return (
    <GameShell name='dam' wide>
      {mounted ? <Checkers /> : null}
    </GameShell>
  );
}
