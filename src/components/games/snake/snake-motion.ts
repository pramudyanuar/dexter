import { Point, samePoint } from '@/lib/games/snake';

function between(from: Point, to: Point, progress: number): Point {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function slideSnake(
  from: readonly Point[],
  to: readonly Point[],
  progress: number,
): readonly Point[] {
  if (progress >= 1 || !from[0] || !to[1] || !samePoint(from[0], to[1]))
    return to;
  if (progress <= 0) return from;

  // Keep bends anchored to the grid while the head and tail travel along it.
  const path = [between(from[0], to[0], progress), ...to.slice(1)];
  if (from.length === to.length) {
    path.push(between(from[from.length - 1], to[to.length - 1], progress));
  }
  return path;
}
