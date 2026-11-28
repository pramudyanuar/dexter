import {
  type ControllerInput,
  EMPTY_INPUT,
  TV_SLOTS,
} from '@/features/tv-controller/protocol';

export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const TOTAL_LAPS = 3;

export interface KartState {
  slot: number;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lap: number;
  checkpoint: number; // 0..3 around the oval
  boostTimer: number;
  finishedAt: number | null;
}

export interface RaceState {
  karts: KartState[];
  elapsed: number;
  winnerSlot: number | null;
}

// Oval track geometry centered at (CX, CY)
export const TRACK = {
  cx: CANVAS_W / 2,
  cy: CANVAS_H / 2 + 12,
  outerRx: 540,
  outerRy: 285,
  innerRx: 295,
  innerRy: 120,
} as const;

export const BOOST_PADS: readonly { x: number; y: number; r: number }[] = [
  { x: TRACK.cx, y: TRACK.cy - 205, r: 34 },
  { x: TRACK.cx, y: TRACK.cy + 205, r: 34 },
  { x: TRACK.cx - 420, y: TRACK.cy, r: 32 },
  { x: TRACK.cx + 420, y: TRACK.cy, r: 32 },
];

export interface RacerSetup {
  slot: number;
  name: string;
  isBot: boolean;
}

export function createInitialRace(racers: RacerSetup[]): RaceState {
  const startX = TRACK.cx - 30;
  const baseY = TRACK.cy + 165;
  const karts: KartState[] = racers.map((r, idx) => ({
    slot: r.slot,
    name: r.name,
    isBot: r.isBot,
    x: startX - (idx % 2) * 52,
    y: baseY + Math.floor(idx / 2) * 44 - 22,
    vx: 0,
    vy: 0,
    angle: 0, // facing right along bottom straight
    lap: 1,
    checkpoint: 0,
    boostTimer: 0,
    finishedAt: null,
  }));

  return { karts, elapsed: 0, winnerSlot: null };
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function botInput(kart: KartState): ControllerInput {
  // Aim slightly ahead around the oval track
  const theta = Math.atan2(
    (kart.y - TRACK.cy) / ((TRACK.outerRy + TRACK.innerRy) / 2),
    (kart.x - TRACK.cx) / ((TRACK.outerRx + TRACK.innerRx) / 2),
  );
  const lookAhead = theta - 0.32; // counter-clockwise around screen? Wait: start facing right (+x) at bottom (+y), so decreasing theta goes right -> up -> left -> down
  const midRx =
    (TRACK.outerRx + TRACK.innerRx) / 2 + ((kart.slot % 2) - 0.5) * 35;
  const midRy =
    (TRACK.outerRy + TRACK.innerRy) / 2 + ((kart.slot % 3) - 1) * 18;
  const tx = TRACK.cx + Math.cos(lookAhead) * midRx;
  const ty = TRACK.cy + Math.sin(lookAhead) * midRy;
  const desired = Math.atan2(ty - kart.y, tx - kart.x);
  const diff = normalizeAngle(desired - kart.angle);

  return {
    left: diff < -0.1,
    right: diff > 0.1,
    up: true,
    down: false,
    a: true,
    b: false,
  };
}

/**
 * Advances the race simulation by `dt` seconds.
 * Supports D-pad steering (left/right) + A/up for gas, B/down for brake/reverse.
 */
export function stepRace(
  state: RaceState,
  inputs: Record<number, ControllerInput>,
  dt: number,
): RaceState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const elapsed = state.elapsed + clampedDt;
  let winnerSlot = state.winnerSlot;

  const karts = state.karts.map((k) => ({ ...k }));

  for (const kart of karts) {
    if (kart.finishedAt !== null) {
      kart.vx *= 0.92;
      kart.vy *= 0.92;
      kart.x += kart.vx * clampedDt;
      kart.y += kart.vy * clampedDt;
      continue;
    }

    const input = kart.isBot
      ? botInput(kart)
      : (inputs[kart.slot] ?? EMPTY_INPUT);

    const throttle =
      input.a || input.up ? 1 : input.b || input.down ? -0.55 : 0;
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (kart.boostTimer > 0) {
      kart.boostTimer = Math.max(0, kart.boostTimer - clampedDt);
    }

    const speed = Math.hypot(kart.vx, kart.vy);
    const turnRate = 3.2 * (0.45 + Math.min(speed / 320, 1) * 0.55);
    kart.angle = normalizeAngle(kart.angle + steer * turnRate * clampedDt);

    const accel = kart.boostTimer > 0 ? 780 : 470;
    kart.vx += Math.cos(kart.angle) * throttle * accel * clampedDt;
    kart.vy += Math.sin(kart.angle) * throttle * accel * clampedDt;

    // Lateral grip so karts carve corners instead of sliding endlessly
    const fx = Math.cos(kart.angle);
    const fy = Math.sin(kart.angle);
    const forwardSpeed = kart.vx * fx + kart.vy * fy;
    const sideSpeed = -kart.vx * fy + kart.vy * fx;
    const dampedSide = sideSpeed * Math.pow(0.06, clampedDt);
    kart.vx = fx * forwardSpeed - fy * dampedSide;
    kart.vy = fy * forwardSpeed + fx * dampedSide;

    // Drag & speed cap
    const drag = Math.pow(0.45, clampedDt);
    kart.vx *= drag;
    kart.vy *= drag;
    const maxSpeed = kart.boostTimer > 0 ? 520 : 370;
    const newSpeed = Math.hypot(kart.vx, kart.vy);
    if (newSpeed > maxSpeed) {
      kart.vx = (kart.vx / newSpeed) * maxSpeed;
      kart.vy = (kart.vy / newSpeed) * maxSpeed;
    }

    kart.x += kart.vx * clampedDt;
    kart.y += kart.vy * clampedDt;

    // Boost pads
    for (const pad of BOOST_PADS) {
      if (Math.hypot(kart.x - pad.x, kart.y - pad.y) <= pad.r + 14) {
        kart.boostTimer = 0.85;
      }
    }

    // Track boundary collisions (keep inside outer ellipse, outside inner ellipse)
    const dx = kart.x - TRACK.cx;
    const dy = kart.y - TRACK.cy;
    const outerNorm = Math.hypot(
      dx / (TRACK.outerRx - 18),
      dy / (TRACK.outerRy - 18),
    );
    if (outerNorm > 1) {
      kart.x = TRACK.cx + dx / outerNorm;
      kart.y = TRACK.cy + dy / outerNorm;
      kart.vx *= 0.65;
      kart.vy *= 0.65;
    }

    const innerNorm = Math.hypot(
      dx / (TRACK.innerRx + 18),
      dy / (TRACK.innerRy + 18),
    );
    if (innerNorm < 1 && innerNorm > 0.001) {
      kart.x = TRACK.cx + dx / innerNorm;
      kart.y = TRACK.cy + dy / innerNorm;
      kart.vx *= 0.65;
      kart.vy *= 0.65;
    }

    // Checkpoint & lap progression (counter-clockwise: bottom -> right -> top -> left -> bottom)
    // Quadrant angles: bottom-right is 0, right-top is 1, top-left is 2, left-bottom is 3
    if (kart.checkpoint === 0 && dx > 180 && dy > -40 && dy < 80) {
      kart.checkpoint = 1;
    } else if (kart.checkpoint === 1 && dy < -120 && dx > -120 && dx < 120) {
      kart.checkpoint = 2;
    } else if (kart.checkpoint === 2 && dx < -180 && dy > -80 && dy < 80) {
      kart.checkpoint = 3;
    } else if (kart.checkpoint === 3 && dx >= 0 && dy > 100) {
      kart.checkpoint = 0;
      if (kart.lap >= TOTAL_LAPS) {
        kart.finishedAt = elapsed;
        if (winnerSlot === null) winnerSlot = kart.slot;
      } else {
        kart.lap += 1;
      }
    }
  }

  // Kart-to-kart bumper collisions
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 30;
      if (dist > 0.01 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const sep = rvx * nx + rvy * ny;
        if (sep < 0) {
          const impulse = -sep * 0.85;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
        }
      }
    }
  }

  return { karts, elapsed, winnerSlot };
}

