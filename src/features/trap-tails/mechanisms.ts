import type { Rect, Surface } from './content';

export type Direction = 0 | 1 | 2 | 3;
export type Point = { x: number; y: number };
export type GadgetKind =
  'spikes' | 'arrow' | 'coin' | 'fan' | 'piston' | 'swing';
export type Gadget = Point & {
  id: string;
  kind: GadgetKind;
  turn: Direction;
  owner?: number;
  mount?: string;
};
export type Bolt = Point & {
  id: string;
  from: Point;
  turn: Direction;
  owner?: number;
  life: number;
  stopped?: boolean;
};

export const VECTOR = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
] as const;
export const GADGET_DIMENSIONS = {
  spikes: [2, 0.5],
  arrow: [1, 1],
  coin: [0.5, 0.5],
  fan: [1, 1],
  piston: [1.25, 0.85],
  swing: [0.75, 0.75],
} as const;
export const SWING_LENGTH = 2.25;
export const SWING_RADIUS = 0.34;
export const FAN_RANGE = 4;
export const FAN_ACCELERATION = 21;
export const COIN_RADIUS = 0.25;

export function at(
  origin: Point,
  u: number,
  v: number,
  turn: Direction,
): Point {
  const axis = VECTOR[turn];
  return {
    x: origin.x + u * axis.x - v * axis.y,
    y: origin.y + u * axis.y + v * axis.x,
  };
}

export function footprint(
  point: Point,
  w: number,
  h: number,
  turn: Direction = 0,
): Rect {
  if (turn % 2) [w, h] = [h, w];
  return { x: point.x - w / 2, y: point.y - h / 2, w, h };
}

export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.w - 1e-7 &&
    a.x + a.w > b.x + 1e-7 &&
    a.y < b.y + b.h - 1e-7 &&
    a.y + a.h > b.y + 1e-7
  );
}

export function distanceToRect(p: Point, r: Rect) {
  return Math.hypot(
    Math.max(r.x - p.x, 0, p.x - r.x - r.w),
    Math.max(r.y - p.y, 0, p.y - r.y - r.h),
  );
}

export function segmentTime(origin: Point, target: Point, rect: Rect) {
  let enter = 0;
  let exit = 1;
  for (const [axis, size] of [
    ['x', 'w'],
    ['y', 'h'],
  ] as const) {
    const dx = target[axis] - origin[axis];
    const start = origin[axis];
    const min = rect[axis];
    const max = min + rect[size];
    if (!dx) {
      if (start < min || start > max) return Infinity;
      continue;
    }
    const a = (min - start) / dx;
    const b = (max - start) / dx;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit ? enter : Infinity;
}

export function swingAngle(g: Gadget, tick: number) {
  return ((g.turn - 1) * Math.PI) / 2 + Math.sin((tick * Math.PI) / 111) * 0.94;
}
export function swingWeight(g: Gadget, tick: number): Point {
  const angle = swingAngle(g, tick);
  return {
    x: g.x + Math.cos(angle) * SWING_LENGTH,
    y: g.y + Math.sin(angle) * SWING_LENGTH,
  };
}

const cycle = (tick: number, period: number) => tick % period;
export function windup(g: Gadget, tick: number) {
  const phase = cycle(tick, g.kind === 'piston' ? 156 : 120);
  return phase >= 42 && phase < 60;
}

export function pistonReach(tick: number) {
  const phase = cycle(tick, 156);
  return phase < 60 || phase >= 84
    ? 0
    : Math.min(1, (phase - 59) / 5, (84 - phase) / 8) * 1.65;
}

export function spikeTeeth(g: Gadget) {
  return Array.from({ length: 5 }, (_, i) => {
    const x = -0.96 + i * 0.385;
    return [
      at(g, x, -0.12, g.turn),
      at(g, x + 0.18, 0.25, g.turn),
      at(g, x + 0.37, -0.12, g.turn),
    ];
  });
}

// Project a moving player box and a stationary convex tooth onto separating axes.
export function toothHit(
  origin: Point,
  target: Point,
  w: number,
  h: number,
  tooth: Point[],
) {
  let enter = 0;
  let exit = 1;
  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    ...tooth.map((p, i) => {
      const next = tooth[(i + 1) % tooth.length];
      return { x: p.y - next.y, y: next.x - p.x };
    }),
  ];
  for (const axis of axes) {
    const projection = (p: Point) => p.x * axis.x + p.y * axis.y;
    const padding = (Math.abs(axis.x) * w) / 2 + (Math.abs(axis.y) * h) / 2;
    const vertex = tooth.map(projection);
    const min = Math.min(...vertex) - padding;
    const max = Math.max(...vertex) + padding;
    const start = projection(origin);
    const speed = projection(target) - start;
    if (speed === 0) {
      if (start < min || start > max) return false;
    } else {
      const a = (min - start) / speed;
      const b = (max - start) / speed;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (enter > exit) return false;
  }
  return true;
}

export function fanForce(gadgets: Gadget[], point: Point) {
  let x = 0;
  let y = 0;
  for (const gadget of gadgets) {
    if (gadget.kind !== 'fan') continue;
    const { x: dx, y: dy } = VECTOR[gadget.turn];
    const distance = (point.x - gadget.x) * dx + (point.y - gadget.y) * dy;
    const side = Math.abs(
      (point.y - gadget.y) * dx - (point.x - gadget.x) * dy,
    );
    if (
      distance < 0.45 ||
      distance > FAN_RANGE ||
      side > 0.33 + distance * 0.35
    )
      continue;
    const strength = FAN_ACCELERATION * (1 - distance / (FAN_RANGE + 0.8));
    x += dx * strength;
    y += dy * strength;
  }
  return {
    x: Math.max(-28, Math.min(28, x)),
    y: Math.max(-28, Math.min(28, y)),
  };
}

export function advanceBolts(
  gadgets: Gadget[],
  surfaces: Surface[],
  tick: number,
  previous: Bolt[],
): Bolt[] {
  const bolts: Bolt[] = [];
  for (const bolt of previous) {
    if (bolt.stopped || bolt.life <= 0) continue;
    const target = at(bolt, 0.2, 0, bolt.turn);
    let hit = Infinity;
    for (const s of surfaces) {
      if (s.type === 'ledge') continue;
      hit = Math.min(
        hit,
        segmentTime(bolt, target, {
          x: s.x - 0.06,
          y: s.y - 0.06,
          w: s.w + 0.12,
          h: s.h + 0.12,
        }),
      );
    }
    const point = Number.isFinite(hit)
      ? at(bolt, 0.2 * hit, 0, bolt.turn)
      : target;
    bolts.push({
      ...bolt,
      ...point,
      from: { x: bolt.x, y: bolt.y },
      life: bolt.life - 1,
      stopped: Number.isFinite(hit),
    });
  }
  if (tick % 120 === 60) {
    for (const g of gadgets) {
      if (bolts.length >= 48) break;
      if (g.kind !== 'arrow') continue;
      const muzzle = at(g, 0.64, 0, g.turn);
      if (
        surfaces.some(
          (s) => s.type !== 'ledge' && distanceToRect(muzzle, s) < 0.06,
        )
      )
        continue;
      bolts.push({
        ...muzzle,
        id: `${g.id}:${tick}`,
        from: muzzle,
        turn: g.turn,
        owner: g.owner,
        life: 115,
      });
    }
  }
  return bolts;
}
