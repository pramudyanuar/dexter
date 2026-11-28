import {
  type Course,
  courseAt,
  type Rect,
  SAW_RADIUS,
  type Surface,
  WIDTH,
} from './content';
import {
  at,
  COIN_RADIUS,
  fanForce,
  footprint,
  type Gadget,
  pistonReach,
  type Point,
  segmentTime,
  spikeTeeth,
  SWING_RADIUS,
  swingWeight,
  toothHit,
} from './mechanisms';

export const STEP = 1 / 60;
export const HALF_WIDTH = 0.26;
export const BODY_HEIGHT = 0.82;
const EPSILON = 1e-7;

export type Input = {
  direction: -1 | 0 | 1;
  sprint: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
};
export type Pose =
  | 'idle'
  | 'run'
  | 'sprint'
  | 'rise'
  | 'apex'
  | 'fall'
  | 'wall'
  | 'kick'
  | 'land'
  | 'dead'
  | 'finish';
export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  ground: string | null;
  wall: -1 | 0 | 1;
  coyote: number;
  buffer: number;
  lock: number;
  land: number;
  cuttable: boolean;
  age: number;
  pose: Pose;
  killer?: number;
};
export type Layout = ReturnType<typeof courseAt>;
export type Frame = { tick: number; player: Player; layout: Layout };

