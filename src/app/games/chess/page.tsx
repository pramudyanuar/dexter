'use client';

import * as React from 'react';

import { ChessMove, ChessView, Piece, Point, Promo } from '@/lib/games/chess';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import ConfirmDialog from '@/components/ConfirmDialog';
import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomChat from '@/components/games/RoomChat';
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

const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];

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
  const [from, setFrom] = React.useState<Point | null>(null);
  const [promoting, setPromoting] = React.useState<ChessMove | null>(null);
  const [claimAt, setClaimAt] = React.useState<number | null>(null);
  const [confirmResign, setConfirmResign] = React.useState<string | null>(null);
  const drag = React.useRef<{
    square: Point;
    piece: Piece;
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = React.useRef(false);
  const [ghost, setGhost] = React.useState<{
    piece: Piece;
    x: number;
    y: number;
  } | null>(null);

  return (
    <RoomGate
      r={r}
      blurb='# Chess lengkap (rokade, en passant, promosi) untuk dua pemain di device berbeda. Pembuat room memegang putih.'
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
        const claiming = myTurn && claimAt === room.version;
        const legal = claiming ? (s.drawMoves ?? []) : s.legal;
        const promotion =
          promoting &&
          legal.some(
            (m) => same(m.from, promoting.from) && same(m.to, promoting.to),
          )
            ? promoting
            : null;
        const roomVersion = `${room.code}:${room.version}`;

        const fromsWithMoves = new Set(
          legal.map((m) => `${m.from[0]},${m.from[1]}`),
        );
        const targets = from ? legal.filter((m) => same(m.from, from)) : [];

        const moveTo = (origin: Point, row: number, col: number) => {
          if (!myTurn || r.busy || promotion) return false;
          const options = legal.filter(
            (m) => same(m.from, origin) && same(m.to, [row, col]),
          );
          const move = options[0];
          if (!move) return false;
          if (claiming) {
            r.move({ type: 'claim_draw', from: move.from, to: move.to });
            setClaimAt(null);
            setFrom(null);
          } else if (options.length > 1) {
            setPromoting(move); // pawn reaches the last rank: ask what to become
          } else {
            r.move({ from: move.from, to: move.to });
            setFrom(null);
          }
          return true;
        };

        const click = (row: number, col: number) => {
          if (!myTurn || r.busy || promotion) return;
          if (from && moveTo(from, row, col)) return;
          if (fromsWithMoves.has(`${row},${col}`)) {
            setFrom([row, col]);
          } else {
            setFrom(null);
          }
        };

        const clearDrag = (pointerId: number) => {
          const active = drag.current;
          if (active?.id !== pointerId) return null;
          drag.current = null;
          setGhost(null);
          return active;
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
        } else if (s.status === 'resigned') {
          status =
            s.winner === you ? (
              <span className='text-accent'>
                Lawan menyerah atau keluar. Kamu menang!
              </span>
            ) : (
              <span className='text-err'>
                Kamu menyerah atau keluar dari permainan.
              </span>
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
            {s.canClaimDraw && (
              <button
                type='button'
                className='mb-2 self-center text-sm text-info hover:underline'
                disabled={r.busy}
                onClick={() => r.move({ type: 'claim_draw' })}
              >
                Klaim seri karena posisi berulang
              </button>
            )}
            {!!s.drawMoves?.length && (
              <button
                type='button'
                className='mb-2 self-center text-sm text-info hover:underline'
                disabled={r.busy}
                onClick={() => {
                  setFrom(null);
                  setPromoting(null);
                  setClaimAt(claiming ? null : room.version);
                }}
              >
                {claiming
                  ? 'Batal klaim seri'
                  : 'Pilih langkah untuk klaim seri'}
              </button>
            )}
            <div className='mb-1 flex min-h-6 items-center gap-0.5 text-xs text-mute'>
              <span className='mr-1'>lawan memakan</span>
              {taken(mine).map((p, i) => (
                <Glyph key={i} piece={p} small />
              ))}
            </div>

            {room.status === 'playing' &&
              s.drawOffer != null &&
              s.drawOffer !== you && (
                <div className='mx-auto mb-2 flex w-full max-w-[30rem] flex-wrap items-center justify-between gap-2 rounded-lg border border-hash/50 bg-surface px-3 py-2 shadow-sm'>
                  <p role='status' className='text-sm font-semibold text-ink'>
                    Lawan menawarkan remis
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    <button
                      type='button'
                      className='min-h-11 rounded-md border border-line px-3 text-sm text-ink hover:border-hash disabled:opacity-50'
                      disabled={r.busy}
                      onClick={() => r.move({ type: 'decline_draw' })}
                    >
                      Tolak remis
                    </button>
                    <button
                      type='button'
                      className='min-h-11 rounded-md bg-ink px-3 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50'
                      disabled={r.busy}
                      onClick={() => r.move({ type: 'accept_draw' })}
                    >
                      Terima remis
                    </button>
                  </div>
                </div>
              )}

            <div
              role='grid'
              aria-label='Papan chess'
              className='relative mx-auto grid w-full max-w-[30rem] grid-cols-8 overflow-hidden rounded-md border-2 border-hash/60 shadow-lg'
              onPointerDownCapture={() => {
                suppressClick.current = false;
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (active?.id !== event.pointerId) return;
                if (!active.moved) {
                  if (
                    Math.hypot(
                      event.clientX - active.x,
                      event.clientY - active.y,
                    ) < 6
                  )
                    return;
                  active.moved = true;
                  setFrom(active.square);
                }
                const board = event.currentTarget.getBoundingClientRect();
                setGhost({
                  piece: active.piece,
                  x: event.clientX - board.left,
                  y: event.clientY - board.top,
                });
              }}
              onPointerUp={(event) => {
                const active = clearDrag(event.pointerId);
                if (!active?.moved) return;
                suppressClick.current = true;
                const target = document
                  .elementFromPoint(event.clientX, event.clientY)
                  ?.closest<HTMLElement>('[data-square]');
                if (
                  target?.dataset.square &&
                  event.currentTarget.contains(target)
                ) {
                  const [row, col] = target.dataset.square
                    .split(',')
                    .map(Number);
                  if (moveTo(active.square, row, col)) return;
                }
                setFrom(null);
              }}
              onPointerCancel={(event) => {
                if (clearDrag(event.pointerId)?.moved) setFrom(null);
              }}
              onLostPointerCapture={(event) => {
                if (clearDrag(event.pointerId)?.moved) setFrom(null);
              }}
              onClickCapture={(event) => {
                if (suppressClick.current && event.detail > 0)
                  event.stopPropagation();
              }}
            >
              {order.flatMap((row) =>
                order.map((col) => {
                  const piece = s.board[row][col];
                  const light = (row + col) % 2 === 0;
                  const target = targets.find(
                    (m) => m.to[0] === row && m.to[1] === col,
                  );
                  const isFrom = from && from[0] === row && from[1] === col;
                  const draggable =
                    myTurn &&
                    !r.busy &&
                    !promotion &&
                    !!piece &&
                    fromsWithMoves.has(`${row},${col}`);
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
                      data-square={`${row},${col}`}
                      aria-label={`${String.fromCharCode(97 + col)}${8 - row}${piece ? ` ${label(piece)}` : ''}`}
                      onClick={() => click(row, col)}
                      onPointerDown={(event) => {
                        if (
                          !draggable ||
                          !event.isPrimary ||
                          event.button !== 0
                        )
                          return;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        drag.current = {
                          square: [row, col],
                          piece,
                          id: event.pointerId,
                          x: event.clientX,
                          y: event.clientY,
                          moved: false,
                        };
                      }}
                      className={`relative flex aspect-square items-center justify-center ${
                        light ? 'bg-[#ebecd0]' : 'bg-[#739552]'
                      } ${wasLast ? 'brightness-110 saturate-150' : ''} ${
                        isFrom ? 'ring-4 ring-accent ring-inset' : ''
                      } ${draggable ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
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
                          className={`a-pop relative ${isFrom && ghost ? 'invisible' : ''}`}
                        >
                          <Glyph piece={piece} />
                        </span>
                      )}
                    </button>
                  );
                }),
              )}

              {ghost && (
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center'
                  style={{ left: ghost.x, top: ghost.y }}
                >
                  <Glyph piece={ghost.piece} />
                </span>
              )}

              {promotion && (
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
                            from: promotion.from,
                            to: promotion.to,
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

            {room.status === 'playing' && (
              <div className='mt-3 flex flex-wrap items-center justify-center gap-2 text-sm'>
                {s.drawOffer == null &&
                  (s.drawOfferUsed?.[you] ? (
                    <span className='text-mute'>
                      Mainkan satu langkah sebelum menawarkan remis lagi
                    </span>
                  ) : (
                    <button
                      type='button'
                      className='text-mute'
                      disabled={r.busy}
                      onClick={() => r.move({ type: 'offer_draw' })}
                    >
                      Tawarkan remis
                    </button>
                  ))}
                {s.drawOffer === you && (
                  <span role='status' className='text-mute'>
                    Menunggu jawaban tawaran remis
                  </span>
                )}
                <button
                  type='button'
                  className='text-err'
                  disabled={r.busy}
                  onClick={() => setConfirmResign(roomVersion)}
                >
                  Menyerah
                </button>
                {confirmResign === roomVersion && (
                  <ConfirmDialog
                    title='Menyerah?'
                    message='Pertandingan berakhir dengan kemenangan lawan.'
                    confirmLabel='Menyerah'
                    cancelLabel='Batal'
                    danger
                    onCancel={() => setConfirmResign(null)}
                    onConfirm={() => {
                      setConfirmResign(null);
                      r.move({ type: 'resign' });
                    }}
                  />
                )}
              </div>
            )}

            {room.status === 'over' && <Rematch r={r} />}
            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              Geser bidak atau klik bidak lalu petak tujuan. Titik hijau
              menandai langkah yang sah. Room hilang sendiri setelah 2 jam.
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
    <GameShell name='chess' wide>
      {mounted ? (
        <>
          <Chess />
          <RoomChat game='chess' />
        </>
      ) : null}
    </GameShell>
  );
}
