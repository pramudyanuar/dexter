'use client';

import * as React from 'react';

import { ChessMove, ChessView, Piece, Promo } from '@/lib/games/chess';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

// filled glyphs for both sides; the variation selector keeps ♟ from turning into an emoji
const GLYPH: Record<string, string> = {
  K: '♚︎',
  Q: '♛︎',
  R: '♜︎',
  B: '♝︎',
  N: '♞︎',
  P: '♟︎',
};
const NAME = ['putih', 'hitam'] as const;
const PROMOS: Promo[] = ['Q', 'R', 'B', 'N'];

const same = (a: [number, number], b: [number, number]) =>
  a[0] === b[0] && a[1] === b[1];

function Glyph({ piece, small }: { piece: Piece; small?: boolean }) {
  const white = piece[0] === 'w';
  return (
    <span
      aria-hidden
      className={`leading-none select-none ${small ? 'text-lg' : 'text-[min(8vw,2.6rem)]'}`}
      style={{
        color: white ? '#fff' : '#18181b',
        textShadow: white
          ? '0 0 2px #000, 0 0 2px #000, 0 1px 3px rgb(0 0 0 / 0.6)'
          : '0 0 1px rgb(255 255 255 / 0.5), 0 1px 2px rgb(0 0 0 / 0.4)',
      }}
    >
      {GLYPH[piece[1]]}
    </span>
  );
}

const label = (piece: Piece) =>
  `${piece[0] === 'w' ? 'putih' : 'hitam'} ${
    { K: 'raja', Q: 'ratu', R: 'benteng', B: 'gajah', N: 'kuda', P: 'pion' }[
      piece[1]
    ]
  }`;