export function newRun(course: Course, start = course.start): Frame {
  const layout = courseAt(course, 0);
  const { x, y } = start;
  const ground = layout.surfaces.find(
    (s) => x > s.x && x < s.x + s.w && Math.abs(y - s.y - s.h) < EPSILON,
  );
  return {
    tick: 0,
    layout,
    player: {
      x,
      y,
      vx: 0,
      vy: 0,
      facing: 1,
      ground: ground?.id ?? null,
      wall: 0,
      coyote: 0,
      buffer: 0,
      lock: 0,
      land: 0,
      cuttable: false,
      age: 0,
      pose: 'idle',
    },
  };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function moveX(p: Player, amount: number, surfaces: Surface[]) {
  let travel = amount;
  let contact: Surface | undefined;
  for (const s of surfaces) {
    if (
      s.type === 'ledge' ||
      p.y >= s.y + s.h - EPSILON ||
      p.y + BODY_HEIGHT <= s.y + EPSILON
    )
      continue;
    const gap =
      amount > 0 ? s.x - (p.x + HALF_WIDTH) : s.x + s.w - (p.x - HALF_WIDTH);
    if (amount > 0 && gap >= -EPSILON && gap < travel) {
      travel = Math.max(0, gap);
      contact = s;
    }
    if (amount < 0 && gap <= EPSILON && gap > travel) {
      travel = Math.min(0, gap);
      contact = s;
    }
  }
  p.x += travel;
  if (travel !== amount) p.vx = 0;
  return contact;
}

function moveY(
  p: Player,
  amount: number,
  surfaces: Surface[],
  ignore?: Surface,
) {
  let travel = amount;
  let ground: Surface | undefined;
  let ceiling: Surface | undefined;
  for (const s of surfaces) {
    if (s === ignore) continue;
    if (
      p.x + HALF_WIDTH <= s.x + EPSILON ||
      p.x - HALF_WIDTH >= s.x + s.w - EPSILON
    )
      continue;
    if (amount <= 0) {
      const gap = s.y + s.h - p.y;
      if (gap <= EPSILON && gap >= travel) {
        travel = Math.min(0, gap);
        ground = s;
      }
    } else if (s.type !== 'ledge') {
      const gap = s.y - p.y - BODY_HEIGHT;
      if (gap >= -EPSILON && gap < travel) {
        travel = Math.max(0, gap);
        ceiling = s;
      }
    }
  }
  p.y += travel;
  if (ground || travel !== amount) p.vy = 0;
  return { ground, ceiling };
}

function touchingWall(
  p: Player,
  surfaces: Surface[],
  side: Input['direction'],
) {
  return (
    side !== 0 &&
    surfaces.some(
      (s) =>
        s.type !== 'ledge' &&
        p.y < s.y + s.h - EPSILON &&
        p.y + BODY_HEIGHT > s.y + EPSILON &&
        Math.abs(p.x + side * HALF_WIDTH - (side > 0 ? s.x : s.x + s.w)) <
          EPSILON,
    )
  );
}

function diskHit(
  player: Player,
  before: Player,
  disk: Point,
  oldDisk: Point,
  r: number,
) {
  const x = oldDisk.x - before.x;
  const y = oldDisk.y - before.y;
  const target = { x: disk.x - player.x, y: disk.y - player.y };
  const dx = target.x - x;
  const dy = target.y - y;
  // A segment against two strips and four rounded corners is a swept disk against the hitbox.
  if (
    Number.isFinite(
      segmentTime({ x, y }, target, {
        x: -HALF_WIDTH - r,
        y: 0,
        w: 2 * (HALF_WIDTH + r),
        h: BODY_HEIGHT,
      }),
    ) ||
    Number.isFinite(
      segmentTime({ x, y }, target, {
        x: -HALF_WIDTH,
        y: -r,
        w: 2 * HALF_WIDTH,
        h: BODY_HEIGHT + 2 * r,
      }),
    )
  )
    return true;
  const squaredLength = dx * dx + dy * dy;
  return [-HALF_WIDTH, HALF_WIDTH].some((edge) =>
    [0, BODY_HEIGHT].some((height) => {
      const t = squaredLength
        ? clamp(((edge - x) * dx + (height - y) * dy) / squaredLength, 0, 1)
        : 0;
      return (x + t * dx - edge) ** 2 + (y + t * dy - height) ** 2 <= r * r;
    }),
  );
}

function hits(before: Point, p: Point, rect: Rect) {
  return Number.isFinite(
    segmentTime(before, p, {
      x: rect.x - HALF_WIDTH,
      y: rect.y - BODY_HEIGHT,
      w: rect.w + HALF_WIDTH * 2,
      h: rect.h + BODY_HEIGHT,
    }),
  );
}

export function touchesCoin(before: Player, player: Player, coin: Gadget) {
  return diskHit(player, before, coin, coin, COIN_RADIUS);
}

function hazardHit(before: Frame, p: Player, layout: Layout, tick: number) {
  const saw = layout.saws.find((next, i) =>
    diskHit(p, before.player, next, before.layout.saws[i], SAW_RADIUS),
  );
  if (saw) return saw;
  const a = { x: before.player.x, y: before.player.y + BODY_HEIGHT / 2 };
  const b = { x: p.x, y: p.y + BODY_HEIGHT / 2 };
  for (let i = 0; i < layout.gadgets.length; i++) {
    const g = layout.gadgets[i];
    const old = before.layout.gadgets[i];
    if (g.kind === 'spikes') {
      const shifted = { x: a.x + g.x - old.x, y: a.y + g.y - old.y };
      if (
        spikeTeeth(g).some((tooth) =>
          toothHit(shifted, b, HALF_WIDTH * 2, BODY_HEIGHT, tooth),
        )
      )
        return g;
    } else if (g.kind === 'swing') {
      if (
        diskHit(
          p,
          before.player,
          swingWeight(g, tick),
          swingWeight(old, tick - 1),
          SWING_RADIUS,
        )
      )
        return g;
    } else if (g.kind === 'piston') {
      const reach = pistonReach(tick);
      const oldReach = pistonReach(tick - 1);
      if (reach === 0 && oldReach === 0) continue;
      const now = at(g, 0.64 + reach, 0, g.turn);
      const past = at(old, 0.64 + oldReach, 0, g.turn);
      if (
        hits(
          { x: before.player.x - past.x, y: before.player.y - past.y },
          { x: p.x - now.x, y: p.y - now.y },
          footprint({ x: 0, y: 0 }, 0.38, 0.64, g.turn),
        )
      )
        return g;
    }
  }
  return layout.bolts.find((bolt) =>
    diskHit(p, before.player, bolt, bolt.from, 0.085),
  );
}

export function stepRun(
  course: Course,
  frame: Frame,
  input: Input,
  layout = courseAt(course, frame.tick + 1, frame.layout.bolts),
): Frame {
  const tick = frame.tick + 1;
  const before = frame.player;
  const p = { ...before, age: before.age + 1 };
  if (p.pose === 'dead' || p.pose === 'finish')
    return { tick, layout, player: p };

  const surfaces = layout.surfaces;
  for (let i = 0; i < surfaces.length; i++) {
    const carrier = surfaces[i];
    if (
      !carrier.travel ||
      p.x + HALF_WIDTH <= carrier.x ||
      p.x - HALF_WIDTH >= carrier.x + carrier.w
    )
      continue;
    const old = frame.layout.surfaces[i];
    const top = carrier.y + carrier.h;
    const footWasAbove = p.y >= old.y + old.h - EPSILON;
    const headWasBelow = p.y + BODY_HEIGHT <= old.y + EPSILON;
    let target: number;
    if (p.ground === carrier.id || (footWasAbove && p.y < top)) {
      target = top;
      p.ground = carrier.id;
    } else if (headWasBelow && p.y + BODY_HEIGHT > carrier.y) {
      target = carrier.y - BODY_HEIGHT;
    } else {
      continue;
    }
    if (Math.abs(p.y - target) < EPSILON) continue;
    moveY(p, target - p.y, surfaces, carrier);
    p.vy = 0;
    if (Math.abs(p.y - target) < EPSILON) continue;
    p.pose = 'dead';
    p.age = 0;
    p.killer = carrier.owner;
    return { tick, layout, player: p };
  }
  const standingOn = surfaces.find((s) => s.id === p.ground);

  p.buffer = input.jumpPressed ? 7 : Math.max(0, p.buffer - 1);
  p.lock = Math.max(0, p.lock - 1);
  p.coyote = p.ground ? 6 : Math.max(0, p.coyote - 1);
  p.land = Math.max(0, p.land - 1);

  const direction = input.direction;
  const force = fanForce(layout.gadgets, { x: p.x, y: p.y + BODY_HEIGHT / 2 });
  const wall =
    !p.ground && !p.lock && touchingWall(p, surfaces, direction)
      ? direction
      : 0;
  if (!p.lock) {
    const target = direction * (input.sprint ? 8 : 5.2);
    const acceleration = p.ground
      ? direction
        ? 42
        : 55
      : force.x && !direction
        ? 5
        : 27;
    p.vx += clamp(target - p.vx, -acceleration * STEP, acceleration * STEP);
    if (direction) p.facing = direction;
  }

  if (p.buffer && (p.coyote || wall)) {
    if (wall && !p.coyote) {
      p.vx = -wall * 6.8;
      p.facing = wall === 1 ? -1 : 1;
      p.vy = 10.5;
      p.lock = 6;
    } else {
      p.vy = 11;
    }
    p.buffer = 0;
    p.coyote = 0;
    p.ground = null;
    p.cuttable = true;
  }
  if (!input.jumpHeld && p.cuttable) {
    p.vy = Math.min(p.vy, 4.5);
    p.cuttable = false;
  }

  if (force.x) p.vx = clamp(p.vx + force.x * STEP, -11, 11);
  if (force.y) p.vy = clamp(p.vy + force.y * STEP, -17, 17);
  const up = p.vy > 0;
  p.vy = Math.max(-17, p.vy - (up ? 30 : 37) * STEP);
  const beltSpeed =
    standingOn?.type === 'conveyor' ? 2.2 * (standingOn.belt ?? 1) : 0;
  const dx = (p.vx + beltSpeed) * STEP;
  const wallContact = moveX(p, dx, surfaces);
  p.wall = !p.lock && touchingWall(p, surfaces, direction) ? direction : 0;
  if (p.wall && p.vy < -2.8) p.vy = -2.8;
  const { ground, ceiling } = moveY(p, p.vy * STEP, surfaces);
  p.ground = ground?.id ?? null;
  if (ground && !before.ground) p.land = 6;
  const bounce =
    ground?.type === 'spring' && (ground.turn ?? 0) === 0
      ? 0
      : ceiling?.type === 'spring' && ceiling.turn === 2
        ? 2
        : wallContact?.type === 'spring' &&
            wallContact.turn === (dx > 0 ? 1 : 3)
          ? wallContact.turn
          : null;
  if (bounce !== null) {
    if (bounce === 0 || bounce === 2) p.vy = bounce === 0 ? 15.5 : -15.5;
    else {
      p.vx = bounce === 1 ? -15.5 : 15.5;
      p.wall = 0;
    }
    p.ground = null;
    p.coyote = 0;
    p.cuttable = false;
  }

  const hazard = hazardHit(frame, p, layout, tick);
  if (p.y < -1 || p.x < -0.5 || p.x > WIDTH + 0.5 || hazard) {
    p.pose = 'dead';
    p.killer = hazard?.owner;
  } else if (hits(before, p, course.goal)) {
    p.pose = 'finish';
  } else if (p.lock) {
    p.pose = 'kick';
  } else if (p.ground) {
    p.pose = p.land
      ? 'land'
      : Math.abs(p.vx) < 0.22
        ? 'idle'
        : Math.abs(p.vx) > 5.5
          ? 'sprint'
          : 'run';
  } else if (p.wall && p.vy < 0) {
    p.pose = 'wall';
  } else {
    p.pose = p.vy > 1.4 ? 'rise' : p.vy < -1.4 ? 'fall' : 'apex';
  }
  if (p.pose !== before.pose) p.age = 0;
  return { tick, layout, player: p };
}
