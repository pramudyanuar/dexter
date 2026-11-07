'use client';

import * as React from 'react';

import {
  colorIndex,
  COLS,
  delayFor,
  hardDrop,
  landingY,
  moveSideways,
  newGame,
  PieceType,
  rotate,
  ROWS,
  softDrop,
  spawn,
  TetrisState,
  tick,
} from '@/lib/games/tetris';
import useStoredState from '@/lib/useStoredState';

import GameShell from '@/components/games/GameShell';

const CELL = 24;
const W = COLS * CELL;
const H = ROWS * CELL;
const PREVIEW = 4 * 18;

// index = colorIndex(type) - 1, in PIECE_TYPES order: I O T S Z J L
const COLORS = [
  'hsl(190 70% 50%)',
  'hsl(48 90% 55%)',
  'hsl(280 60% 62%)',
  'hsl(130 60% 45%)',
  'hsl(0 70% 58%)',
  'hsl(220 70% 62%)',
  'hsl(28 85% 55%)',
];

type Status = 'ready' | 'running' | 'paused' | 'over';

function PadButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type='button'
      aria-label={label}
      onClick={onPress}
      className='h-12 flex-1 rounded-md border border-line bg-card text-lg transition-transform active:scale-90 active:bg-accent/20'
    >
      {label}
    </button>
  );
}

