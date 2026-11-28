import {
  type Course,
  courseAt,
  type Rect,
  SAW_RADIUS,
  type Surface,
  WIDTH,
} from './content';

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
};
export type Layout = ReturnType<typeof courseAt>;
export type Frame = { tick: number; player: Player; layout: Layout };

export function newRun(course: Course): Frame {
  const layout = courseAt(course, 0);
  const { x, y } = course.start;
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
  for (const s of surfaces) {
    if (
      s.type === 'ledge' ||
      p.y >= s.y + s.h - EPSILON ||
      p.y + BODY_HEIGHT <= s.y + EPSILON
    )
      continue;
    const gap =
      amount > 0 ? s.x - (p.x + HALF_WIDTH) : s.x + s.w - (p.x - HALF_WIDTH);
    if (amount > 0 && gap >= -EPSILON && gap < travel)
      travel = Math.max(0, gap);
    if (amount < 0 && gap <= EPSILON && gap > travel) travel = Math.min(0, gap);
  }
  p.x += travel;
  if (travel !== amount) p.vx = 0;
}

function moveY(
  p: Player,
  amount: number,
  surfaces: Surface[],
  ignore?: Surface,
) {
  let travel = amount;
  let ground: Surface | undefined;
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
      if (gap >= -EPSILON && gap < travel) travel = Math.max(0, gap);
    }
  }
  p.y += travel;
  if (ground || travel !== amount) p.vy = 0;
  return ground;
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

function segmentBox(
  x: number,
  y: number,
  dx: number,
  dy: number,
  left: number,
  bottom: number,
  right: number,
  top: number,
) {
  const start = [x, y];
  const distance = [dx, dy];
  const min = [left, bottom];
  const max = [right, top];
  let enter = 0;
  let exit = 1;
  for (let i = 0; i < 2; i++) {
    if (!distance[i]) {
      if (start[i] < min[i] || start[i] > max[i]) return false;
      continue;
    }
    const a = (min[i] - start[i]) / distance[i];
    const b = (max[i] - start[i]) / distance[i];
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit;
}

function sawHit(
  player: Player,
  before: Player,
  saw: Layout['saws'][number],
  oldSaw: Layout['saws'][number],
) {
  const x = oldSaw.x - before.x;
  const y = oldSaw.y - before.y;
  const dx = saw.x - player.x - x;
  const dy = saw.y - player.y - y;
  const r = SAW_RADIUS;
  // A segment against two strips and four rounded corners is a swept disk against the hitbox.
  if (
    segmentBox(x, y, dx, dy, -HALF_WIDTH - r, 0, HALF_WIDTH + r, BODY_HEIGHT) ||
    segmentBox(x, y, dx, dy, -HALF_WIDTH, -r, HALF_WIDTH, BODY_HEIGHT + r)
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

function goalHit(before: Player, p: Player, goal: Rect) {
  return segmentBox(
    before.x,
    before.y,
    p.x - before.x,
    p.y - before.y,
    goal.x - HALF_WIDTH,
    goal.y - BODY_HEIGHT,
    goal.x + goal.w + HALF_WIDTH,
    goal.y + goal.h,
  );
}

export function stepRun(course: Course, frame: Frame, input: Input): Frame {
  const tick = frame.tick + 1;
  const layout = courseAt(course, tick);
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
    return { tick, layout, player: p };
  }
  const standingOn = surfaces.find((s) => s.id === p.ground);

  p.buffer = input.jumpPressed ? 7 : Math.max(0, p.buffer - 1);
  p.lock = Math.max(0, p.lock - 1);
  p.coyote = p.ground ? 6 : Math.max(0, p.coyote - 1);
  p.land = Math.max(0, p.land - 1);

  const direction = input.direction;
  const wall =
    !p.ground && !p.lock && touchingWall(p, surfaces, direction)
      ? direction
      : 0;
  if (!p.lock) {
    const target = direction * (input.sprint ? 8 : 5.2);
    const acceleration = p.ground ? (direction ? 42 : 55) : 27;
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

  const up = p.vy > 0;
  p.vy = Math.max(-17, p.vy - (up ? 30 : 37) * STEP);
  const beltSpeed = standingOn?.type === 'conveyor' ? 2.2 : 0;
  moveX(p, (p.vx + beltSpeed) * STEP, surfaces);
  p.wall = !p.lock && touchingWall(p, surfaces, direction) ? direction : 0;
  if (p.wall && p.vy < -2.8) p.vy = -2.8;
  const ground = moveY(p, p.vy * STEP, surfaces);
  p.ground = ground?.id ?? null;
  if (ground && !before.ground) p.land = 6;
  if (ground?.type === 'spring' && !up) {
    p.vy = 15.5;
    p.ground = null;
    p.coyote = 0;
    p.cuttable = false;
  }

  if (
    p.y < -1 ||
    p.x < -0.5 ||
    p.x > WIDTH + 0.5 ||
    layout.saws.some((saw, i) => sawHit(p, before, saw, frame.layout.saws[i]))
  ) {
    p.pose = 'dead';
  } else if (goalHit(before, p, course.goal)) {
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
