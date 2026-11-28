import { HEIGHT, WIDTH } from './content';

type Point = { x: number; y: number };
export type Framing = Point & { width: number };
export const WIDE: Framing = { x: WIDTH / 2, y: HEIGHT / 2, width: WIDTH };
export const ASPECT = WIDTH / HEIGHT;

export function frameRunners(runners: Point[], fixed: boolean): Framing {
  if (fixed || !runners.length) return WIDE;
  const left = Math.min(...runners.map((p) => p.x)) - 4;
  const right = Math.max(...runners.map((p) => p.x)) + 5;
  const bottom = Math.min(...runners.map((p) => p.y)) - 2;
  const top = Math.max(...runners.map((p) => p.y)) + 3.4;
  const width = Math.min(
    WIDTH,
    Math.max(18, right - left, (top - bottom) * ASPECT),
  );
  const height = width / ASPECT;
  return {
    x: Math.max(width / 2, Math.min(WIDTH - width / 2, (left + right) / 2)),
    y: Math.max(height / 2, Math.min(HEIGHT - height / 2, (bottom + top) / 2)),
    width,
  };
}