function Tetris() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const game = React.useRef<TetrisState | null>(null);
  const [status, setStatus] = React.useState<Status>('ready');
  const [stats, setStats] = React.useState({ score: 0, lines: 0, level: 1 });
  const [best, setBest] = useStoredState<number>('tetris-best', 0);

  /** Beveled block: light top-left edge, dark bottom-right, bright core. */
  const drawBlock = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    alpha = 1,
  ) => {
    const px = x * size + 1;
    const py = y * size + 1;
    const w = size - 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(px, py, w, w, 3);
    ctx.fill();
    const grad = ctx.createLinearGradient(px, py, px + w, py + w);
    grad.addColorStop(0, 'rgb(255 255 255 / 0.45)');
    grad.addColorStop(0.5, 'rgb(255 255 255 / 0)');
    grad.addColorStop(1, 'rgb(0 0 0 / 0.3)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(px, py, w, w, 3);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.25)';
    ctx.fillRect(px + 3, py + 3, w - 6, 2);
    ctx.globalAlpha = 1;
  };

  const draw = React.useCallback(() => {
    const state = game.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!state || !ctx) return;

    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue('--card').trim();
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css.getPropertyValue('--line').trim();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(W, y * CELL + 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    state.board.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell) drawBlock(ctx, x, y, CELL, COLORS[cell - 1]);
      }),
    );

    if (!state.over) {
      const { piece } = state;
      const color = COLORS[colorIndex(piece.type) - 1];
      const ghostY = landingY(state);
      piece.matrix.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (!cell) return;
          drawBlock(ctx, piece.x + c, ghostY + r, CELL, color, 0.22);
          drawBlock(ctx, piece.x + c, piece.y + r, CELL, color);
        }),
      );
    }

    const preview = previewRef.current?.getContext('2d');
    if (preview) {
      preview.fillStyle = css.getPropertyValue('--card').trim();
      preview.fillRect(0, 0, PREVIEW, PREVIEW);
      const next = spawn(state.queue[0] as PieceType);
      const offset = (4 - next.matrix.length) / 2;
      next.matrix.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell) {
            drawBlock(
              preview,
              c + offset,
              r + offset,
              18,
              COLORS[colorIndex(next.type) - 1],
            );
          }
        }),
      );
    }
  }, []);

  const commit = React.useCallback(
    (next: TetrisState) => {
      const before = game.current;
      game.current = next;
      draw();
      if (
        !before ||
        before.score !== next.score ||
        before.lines !== next.lines ||
        before.level !== next.level
      ) {
        setStats({ score: next.score, lines: next.lines, level: next.level });
      }
      if (next.over) {
        setStatus('over');
        if (next.score > best) setBest(next.score);
      }
    },
    [draw, best, setBest],
  );

  React.useEffect(() => {
    game.current = newGame();
    draw();
  }, [draw]);

  // gravity: one tick at a time so the delay can shrink with the level
  React.useEffect(() => {
    if (status !== 'running') return;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      commit(tick(game.current!));
      if (!game.current!.over) {
        timer = setTimeout(step, delayFor(game.current!.level));
      }
    };
    timer = setTimeout(step, delayFor(game.current!.level));
    return () => clearTimeout(timer);
  }, [status, commit]);

  const restart = () => {
    game.current = newGame();
    setStats({ score: 0, lines: 0, level: 1 });
    setStatus('ready');
    draw();
  };

  const act = (fn: (s: TetrisState) => TetrisState) => {
    if (!game.current || status === 'over') return;
    if (status === 'ready' || status === 'paused') setStatus('running');
    commit(fn(game.current));
  };

  const togglePause = () => {
    if (status === 'running') setStatus('paused');
    else if (status === 'paused' || status === 'ready') setStatus('running');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => act((s) => moveSideways(s, -1)),
      a: () => act((s) => moveSideways(s, -1)),
      ArrowRight: () => act((s) => moveSideways(s, 1)),
      d: () => act((s) => moveSideways(s, 1)),
      ArrowUp: () => act((s) => rotate(s)),
      w: () => act((s) => rotate(s)),
      x: () => act((s) => rotate(s)),
      z: () => act((s) => rotate(s, false)),
      ArrowDown: () => act((s) => softDrop(s)),
      s: () => act((s) => softDrop(s)),
      ' ': () => act((s) => hardDrop(s)),
      p: togglePause,
    };
    if (key === 'Enter' && status === 'over') {
      e.preventDefault();
      restart();
    } else if (actions[key]) {
      e.preventDefault(); // arrow keys and space would scroll the page
      actions[key]();
    }
  };

  // re-bound on each render so it always sees the current status
  React.useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <>
      <div className='mx-auto flex w-full max-w-[22rem] gap-4'>
        <div className='relative min-w-0 flex-1'>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            aria-label='Papan Tetris'
            className='aspect-[1/2] w-full rounded-sm border border-line'
          />
          {status !== 'running' && (
            <div className='a-fade absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-sm bg-paper/70 px-4 text-center backdrop-blur-[2px]'>
              {status === 'over' ? (
                <>
                  <p className='a-pop text-err'>
                    Game over. Skor {stats.score}.
                  </p>
                  <button
                    type='button'
                    onClick={restart}
                    className='text-info hover:underline'
                  >
                    [main lagi]
                  </button>
                </>
              ) : (
                <p className='a-bob text-mute'>
                  {status === 'paused'
                    ? 'Jeda. Tekan P atau gerakkan bidak untuk lanjut.'
                    : 'Tekan panah atau spasi untuk mulai.'}
                </p>
              )}
            </div>
          )}
        </div>

        <div className='w-[4.5rem] shrink-0 space-y-3 text-xs'>
          <div>
            <p className='text-mute'>berikut</p>
            <canvas
              ref={previewRef}
              width={PREVIEW}
              height={PREVIEW}
              aria-label='Bidak berikutnya'
              className='mt-1 w-full rounded-sm border border-line'
            />
          </div>
          <div>
            <p className='text-mute'>skor</p>
            <p key={stats.score} className='a-pop text-ink'>
              {stats.score}
            </p>
          </div>
          <div>
            <p className='text-mute'>baris</p>
            <p className='text-ink'>{stats.lines}</p>
          </div>
          <div>
            <p className='text-mute'>level</p>
            <p className='text-ink'>{stats.level}</p>
          </div>
          <div>
            <p className='text-mute'>terbaik</p>
            <p className='text-ink'>{best}</p>
          </div>
        </div>
      </div>

      <div className='mx-auto mt-4 flex w-full max-w-[22rem] gap-1.5 md:hidden'>
        <PadButton label='◀' onPress={() => act((s) => moveSideways(s, -1))} />
        <PadButton label='⟳' onPress={() => act((s) => rotate(s))} />
        <PadButton label='▶' onPress={() => act((s) => moveSideways(s, 1))} />
        <PadButton label='▼' onPress={() => act((s) => softDrop(s))} />
        <PadButton label='⤓' onPress={() => act((s) => hardDrop(s))} />
      </div>

      <p className='mt-auto pt-4 text-center text-xs text-mute'>
        ← → geser · ↑ putar · ↓ turun · spasi jatuhkan · P jeda
      </p>
    </>
  );
}

export default function TetrisPage() {
  return (
    <GameShell name='tetris' wide>
      <Tetris />
    </GameShell>
  );
}