/** Sorts karts by race standings (finished first, then lap, then checkpoint). */
export function standings(karts: readonly KartState[]): KartState[] {
  return [...karts].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) {
      return a.finishedAt - b.finishedAt;
    }
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    return b.checkpoint - a.checkpoint;
  });
}

export function drawRaceCanvas(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
) {
  // Background
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Outer grass / neon grid glow
  ctx.strokeStyle = '#142033';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }

  // Asphalt track
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    TRACK.cx,
    TRACK.cy,
    TRACK.outerRx,
    TRACK.outerRy,
    0,
    0,
    Math.PI * 2,
  );
  ctx.ellipse(
    TRACK.cx,
    TRACK.cy,
    TRACK.innerRx,
    TRACK.innerRy,
    0,
    0,
    Math.PI * 2,
    true,
  );
  ctx.fillStyle = '#1b2330';
  ctx.fill();

  // Outer & inner track borders
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(
    TRACK.cx,
    TRACK.cy,
    TRACK.outerRx,
    TRACK.outerRy,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(
    TRACK.cx,
    TRACK.cy,
    TRACK.innerRx,
    TRACK.innerRy,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();

  // Dashed centerline
  ctx.setLineDash([22, 18]);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(
    TRACK.cx,
    TRACK.cy,
    (TRACK.outerRx + TRACK.innerRx) / 2,
    (TRACK.outerRy + TRACK.innerRy) / 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Start / finish checkered line at bottom straight
  const lineX = TRACK.cx;
  const lineTop = TRACK.cy + TRACK.innerRy;
  const lineBottom = TRACK.cy + TRACK.outerRy;
  const sq = 14;
  for (let y = lineTop; y < lineBottom; y += sq) {
    const row = Math.floor((y - lineTop) / sq);
    ctx.fillStyle = row % 2 === 0 ? '#f8fafc' : '#0f172a';
    ctx.fillRect(lineX - sq / 2, y, sq / 2, Math.min(sq, lineBottom - y));
    ctx.fillStyle = row % 2 === 0 ? '#0f172a' : '#f8fafc';
    ctx.fillRect(lineX, y, sq / 2, Math.min(sq, lineBottom - y));
  }

  // Boost pads
  for (const pad of BOOST_PADS) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', pad.x, pad.y + 1);
    ctx.restore();
  }

  // Karts
  for (const kart of state.karts) {
    const theme = TV_SLOTS[kart.slot] ?? TV_SLOTS[0];
    ctx.save();
    ctx.translate(kart.x, kart.y);
    ctx.rotate(kart.angle);

    // Boost flame
    if (kart.boostTimer > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-18, -6);
      ctx.lineTo(-30 - Math.random() * 8, 0);
      ctx.lineTo(-18, 6);
      ctx.closePath();
      ctx.fill();
    }

    // Kart body
    ctx.fillStyle = theme.color;
    ctx.beginPath();
    ctx.roundRect(-18, -12, 36, 24, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Windshield / direction nose
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(3, -8, 9, 16, 3);
    ctx.fill();
    ctx.restore();

    // Name tag above kart
    ctx.save();
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(kart.name, kart.x, kart.y - 20);
    ctx.restore();
  }
}
