'use client';

import * as React from 'react';

import styles from '@/components/games/snake/snake.module.css';

import { DELTA, Dir, GRID, Point } from '@/lib/games/snake';

import { isInteractive } from '@/components/games/snake/controls';
import { slideSnake } from '@/components/games/snake/snake-motion';

const CELL = 20;
const SIZE = GRID * CELL;
const INSET = 3;
const SEGMENT = CELL - INSET * 2;
const OPPONENT_BUFFER_MS = 33;

interface SnakeSlide {
  from: readonly Point[];
  to: readonly Point[];
  dir: Dir;
}

interface BoardSnake {
  snake: readonly Point[];
  dir: Dir;
  opponent?: boolean;
  slide?: SnakeSlide;
  catchUp?: SnakeSlide;
}

export default function SnakeBoard({
  snakes,
  food,
  boardRef,
  onSwipe,
  children,
  motion,
}: {
  snakes: readonly BoardSnake[];
  food: Point | null;
  boardRef: React.RefObject<HTMLDivElement | null>;
  onSwipe: (dir: Dir) => void;
  children?: React.ReactNode;
  motion?: { receivedAt: number; durationMs: number };
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
    const boardColor = color('--card');
    const gridColor = color('--snake-grid');
    const foodColor = color('--err');
    const playerColor = color('--accent');
    const opponentColor = color('--info');
    const bodyColor = color('--snake-body');
    const eyeColor = color('--paper');
    const animation = window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches
      ? undefined
      : motion;
    const startedAt =
      performance.now() - (animation ? Date.now() - animation.receivedAt : 0);
    let request = 0;

    function paint(ctx: CanvasRenderingContext2D, now: number) {
      const progress = animation
        ? Math.max(0, Math.min(1, (now - startedAt) / animation.durationMs))
        : 1;
      ctx.fillStyle = boardColor;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = gridColor;
      for (let offset = CELL; offset < SIZE; offset += CELL) {
        ctx.fillRect(offset, 0, 1, SIZE);
        ctx.fillRect(0, offset, SIZE, 1);
      }

      if (food) {
        const x = (food.x + 0.5) * CELL;
        const y = (food.y + 0.5) * CELL;
        ctx.fillStyle = foodColor;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 6, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 6, y);
        ctx.fill();
      }

      for (const { snake, dir, opponent, slide, catchUp } of snakes) {
        // Give the opponent a short buffer for confirmed turns without adding a full tick of delay.
        const offset =
          animation && catchUp
            ? Math.min(1, OPPONENT_BUFFER_MS / animation.durationMs)
            : 0;
        const position = progress - offset;
        const move = animation && (position < 0 ? catchUp : slide);
        const path = move
          ? slideSnake(
              move.from,
              move.to,
              position < 0 ? 1 + position : position,
            )
          : snake;
        const [head] = path;
        if (!head) continue;
        const headColor = opponent ? opponentColor : playerColor;
        ctx.fillStyle = opponent ? headColor : bodyColor;
        for (let i = 1; i < path.length; i++) {
          const { x, y } = path[i];
          const previous = path[i - 1];
          ctx.fillRect(
            Math.min(x, previous.x) * CELL + INSET,
            Math.min(y, previous.y) * CELL + INSET,
            Math.abs(x - previous.x) * CELL + SEGMENT,
            Math.abs(y - previous.y) * CELL + SEGMENT,
          );
        }
        ctx.fillStyle = headColor;
        ctx.fillRect(
          head.x * CELL + INSET,
          head.y * CELL + INSET,
          SEGMENT,
          SEGMENT,
        );
        ctx.fillStyle = eyeColor;
        const { x: dx, y: dy } = DELTA[move ? move.dir : dir];
        for (const side of [-1, 1]) {
          const x = (head.x + 0.5) * CELL + dx * 4 - dy * side * 3;
          const y = (head.y + 0.5) * CELL + dy * 4 + dx * side * 3;
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      if (animation && progress < 1)
        request = requestAnimationFrame((at) => paint(ctx, at));
    }

    paint(ctx, performance.now());
    return () => cancelAnimationFrame(request);
  }, [food, motion, snakes]);

  return (
    <div
      ref={boardRef}
      tabIndex={0}
      aria-label='Arena Snake'
      className={styles.board}
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
        className='block size-full'
      />
      {children}
    </div>
  );
}
