'use client';

import * as React from 'react';

import {
  COLORS,
  COORD_MAX,
  PictionaryView,
  Stroke,
  WIDTHS,
} from '@/lib/games/pictionary';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import Countdown from '@/components/games/Countdown';
import GameShell from '@/components/games/GameShell';
import RoomGate, { Rematch, seatLabel } from '@/components/games/RoomGate';

const W = 800;
const H = 600;
const ROUND_SECONDS = 80;
const CHUNK = 400; // numbers per request, matches the server limit

interface Batch {
  id: string;
  color: number;
  width: number;
  pts: number[];
}

function paint(canvas: HTMLCanvasElement | null, strokes: Stroke[]) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = ctx.fillStyle = COLORS[s.color];
    ctx.lineWidth = WIDTHS[s.width] * (W / COORD_MAX) * 1.2;
    const at = (i: number) => [
      (s.pts[i] / COORD_MAX) * W,
      (s.pts[i + 1] / COORD_MAX) * H,
    ];
    if (s.pts.length <= 2) {
      const [x, y] = at(0);
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(...(at(0) as [number, number]));
    for (let i = 2; i < s.pts.length; i += 2)
      ctx.lineTo(...(at(i) as [number, number]));
    ctx.stroke();
  }
}

function Canvas({
  strokes,
  canDraw,
  color,
  width,
  onSend,
  clearToken,
}: {
  strokes: Stroke[];
  canDraw: boolean;
  color: number;
  width: number;
  onSend: (batch: Batch) => Promise<void>;
  /** Changes when the drawer clears the board */
  clearToken: number;
}) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  // the drawer paints from what they drew locally, so lines never lag behind the pen
  const local = React.useRef<Stroke[]>(strokes);
  const queue = React.useRef<Batch[]>([]);
  const sending = React.useRef(false);
  const current = React.useRef<Stroke | null>(null);

  React.useEffect(() => {
    if (!canDraw) paint(ref.current, strokes);
  }, [canDraw, strokes]);

  React.useEffect(() => {
    if (clearToken > 0) {
      local.current = [];
      queue.current = [];
      paint(ref.current, []);
    }
  }, [clearToken]);

  React.useEffect(() => {
    if (canDraw) paint(ref.current, local.current);
  }, [canDraw]);

  const flush = React.useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      while (queue.current.length) {
        const batch = queue.current[0];
        const take = batch.pts.slice(0, CHUNK);
        const rest = batch.pts.slice(CHUNK);
        if (rest.length) queue.current[0] = { ...batch, pts: rest };
        else queue.current.shift();
        if (take.length >= 2) await onSend({ ...batch, pts: take });
      }
    } finally {
      sending.current = false;
    }
  }, [onSend]);

  // while drawing, send what has accumulated a few times per second
  React.useEffect(() => {
    if (!canDraw) return;
    const timer = setInterval(() => void flush(), 300);
    return () => clearInterval(timer);
  }, [canDraw, flush]);

  const point = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) =>
      Math.min(COORD_MAX, Math.max(0, Math.round(n)));
    return [
      clamp(((e.clientX - rect.left) / rect.width) * COORD_MAX),
      clamp(((e.clientY - rect.top) / rect.height) * COORD_MAX),
    ];
  };

  const down = (e: React.PointerEvent) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = point(e);
    const id = Math.random().toString(36).slice(2, 10);
    const stroke: Stroke = { id, color, width, pts: [x, y] };
    current.current = stroke;
    local.current = [...local.current, stroke];
    queue.current.push({ id, color, width, pts: [x, y] });
    paint(ref.current, local.current);
  };

  const move = (e: React.PointerEvent) => {
    const stroke = current.current;
    if (!canDraw || !stroke) return;
    const [x, y] = point(e);
    const n = stroke.pts.length;
    if (Math.hypot(x - stroke.pts[n - 2], y - stroke.pts[n - 1]) < 3) return;
    stroke.pts.push(x, y);
    // the batch for this stroke may already have been sent; the server joins
    // later points to the same stroke by id
    const tail = queue.current[queue.current.length - 1];
    if (tail?.id === stroke.id) tail.pts.push(x, y);
    else queue.current.push({ id: stroke.id, color, width, pts: [x, y] });
    paint(ref.current, local.current);
  };

  const up = () => {
    if (!current.current) return;
    current.current = null;
    void flush();
  };

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      aria-label='Kanvas gambar'
      data-testid='canvas'
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={`aspect-[4/3] w-full touch-none rounded-lg border-2 border-line bg-white shadow-md ${
        canDraw ? 'cursor-crosshair' : ''
      }`}
    />
  );
}

