'use client';

import * as React from 'react';

import {
  delayFor,
  Dir,
  GRID,
  initialSnake,
  SnakeState,
  step,
  turn,
} from '@/lib/games/snake';
import useStoredState from '@/lib/useStoredState';

import AuthGate from '@/components/AuthGate';
import GameShell from '@/components/games/GameShell';

const CELL = 20;
const SIZE = GRID * CELL;

type Status = 'ready' | 'running' | 'paused' | 'over';

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function Snake() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const game = React.useRef<SnakeState | null>(null);
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const [status, setStatus] = React.useState<Status>('ready');
  const [score, setScore] = React.useState(0);
  const [best, setBest] = useStoredState<number>('snake-best', 0);

  const draw = React.useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    const state = game.current;
    if (!ctx || !state) return;

    // colours come from the theme, so light and dark both work
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();

    ctx.fillStyle = color('--card');
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = color('--err');
    ctx.fillRect(
      state.food.x * CELL + 3,
      state.food.y * CELL + 3,
      CELL - 6,
      CELL - 6,
    );

    ctx.fillStyle = color('--accent');
    state.snake.forEach((p, i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.75;
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
    ctx.globalAlpha = 1;
  }, []);

  React.useEffect(() => {
    game.current = initialSnake();
    draw();
  }, [draw]);

  // one step at a time, so the delay can shrink as the score grows
  React.useEffect(() => {
    if (status !== 'running') return;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const before = game.current!;
      const after = step(before);
      game.current = after;
      draw();
      if (after.score !== before.score) setScore(after.score);

      if (after.dead) {
        setStatus('over');
        if (after.score > best) setBest(after.score);
        return;
      }
      timer = setTimeout(tick, delayFor(after.score));
    };

    timer = setTimeout(tick, delayFor(game.current!.score));
    return () => clearTimeout(timer);
  }, [status, draw, best, setBest]);

  const restart = () => {
    game.current = initialSnake();
    setScore(0);
    setStatus('ready');
    draw();
  };

  const steer = (dir: Dir) => {
    if (status === 'over' || !game.current) return;
    game.current = turn(game.current, dir);
    if (status === 'ready' || status === 'paused') setStatus('running');
  };

  const togglePause = () => {
    if (status === 'running') setStatus('paused');
    else if (status === 'ready' || status === 'paused') setStatus('running');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
    if (dir) {
      e.preventDefault(); // arrow keys would scroll the page
      steer(dir);
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'Enter' && status === 'over') {
      restart();
    }
  };

  // re-bound on each render so it always sees the current status
  React.useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    const end = e.changedTouches[0];
    touchStart.current = null;
    if (!start) return;

    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    steer(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? 'right'
          : 'left'
        : dy > 0
          ? 'down'
          : 'up',
    );
  };

  const pad = (dir: Dir, label: string, extra: string) => (
    <button
      type='button'
      aria-label={dir}
      onClick={() => steer(dir)}
      className={`h-12 rounded-sm border border-line bg-card text-lg ${extra}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className='mb-3 flex justify-between text-xs text-mute'>
        <span>
          skor <span className='text-ink'>{score}</span>
        </span>
        <span>
          terbaik <span className='text-ink'>{best}</span>
        </span>
      </div>

      <div className='relative'>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          aria-label='Papan permainan ular'
          onTouchStart={(e) => {
            touchStart.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }}
          onTouchEnd={onTouchEnd}
          className='aspect-square w-full touch-none rounded-sm border border-line'
        />
        {status !== 'running' && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/70 text-center'>
            {status === 'over' ? (
              <>
                <p className='text-err'>Game over. Skor {score}.</p>
                <button
                  type='button'
                  onClick={restart}
                  className='text-info hover:underline'
                >
                  [main lagi]
                </button>
              </>
            ) : (
              <p className='px-6 text-mute'>
                {status === 'paused'
                  ? 'Jeda. Tekan spasi atau panah untuk lanjut.'
                  : 'Tekan panah atau WASD untuk mulai.'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className='mx-auto mt-4 grid w-40 grid-cols-3 gap-1.5 md:hidden'>
        {pad('up', '↑', 'col-start-2')}
        {pad('left', '←', 'col-start-1 row-start-2')}
        {pad('down', '↓', 'col-start-2 row-start-2')}
        {pad('right', '→', 'col-start-3 row-start-2')}
      </div>
    </>
  );
}

export default function SnakePage() {
  return (
    <AuthGate>
      <GameShell name='snake'>
        <Snake />
      </GameShell>
    </AuthGate>
  );
}
