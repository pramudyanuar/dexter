'use client';

import * as React from 'react';

import { GomokuState, SIZE } from '@/lib/games/gomoku';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomChat from '@/components/games/RoomChat';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

const STONE = [
  'radial-gradient(circle at 32% 30%, #6b7280, #111827 60%, #000)',
  'radial-gradient(circle at 32% 30%, #ffffff, #e5e7eb 55%, #9ca3af)',
] as const;
const NAME = ['hitam', 'putih'] as const;

function Gomoku() {
  const r = useRoom<GomokuState>('gomoku');

  return (
    <RoomGate
      r={r}
      blurb='# Lima berjajar di papan 15x15 untuk dua pemain di device berbeda. Hitam jalan duluan.'
      barRight={
        r.session && (
          <span className='text-mute'>
            kamu:{' '}
            <span
              className='inline-block size-2.5 rounded-full border border-line align-middle'
              style={{ background: STONE[r.session.you] }}
            />{' '}
            {NAME[r.session.you]}
          </span>
        )
      }
    >
      {({ room, you }) => {
        const s = room.state;
        const myTurn = room.status === 'playing' && s.turn === you;
        const win = new Set((s.line ?? []).map(([a, b]) => `${a},${b}`));

        let status: React.ReactNode;
        if (s.status === 'won') {
          status =
            s.winner === you ? (
              <span className='text-accent'>Lima berjajar, kamu menang!</span>
            ) : (
              <span className='text-err'>Lawan membuat lima berjajar.</span>
            );
        } else if (s.status === 'draw') status = 'Papan penuh. Seri.';
        else if (myTurn)
          status = <span className='text-accent'>Giliranmu</span>;
        else status = <span className='text-mute'>Giliran lawan…</span>;

        return (
          <>
            {s.winner === you && <Confetti />}
            <p
              key={`${s.turn}-${s.status}`}
              className='a-slide-up mb-3 text-center text-sm'
              aria-live='polite'
            >
              {status}
            </p>

            <div
              role='grid'
              aria-label='Papan Gomoku'
              className='mx-auto grid w-full max-w-[34rem] touch-manipulation rounded-md border-2 border-hash/60 p-1 shadow-lg'
              style={{
                gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
                background: 'color-mix(in oklab, var(--hash) 28%, var(--card))',
              }}
            >
              {s.board.flatMap((row, rr) =>
                row.map((owner, c) => {
                  const empty = owner === 0;
                  const isLast = s.last?.[0] === rr && s.last?.[1] === c;
                  return (
                    <button
                      key={`${rr}-${c}`}
                      type='button'
                      role='gridcell'
                      data-owner={owner}
                      aria-label={`Baris ${rr + 1}, kolom ${c + 1}`}
                      disabled={!myTurn || !empty || r.busy}
                      onClick={() => r.move({ r: rr, c })}
                      className={`group relative flex aspect-square items-center justify-center ${
                        empty && myTurn ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {/* grid lines through the middle of the cell */}
                      <span className='pointer-events-none absolute inset-x-0 top-1/2 h-px bg-ink/30' />
                      <span className='pointer-events-none absolute inset-y-0 left-1/2 w-px bg-ink/30' />
                      {empty ? (
                        myTurn && (
                          <span
                            className='size-[70%] scale-50 rounded-full opacity-0 transition group-hover:scale-100 group-hover:opacity-50'
                            style={{ background: STONE[you] }}
                          />
                        )
                      ) : (
                        <span
                          className={`a-drop relative size-[84%] rounded-full shadow-[0_2px_3px_rgb(0_0_0/0.45)] ${
                            win.has(`${rr},${c}`) ? 'a-bob ring-2 ring-err' : ''
                          }`}
                          style={
                            {
                              background: STONE[owner - 1],
                              '--from': '-160%',
                            } as React.CSSProperties
                          }
                        >
                          {isLast && (
                            <span className='absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-err' />
                          )}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>

            {room.status === 'over' && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Susun lima batu dalam satu garis (mendatar, menurun, atau miring).
              Room hilang sendiri setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function GomokuPage() {
  const mounted = useMounted();

  return (
    <GameShell name='gomoku' wide>
      {mounted ? (
        <>
          <Gomoku />
          <RoomChat game='gomoku' />
        </>
      ) : null}
    </GameShell>
  );
}
