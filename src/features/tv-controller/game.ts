import {
  type ControllerInput,
  EMPTY_INPUT,
  TV_SLOTS,
} from '@/features/tv-controller/protocol';

export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const TOTAL_LAPS = 3;

export interface Vec2 {
  x: number;
  y: number;
}

export interface BoostPad {
  x: number;
  y: number;
  r: number;
  angle: number;
}

export interface Hazard {
  x: number;
  y: number;
  r: number;
}

export interface TrackData {
  seed: number;
  name: string;
  halfWidth: number;
  points: Vec2[];
  boostPads: BoostPad[];
  hazards: Hazard[];
}

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
  checkpoint: number; // 0..3 around the loop
  trackIdx: number; // closest sample index on track.points
  boostTimer: number;
  slowTimer: number;
  finishedAt: number | null;
}

export interface RaceState {
  track: TrackData;
  karts: KartState[];
  elapsed: number;
  winnerSlot: number | null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

const TRACK_NAMES = [
  'Sirkuit Zig-Zag',
  'Tikungan Naga',
  'Lintasan Meteor',
  'Arena Kobra',
  'Sirkuit Kilat',
  'Putaran Maut',
];

/**
 * Generates a closed-loop procedural circuit from `seed` using radial control
 * points and a Catmull-Rom spline so curves are smooth and non-self-intersecting.
 */
export function createRandomTrack(
  seed = Math.floor(Math.random() * 1_000_000),
): TrackData {
  const rng = mulberry32(seed);
  const ctrlCount = 10 + Math.floor(rng() * 3); // 10..12 control points
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2 + 10;
  const maxRx = 500;
  const maxRy = 250;
  const halfWidth = 74;

  const controls: Vec2[] = [];
  for (let i = 0; i < ctrlCount; i++) {
    const baseAngle = (i / ctrlCount) * Math.PI * 2;
    const jitter = (rng() - 0.5) * ((Math.PI * 2) / ctrlCount) * 0.34;
    const angle = baseAngle + jitter;
    // Alternate inward chicanes and wide sweeping bends
    const chicane = i % 2 === 0 ? 0.85 + rng() * 0.17 : 0.48 + rng() * 0.42;
    controls.push({
      x: cx + Math.cos(angle) * maxRx * chicane,
      y: cy + Math.sin(angle) * maxRy * chicane,
    });
  }

  const samplesPerSeg = 12;
  const points: Vec2[] = [];
  for (let i = 0; i < ctrlCount; i++) {
    const p0 = controls[(i - 1 + ctrlCount) % ctrlCount];
    const p1 = controls[i];
    const p2 = controls[(i + 1) % ctrlCount];
    const p3 = controls[(i + 2) % ctrlCount];
    for (let s = 0; s < samplesPerSeg; s++) {
      points.push(catmullRom(p0, p1, p2, p3, s / samplesPerSeg));
    }
  }

  const n = points.length;
  const tangentAt = (idx: number) => {
    const a = points[idx % n];
    const b = points[(idx + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };

  // Place 3 boost pads and 3 oil/mud hazards around the circuit (away from start)
  const boostPads: BoostPad[] = [0.22, 0.52, 0.78].map((frac) => {
    const idx = Math.floor(frac * n);
    const p = points[idx];
    return { x: p.x, y: p.y, r: 24, angle: tangentAt(idx) };
  });

  const hazards: Hazard[] = [0.34, 0.64, 0.88].map((frac, k) => {
    const idx = Math.floor(frac * n);
    const p = points[idx];
    const ang = tangentAt(idx) + Math.PI / 2;
    const offset = (k % 2 === 0 ? 1 : -1) * 26;
    return {
      x: p.x + Math.cos(ang) * offset,
      y: p.y + Math.sin(ang) * offset,
      r: 20,
    };
  });

  const name = TRACK_NAMES[Math.abs(seed) % TRACK_NAMES.length];

  return { seed, name, halfWidth, points, boostPads, hazards };
}

export interface RacerSetup {
  slot: number;
  name: string;
  isBot: boolean;
}

export function createInitialRace(
  racers: RacerSetup[],
  track: TrackData = createRandomTrack(42),
): RaceState {
  const n = track.points.length;
  const p0 = track.points[0];
  const p1 = track.points[1];
  const startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const nx = -Math.sin(startAngle);
  const ny = Math.cos(startAngle);
  const fx = Math.cos(startAngle);
  const fy = Math.sin(startAngle);

  const karts: KartState[] = racers.map((r, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2 === 0 ? -1 : 1;
    const back = 28 + row * 42;
    const side = col * 24;
    return {
      slot: r.slot,
      name: r.name,
      isBot: r.isBot,
      x: p0.x - fx * back + nx * side,
      y: p0.y - fy * back + ny * side,
      vx: 0,
      vy: 0,
      angle: startAngle,
      lap: 1,
      checkpoint: 0,
      trackIdx: n - 1,
      boostTimer: 0,
      slowTimer: 0,
      finishedAt: null,
    };
  });

  return { track, karts, elapsed: 0, winnerSlot: null };
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function closestTrackPoint(
  points: readonly Vec2[],
  x: number,
  y: number,
): { idx: number; dist: number; point: Vec2 } {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = x - points[i].x;
    const dy = y - points[i].y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return {
    idx: bestIdx,
    dist: Math.sqrt(bestDistSq),
    point: points[bestIdx],
  };
}

function botInput(kart: KartState, track: TrackData): ControllerInput {
  const n = track.points.length;
  const targetIdx = (kart.trackIdx + 7) % n;
  const prev = track.points[(targetIdx - 1 + n) % n];
  const target = track.points[targetIdx];
  const tang = Math.atan2(target.y - prev.y, target.x - prev.x);
  const lane = ((kart.slot % 3) - 1) * 18;
  const tx = target.x - Math.sin(tang) * lane;
  const ty = target.y + Math.cos(tang) * lane;

  const desired = Math.atan2(ty - kart.y, tx - kart.x);
  const diff = normalizeAngle(desired - kart.angle);

  return {
    left: diff < -0.1,
    right: diff > 0.1,
    up: true,
    down: false,
    a: Math.abs(diff) < 1.15, // ease off throttle on sharp hairpins
    b: Math.abs(diff) >= 1.15,
  };
}

/**
 * Advances the race simulation by `dt` seconds on the procedural circuit.
 */
export function stepRace(
  state: RaceState,
  inputs: Record<number, ControllerInput>,
  dt: number,
): RaceState {
  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const elapsed = state.elapsed + clampedDt;
  let winnerSlot = state.winnerSlot;
  const { track } = state;
  const n = track.points.length;

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
      ? botInput(kart, track)
      : (inputs[kart.slot] ?? EMPTY_INPUT);

    const throttle =
      input.a || input.up ? 1 : input.b || input.down ? -0.55 : 0;
    const steer =
      typeof input.ax === 'number' && input.ax !== 0
        ? input.ax
        : (input.right ? 1 : 0) - (input.left ? 1 : 0);

    if (kart.boostTimer > 0) {
      kart.boostTimer = Math.max(0, kart.boostTimer - clampedDt);
    }
    if (kart.slowTimer > 0) {
      kart.slowTimer = Math.max(0, kart.slowTimer - clampedDt);
    }

    const speed = Math.hypot(kart.vx, kart.vy);
    const turnRate = 3.5 * (0.48 + Math.min(speed / 300, 1) * 0.52);
    kart.angle = normalizeAngle(kart.angle + steer * turnRate * clampedDt);

    const accel = kart.boostTimer > 0 ? 780 : kart.slowTimer > 0 ? 230 : 470;
    kart.vx += Math.cos(kart.angle) * throttle * accel * clampedDt;
    kart.vy += Math.sin(kart.angle) * throttle * accel * clampedDt;

    // Lateral grip (reduced when sliding through oil hazard)
    const fx = Math.cos(kart.angle);
    const fy = Math.sin(kart.angle);
    const forwardSpeed = kart.vx * fx + kart.vy * fy;
    const sideSpeed = -kart.vx * fy + kart.vy * fx;
    const grip = kart.slowTimer > 0 ? 0.35 : 0.06;
    const dampedSide = sideSpeed * Math.pow(grip, clampedDt);
    kart.vx = fx * forwardSpeed - fy * dampedSide;
    kart.vy = fy * forwardSpeed + fx * dampedSide;

    const drag = Math.pow(0.45, clampedDt);
    kart.vx *= drag;
    kart.vy *= drag;
    const maxSpeed = kart.boostTimer > 0 ? 520 : kart.slowTimer > 0 ? 200 : 375;
    const newSpeed = Math.hypot(kart.vx, kart.vy);
    if (newSpeed > maxSpeed) {
      kart.vx = (kart.vx / newSpeed) * maxSpeed;
      kart.vy = (kart.vy / newSpeed) * maxSpeed;
    }

    kart.x += kart.vx * clampedDt;
    kart.y += kart.vy * clampedDt;

    // Boost pads
    for (const pad of track.boostPads) {
      if (Math.hypot(kart.x - pad.x, kart.y - pad.y) <= pad.r + 14) {
        kart.boostTimer = 0.85;
      }
    }

    // Oil hazards
    for (const haz of track.hazards) {
      if (Math.hypot(kart.x - haz.x, kart.y - haz.y) <= haz.r + 12) {
        kart.slowTimer = 0.9;
      }
    }

    // Track boundary collision against centerline ribbon
    const closest = closestTrackPoint(track.points, kart.x, kart.y);
    kart.trackIdx = closest.idx;
    const maxOffset = track.halfWidth - 16;
    if (closest.dist > maxOffset && closest.dist > 0.001) {
      const dx = kart.x - closest.point.x;
      const dy = kart.y - closest.point.y;
      kart.x = closest.point.x + (dx / closest.dist) * maxOffset;
      kart.y = closest.point.y + (dy / closest.dist) * maxOffset;
      kart.vx *= 0.65;
      kart.vy *= 0.65;
    }

    // Quarter-lap checkpoints around the sampled loop
    const quarter = Math.floor((closest.idx / n) * 4);
    if (kart.checkpoint === 0 && quarter === 1) {
      kart.checkpoint = 1;
    } else if (kart.checkpoint === 1 && quarter === 2) {
      kart.checkpoint = 2;
    } else if (kart.checkpoint === 2 && quarter === 3) {
      kart.checkpoint = 3;
    } else if (kart.checkpoint === 3 && quarter === 0) {
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

  return { track, karts, elapsed, winnerSlot };
}

/** Sorts karts by race standings (finished first, then lap, checkpoint, and track index). */
export function standings(
  karts: readonly KartState[],
  trackLen = 120,
): KartState[] {
  return [...karts].sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) {
      return a.finishedAt - b.finishedAt;
    }
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;
    return b.trackIdx / trackLen - a.trackIdx / trackLen;
  });
}

function strokeTrackPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

export function drawTrackSurface(
  ctx: CanvasRenderingContext2D,
  track: TrackData,
) {
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle background grid
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

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Outer neon curb
  strokeTrackPath(ctx, track.points);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = track.halfWidth * 2 + 8;
  ctx.stroke();

  // Asphalt ribbon
  strokeTrackPath(ctx, track.points);
  ctx.strokeStyle = '#1b2330';
  ctx.lineWidth = track.halfWidth * 2;
  ctx.stroke();

  // Dashed centerline
  ctx.setLineDash([18, 16]);
  strokeTrackPath(ctx, track.points);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Start / finish checkered line at points[0]
  if (track.points.length > 1) {
    const p0 = track.points[0];
    const p1 = track.points[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(ang);
    const sq = 12;
    const half = track.halfWidth - 4;
    for (let y = -half; y < half; y += sq) {
      const row = Math.floor((y + half) / sq);
      ctx.fillStyle = row % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(-sq / 2, y, sq / 2, Math.min(sq, half - y));
      ctx.fillStyle = row % 2 === 0 ? '#0f172a' : '#f8fafc';
      ctx.fillRect(0, y, sq / 2, Math.min(sq, half - y));
    }
    ctx.restore();
  }

  // Oil / mud hazards
  for (const haz of track.hazards) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(haz.x, haz.y, haz.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d8b4fe';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OLI', haz.x, haz.y + 1);
    ctx.restore();
  }

  // Boost pads
  for (const pad of track.boostPads) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', pad.x, pad.y + 1);
    ctx.restore();
  }
}

export function drawRaceCanvas(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
) {
  drawTrackSurface(ctx, state.track);

  // Karts
  for (const kart of state.karts) {
    const theme = TV_SLOTS[kart.slot] ?? TV_SLOTS[0];
    ctx.save();
    ctx.translate(kart.x, kart.y);
    ctx.rotate(kart.angle);

    if (kart.boostTimer > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-18, -6);
      ctx.lineTo(-30 - Math.random() * 8, 0);
      ctx.lineTo(-18, 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = theme.color;
    ctx.beginPath();
    ctx.roundRect(-18, -12, 36, 24, 7);
    ctx.fill();
    ctx.strokeStyle = kart.slowTimer > 0 ? '#d8b4fe' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(3, -8, 9, 16, 3);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(kart.name, kart.x, kart.y - 20);
    ctx.restore();
  }
}