function Chess() {
  const r = useRoom<ChessView>('chess');
  const [from, setFrom] = React.useState<[number, number] | null>(null);
  const [promoting, setPromoting] = React.useState<ChessMove | null>(null);

  return (
    <RoomGate
      r={r}
      blurb='# Catur lengkap (rokade, en passant, promosi) untuk dua pemain di device berbeda. Pembuat room memegang putih.'
      barRight={
        r.session && (
          <span className='text-mute'>kamu: {NAME[r.session.you]}</span>
        )
      }
    >
      {({ room, you }) => {
        const s = room.state;
        const myTurn = room.status === 'playing' && s.turn === you;
        const flip = you === 1;
        const mine: 'w' | 'b' = you === 0 ? 'w' : 'b';

        const fromsWithMoves = new Set(
          s.legal.map((m) => `${m.from[0]},${m.from[1]}`),
        );
        const targets = from ? s.legal.filter((m) => same(m.from, from)) : [];

        const click = (row: number, col: number) => {
          if (!myTurn || r.busy) return;
          const options = targets.filter(
            (m) => m.to[0] === row && m.to[1] === col,
          );
          if (options.length) {
            const m = options[0];
            if (options.length > 1) {
              setPromoting(m); // pawn reaches the last rank: ask what to become
            } else {
              r.move({ from: m.from, to: m.to });
              setFrom(null);
            }
          } else if (fromsWithMoves.has(`${row},${col}`)) {
            setFrom([row, col]);
            setPromoting(null);
          } else {
            setFrom(null);
          }
        };

        const kingInCheck = s.check
          ? s.board.flatMap((rowArr, rr) =>
              rowArr.flatMap((p, cc) =>
                p === `${s.turn === 0 ? 'w' : 'b'}K` ? [`${rr},${cc}`] : [],
              ),
            )[0]
          : null;

        let status: React.ReactNode;
        if (s.status === 'checkmate') {
          status =
            s.winner === you ? (
              <span className='text-accent'>Skakmat! Kamu menang!</span>
            ) : (
              <span className='text-err'>Skakmat. Kamu kalah.</span>
            );
        } else if (s.status === 'stalemate') status = 'Pat (stalemate). Seri.';
        else if (s.status === 'draw') status = 'Seri.';
        else if (myTurn) {
          status = (
            <span className={s.check ? 'text-err' : 'text-accent'}>
              {s.check ? 'Skak! Selamatkan rajamu' : 'Giliranmu'}
            </span>
          );
        } else {
          status = (
            <span className='text-mute'>
              Giliran lawan{s.check ? ' (kena skak)' : ''}…
            </span>
          );
        }

        const order = Array.from({ length: 8 }, (_, i) => (flip ? 7 - i : i));
        const taken = (color: 'w' | 'b') =>
          s.taken.filter((p) => p[0] === color);

        return (
          <>
            {s.winner === you && <Confetti />}
            <div className='mb-1 flex min-h-6 items-center gap-0.5 text-xs text-mute'>
              <span className='mr-1'>lawan memakan</span>
              {taken(mine).map((p, i) => (
                <Glyph key={i} piece={p} small />
              ))}
            </div>

            <div
              role='grid'
              aria-label='Papan catur'
              className='relative mx-auto grid w-full max-w-[30rem] grid-cols-8 overflow-hidden rounded-md border-2 border-hash/60 shadow-lg'
            >
              {order.flatMap((row) =>
                order.map((col) => {
                  const piece = s.board[row][col];
                  const light = (row + col) % 2 === 0;
                  const target = targets.find(
                    (m) => m.to[0] === row && m.to[1] === col,
                  );
                  const isFrom = from && from[0] === row && from[1] === col;
                  const wasLast =
                    s.last &&
                    (same(s.last.from, [row, col]) ||
                      same(s.last.to, [row, col]));
                  const checked = kingInCheck === `${row},${col}`;
                  return (
                    <button
                      key={`${row}-${col}`}
                      type='button'
                      role='gridcell'
                      data-piece={piece ?? ''}
                      aria-label={`${String.fromCharCode(97 + col)}${8 - row}${piece ? ` ${label(piece)}` : ''}`}
                      onClick={() => click(row, col)}
                      className={`relative flex aspect-square items-center justify-center ${
                        light ? 'bg-[#ebecd0]' : 'bg-[#739552]'
                      } ${wasLast ? 'brightness-110 saturate-150' : ''} ${
                        isFrom ? 'ring-4 ring-accent ring-inset' : ''
                      }`}
                    >
                      {checked && (
                        <span className='a-glow absolute inset-0 bg-err/50' />
                      )}
                      {target && (
                        <span
                          className={`absolute z-10 rounded-full ${
                            piece
                              ? 'size-[88%] border-4 border-accent/70'
                              : 'a-glow size-1/3 bg-accent/70'
                          }`}
                        />
                      )}
                      {piece && (
                        <span
                          key={`${piece}-${row}-${col}`}
                          className={`a-pop relative ${
                            myTurn &&
                            piece[0] === mine &&
                            fromsWithMoves.has(`${row},${col}`)
                              ? 'cursor-pointer'
                              : ''
                          }`}
                        >
                          <Glyph piece={piece} />
                        </span>
                      )}
                    </button>
                  );
                }),
              )}

              {promoting && (
                <div className='a-fade absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-paper/85 backdrop-blur-sm'>
                  <p className='text-sm'>Promosikan pion menjadi:</p>
                  <div className='flex gap-2'>
                    {PROMOS.map((p) => (
                      <button
                        key={p}
                        type='button'
                        aria-label={`Promosi ${p}`}
                        onClick={() => {
                          r.move({
                            from: promoting.from,
                            to: promoting.to,
                            promo: p,
                          });
                          setPromoting(null);
                          setFrom(null);
                        }}
                        className='rounded-md border border-line bg-[#739552] p-2 transition-transform hover:scale-110'
                      >
                        <Glyph piece={`${mine}${p}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className='mt-1 flex min-h-6 items-center gap-0.5 text-xs text-mute'>
              <span className='mr-1'>kamu memakan</span>
              {taken(mine === 'w' ? 'b' : 'w').map((p, i) => (
                <Glyph key={i} piece={p} small />
              ))}
            </div>

            <p
              key={`${s.turn}-${s.status}-${s.check}`}
              className='a-slide-up mt-3 text-center text-sm'
              aria-live='polite'
            >
              {status}
            </p>

            {room.status === 'over' && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Klik bidak lalu petak tujuan; titik hijau menandai langkah yang
              sah. Room hilang sendiri setelah 2 jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function ChessPage() {
  const mounted = useMounted();

  return (
    <GameShell name='catur' wide>
      {mounted ? <Chess /> : null}
    </GameShell>
  );
}
