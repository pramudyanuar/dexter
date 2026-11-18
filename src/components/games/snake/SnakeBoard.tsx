'use client';

import * as React from 'react';

import { DELTA, Dir, GRID, Point } from '@/lib/games/snake';

import { isInteractive } from '@/components/games/snake/controls';

const CELL = 20;
const SIZE = GRID * CELL;

interface BoardSnake {
  snake: readonly Point[];
  dir: Dir;
  opponent?: boolean;
}

export default function SnakeBoard({
  snakes,
  food,
  active,
  boardRef,
  onSwipe,
  children,
}: {
  snakes: readonly BoardSnake[];
  food: Point | null;
  active: boolean;
  boardRef: React.RefObject<HTMLDivElement | null>;
  onSwipe: (dir: Dir) => void;
  children?: React.ReactNode;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const swipe = React.useRef<(Point & { id: number }) | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixels = Math.round(SIZE * ratio);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const style = getComputedStyle(canvas);
    const color = (name: string) => style.getPropertyValue(name).trim();
    const background = color('--card');
    const line = color('--line');
    const accent = color('--accent');
    const info = color('--info');
    const apple = color('--err');
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame = 0;

    function draw(pulse: number) {
      if (!ctx) return;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = line;
      ctx.globalAlpha = 0.24;
      for (let y = 0; y < GRID; y++) {
        for (let x = (y + 1) % 2; x < GRID; x += 2) {
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      ctx.globalAlpha = 1;

      if (food) {
        ctx.save();
        ctx.translate(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = apple;
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
        ctx.beginPath();
        ctx.arc(-3, -3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.ellipse(3, -8, 4, 2, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const { snake, dir, opponent } of snakes) {
        ctx.fillStyle = opponent ? info : accent;
        for (let i = snake.length - 1; i >= 0; i--) {
          const { x, y } = snake[i];
          const inset = i === 0 ? 0.5 : 1.5 + (i / snake.length) * 1.5;
          ctx.globalAlpha = i === 0 ? 1 : 0.9 - (i / snake.length) * 0.4;
          ctx.beginPath();
          ctx.roundRect(
            x * CELL + inset,
            y * CELL + inset,
            CELL - inset * 2,
            CELL - inset * 2,
            i === 0 ? 7 : 5,
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const head = snake[0];
        if (!head) continue;
        const { x: dx, y: dy } = DELTA[dir];
        for (const side of [-1, 1]) {
          const x = head.x * CELL + CELL / 2 + dx * 3 - dy * side * 4;
          const y = head.y * CELL + CELL / 2 + dy * 3 + dx * side * 4;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function animate(time: number) {
      draw(1 + Math.sin(time / 160) * 0.1);
      frame = requestAnimationFrame(animate);
    }

    function refresh() {
      cancelAnimationFrame(frame);
      draw(1);
      if (active && !motion?.matches && !document.hidden) {
        frame = requestAnimationFrame(animate);
      }
    }

    refresh();
    motion?.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelAnimationFrame(frame);
      motion?.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, food, snakes]);

  return (
    <div
      ref={boardRef}
      tabIndex={0}
      aria-label='Arena Snake'
      className='relative aspect-square touch-none rounded-lg border border-line focus-visible:outline-2 focus-visible:outline-accent'
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' || isInteractive(event.target))
          return;
        swipe.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerCancel={() => {
        swipe.current = null;
      }}
      onPointerUp={(event) => {
        const start = swipe.current;
        if (start?.id !== event.pointerId) return;
        swipe.current = null;
        const x = event.clientX - start.x;
        const y = event.clientY - start.y;
        if (Math.max(Math.abs(x), Math.abs(y)) < 24) return;
        if (Math.abs(x) > Math.abs(y)) onSwipe(x > 0 ? 'right' : 'left');
        else onSwipe(y > 0 ? 'down' : 'up');
      }}
    >
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        role='img'
        aria-label='Papan permainan ular'
        className='block size-full rounded-[inherit]'
      />
      {children}
    </div>
  );
}