/** Ends the round when time is up. The drawer does it; others only if the drawer is gone. */
function RoundClock({
  isDrawer,
  onNext,
}: {
  isDrawer: boolean;
  onNext: () => void;
}) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Countdown
      seconds={ROUND_SECONDS}
      className='mb-3'
      onExpire={() => {
        if (isDrawer) onNext();
        else timer.current = setTimeout(onNext, 4000);
      }}
    />
  );
}

function PlayArea({
  v,
  you,
  r,
}: {
  v: PictionaryView;
  you: number;
  r: ReturnType<typeof useRoom<PictionaryView>>;
}) {
  const [color, setColor] = React.useState(0);
  const [width, setWidth] = React.useState(1);
  const [clearToken, setClearToken] = React.useState(0);
  const [text, setText] = React.useState('');
  const isDrawer = v.drawer === you;
  const done = v.winners !== null;
  const solvedMe = v.solved.includes(you);

  const send = React.useCallback(
    (batch: Batch) => r.move({ type: 'stroke', ...batch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r.session?.code, r.session?.token],
  );

  if (done) {
    const ranking = v.scores
      .map((score, seat) => ({ score, seat }))
      .sort((a, b) => b.score - a.score);
    const won = v.winners!.includes(you);
    return (
      <div className='a-pop text-center'>
        {won && <Confetti />}
        <p className='mb-3 text-lg'>
          {won ? (
            <span className='text-accent'>
              {v.winners!.length > 1 ? 'Kamu seri di puncak!' : 'Kamu juara!'}
            </span>
          ) : (
            <span className='text-err'>
              {v
                .winners!.map((w) => seatLabel(w, you, r.room?.names))
                .join(' & ')}{' '}
              juara.
            </span>
          )}
        </p>
        {v.last && (
          <p className='mb-3 text-xs text-mute'>Kata terakhir: {v.last.word}</p>
        )}
        <ol className='mx-auto max-w-xs divide-y divide-line border-y border-line text-sm'>
          {ranking.map(({ seat, score }, i) => (
            <li
              key={seat}
              className='a-slide-in flex justify-between py-1.5'
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <span>
                {i + 1}. {seatLabel(seat, you, r.room?.names)}
              </span>
              <span>{score}</span>
            </li>
          ))}
        </ol>
        <Rematch r={r} />
      </div>
    );
  }

  return (
    <>
      <ul
        className='mb-3 flex flex-wrap justify-center gap-2'
        aria-label='Skor'
      >
        {v.scores.map((score, seat) => (
          <li
            key={seat}
            data-seat={seat}
            className={`rounded-md border px-2.5 py-1 text-center text-xs ${
              seat === v.drawer
                ? 'a-glow border-accent bg-accent/10'
                : 'border-line text-mute'
            }`}
          >
            <p>
              {seat === v.drawer && '✏️ '}
              {seatLabel(seat, you, r.room?.names)}
              {v.solved.includes(seat) && (
                <span className='a-pop ml-1 inline-block text-accent'>✓</span>
              )}
            </p>
            <p key={score} className='a-pop text-base text-ink'>
              {score}
            </p>
          </li>
        ))}
      </ul>

      <div key={v.round} className='a-slide-up mb-2 text-center'>
        <p className='text-xs text-mute'>
          ronde {v.round + 1} dari {v.rounds}
          {v.last && (
            <>
              {' '}
              · kata tadi: <span className='text-ink'>{v.last.word}</span>
            </>
          )}
        </p>
        {isDrawer ? (
          <p className='mt-1 text-sm'>
            Gambar:{' '}
            <b
              className='text-xl tracking-wide text-accent uppercase'
              data-testid='word'
            >
              {v.word}
            </b>
          </p>
        ) : (
          <p className='mt-1 text-sm'>
            {seatLabel(v.drawer, you, r.room?.names)} menggambar:{' '}
            <b className='font-mono text-xl tracking-widest' data-testid='hint'>
              {v.hint}
            </b>
          </p>
        )}
      </div>

      <RoundClock
        key={v.round}
        isDrawer={isDrawer}
        onNext={() => r.move({ type: 'next', round: v.round })}
      />

      <Canvas
        key={v.round}
        strokes={v.strokes}
        canDraw={isDrawer}
        color={color}
        width={width}
        onSend={send}
        clearToken={clearToken}
      />

      {isDrawer ? (
        <div className='a-slide-up mt-3 flex flex-wrap items-center justify-center gap-3'>
          <div className='flex gap-1.5' role='group' aria-label='Warna'>
            {COLORS.map((c, i) => (
              <button
                key={c}
                type='button'
                aria-label={`Warna ${i + 1}`}
                aria-pressed={color === i}
                onClick={() => setColor(i)}
                className={`size-7 rounded-full border-2 border-line transition-transform ${
                  color === i ? 'scale-125 ring-2 ring-ink' : 'hover:scale-110'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div
            className='flex items-center gap-1.5'
            role='group'
            aria-label='Tebal garis'
          >
            {WIDTHS.map((w, i) => (
              <button
                key={w}
                type='button'
                aria-label={`Tebal ${i + 1}`}
                aria-pressed={width === i}
                onClick={() => setWidth(i)}
                className={`flex size-8 items-center justify-center rounded-md border ${
                  width === i ? 'border-accent bg-accent/10' : 'border-line'
                }`}
              >
                <span
                  className='rounded-full bg-ink'
                  style={{ width: 4 + i * 4, height: 4 + i * 4 }}
                />
              </button>
            ))}
          </div>
          <button
            type='button'
            onClick={() => {
              setClearToken((n) => n + 1);
              r.move({ type: 'clear' });
            }}
            className='text-xs text-info hover:underline'
          >
            [hapus]
          </button>
          <button
            type='button'
            onClick={() => r.move({ type: 'next', round: v.round })}
            className='text-xs text-mute hover:text-err'
          >
            [lewati kata]
          </button>
        </div>
      ) : (
        <form
          className='mt-3 flex items-center justify-center gap-2'
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim() || solvedMe) return;
            r.move({ type: 'guess', text });
            setText('');
          }}
        >
          {solvedMe ? (
            <span className='a-pop text-sm text-accent'>
              Tebakanmu benar! Tunggu yang lain…
            </span>
          ) : (
            <>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='Tebakanmu…'
                aria-label='Tebakan'
                maxLength={40}
                autoComplete='off'
                autoCorrect='off'
                spellCheck={false}
                className='w-52 rounded-sm border border-line bg-transparent px-2 py-1 placeholder:text-mute focus:border-accent focus:ring-0 focus:outline-none'
              />
              <button
                type='submit'
                disabled={!text.trim()}
                className='text-info hover:underline disabled:opacity-40'
              >
                [tebak]
              </button>
            </>
          )}
        </form>
      )}

      <ul
        className='mt-3 space-y-0.5 text-xs'
        aria-label='Tebakan'
        data-testid='guesses'
      >
        {v.guesses.slice(-8).map((g, i) => (
          <li key={`${i}-${g.seat}-${g.text}`} className='a-slide-in'>
            {g.correct ? (
              <span className='text-accent'>
                🎉 {seatLabel(g.seat, you, r.room?.names)} menebak dengan benar!
              </span>
            ) : (
              <span className='text-mute'>
                {seatLabel(g.seat, you, r.room?.names)}:{' '}
                <span className='text-ink'>{g.text}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Pictionary() {
  const r = useRoom<PictionaryView>('pictionary');

  return (
    <RoomGate
      r={r}
      command='tebak-gambar --online'
      blurb='# Tebak gambar untuk 2 sampai 6 pemain. Bergantian menggambar kata rahasia, yang lain menebak secepatnya. Yang lebih cepat dapat poin lebih banyak.'
    >
      {({ room, you }) => (
        <>
          <PlayArea v={room.state} you={you} r={r} />
          <p className='mt-auto pt-4 text-center text-xs text-mute'>
            Gambar muncul di layar penebak dengan jeda sekitar satu detik. Room
            hilang sendiri setelah 2 jam.
          </p>
        </>
      )}
    </RoomGate>
  );
}

export default function PictionaryPage() {
  const mounted = useMounted();

  return (
    <GameShell name='tebak-gambar' wide>
      {mounted ? <Pictionary /> : null}
    </GameShell>
  );
}
