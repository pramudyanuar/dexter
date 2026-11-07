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

  const particles = React.useRef<
    { x: number; y: number; vx: number; vy: number; life: number }[]
  >([]);

  const draw = React.useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    const state = game.current;
    if (!ctx || !state) return;

    // colours come from the theme, so light and dark both work
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const now = performance.now();

    // checkerboard
    ctx.fillStyle = color('--card');
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = color('--line');
    ctx.globalAlpha = 0.22;
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if ((x + y) % 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    ctx.globalAlpha = 1;

    // food: a pulsing apple with a leaf
    const pulse = 1 + Math.sin(now / 160) * 0.1;
    const fx = state.food.x * CELL + CELL / 2;
    const fy = state.food.y * CELL + CELL / 2 + 1;
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = color('--err');
    ctx.shadowBlur = 10;
    ctx.fillStyle = color('--err');
    ctx.beginPath();
    ctx.arc(0, 0, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
    ctx.beginPath();
    ctx.arc(-3, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color('--accent');
    ctx.beginPath();
    ctx.ellipse(3, -CELL / 2 + 2, 4, 2, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // body: rounded segments that fade towards the tail
    const total = state.snake.length;
    ctx.fillStyle = color('--accent');
    for (let i = total - 1; i >= 0; i--) {
      const p = state.snake[i];
      const inset = i === 0 ? 0.5 : 1.5 + (i / total) * 1.5;
      ctx.globalAlpha = i === 0 ? 1 : 0.9 - (i / total) * 0.4;
      ctx.beginPath();
      ctx.roundRect(
        p.x * CELL + inset,
        p.y * CELL + inset,
        CELL - inset * 2,
        CELL - inset * 2,
        i === 0 ? 7 : 5,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // eyes follow the direction of travel
    const head = state.snake[0];
    const look = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    }[state.dir];
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    for (const side of [-1, 1]) {
      const ex = cx + look[0] * 3 + -look[1] * side * 4;
      const ey = cy + look[1] * 3 + look[0] * side * 4;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(ex + look[0], ey + look[1], 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // sparkles when the apple is eaten
    particles.current = particles.current.filter((q) => q.life > 0);
    for (const q of particles.current) {
      q.x += q.vx;
      q.y += q.vy;
      q.life -= 0.04;
      ctx.globalAlpha = Math.max(q.life, 0);
      ctx.fillStyle = color('--err');
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.5 * q.life + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  // keep redrawing so the apple pulses and the sparkles move
  React.useEffect(() => {
    let frame = requestAnimationFrame(function loop() {
      draw();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [draw]);

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
      if (after.score !== before.score) {
        setScore(after.score);
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          particles.current.push({
            x: before.food.x * CELL + CELL / 2,
            y: before.food.y * CELL + CELL / 2,
            vx: Math.cos(angle) * (1 + (i % 3) * 0.5),
            vy: Math.sin(angle) * (1 + (i % 3) * 0.5),
            life: 1,
          });
        }
      }

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
      className={`h-12 rounded-md border border-line bg-card text-lg transition-transform active:scale-90 active:bg-accent/20 ${extra}`}
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
          <div className='a-fade absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-sm bg-paper/70 text-center backdrop-blur-[2px]'>
            {status === 'over' ? (
              <>
                <p className='a-pop text-err'>Game over. Skor {score}.</p>
                <button
                  type='button'
                  onClick={restart}
                  className='text-info hover:underline'
                >
                  [main lagi]
                </button>
              </>
            ) : (
              <p className='a-bob px-6 text-mute'>
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
    <GameShell name='snake'>
      <Snake />
    </GameShell>
  );
}
