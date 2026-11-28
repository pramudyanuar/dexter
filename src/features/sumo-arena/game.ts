import {
  type ControllerInput,
  EMPTY_INPUT,
  TV_SLOTS,
} from '@/features/tv-controller/protocol';

export const SUMO_W = 384;
export const SUMO_H = 216;
export const CX = SUMO_W / 2;
export const CY = SUMO_H / 2 + 8;
export const START_RADIUS = 88;
export const MIN_RADIUS = 32;
export const WIN_SCORE = 3;

export interface SumoFighter {
  slot: number;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  alive: boolean;
  chargeTimer: number;
  chargeCooldown: number;
  dashTimer: number;
  dashCooldown: number;
  giantTimer: number;
  walkPhase: number;
  score: number;
}

export interface SumoParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface PowerOrb {
  x: number;
  y: number;
  active: boolean;
}

export interface SumoState {
  fighters: SumoFighter[];
  particles: SumoParticle[];
  orb: PowerOrb;
  orbSpawnTimer: number;
  ringRadius: number;
  round: number;
  roundOverTimer: number;
  roundWinnerSlot: number | null;
  matchWinnerSlot: number | null;
  shakeTimer: number;
  waterPhase: number;
}

export interface SumoSetup {
  slot: number;
  name: string;
  isBot: boolean;
}

function resetRoundFighters(fighters: SumoFighter[]): SumoFighter[] {
  const count = fighters.length || 1;
  return fighters.map((f, idx) => {
    const ang = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const dist = 42;
    return {
      ...f,
      x: CX + Math.cos(ang) * dist,
      y: CY + Math.sin(ang) * dist,
      vx: 0,
      vy: 0,
      dirX: -Math.cos(ang),
      dirY: -Math.sin(ang),
      alive: true,
      chargeTimer: 0,
      chargeCooldown: 0,
      dashTimer: 0,
      dashCooldown: 0,
      giantTimer: 0,
      walkPhase: 0,
    };
  });
}

export function createInitialSumo(setups: SumoSetup[]): SumoState {
  const base: SumoFighter[] = setups.map((s) => ({
    slot: s.slot,
    name: s.name,
    isBot: s.isBot,
    x: CX,
    y: CY,
    vx: 0,
    vy: 0,
    dirX: 1,
    dirY: 0,
    alive: true,
    chargeTimer: 0,
    chargeCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    giantTimer: 0,
    walkPhase: 0,
    score: 0,
  }));

  return {
    fighters: resetRoundFighters(base),
    particles: [],
    orb: { x: CX, y: CY, active: false },
    orbSpawnTimer: 4,
    ringRadius: START_RADIUS,
    round: 1,
    roundOverTimer: 0,
    roundWinnerSlot: null,
    matchWinnerSlot: null,
    shakeTimer: 0,
    waterPhase: 0,
  };
}

function spawnParticles(
  particles: SumoParticle[],
  x: number,
  y: number,
  color: string,
  count: number,
  size = 2,
) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = 25 + Math.random() * 65;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.25 + Math.random() * 0.25,
      color,
      size,
    });
  }
}

function botSumoInput(bot: SumoFighter, state: SumoState): ControllerInput {
  const distFromCenter = Math.hypot(bot.x - CX, bot.y - CY);
  // If dangerously close to the edge, dash/steer back toward center
  if (distFromCenter > state.ringRadius - 18) {
    const dx = CX - bot.x;
    const dy = CY - bot.y;
    return {
      left: dx < -2,
      right: dx > 2,
      up: dy < -2,
      down: dy > 2,
      a: false,
      b: bot.dashCooldown <= 0,
    };
  }

  // Find nearest alive opponent
  let nearest: SumoFighter | null = null;
  let nearestDist = Infinity;
  for (const other of state.fighters) {
    if (other.slot === bot.slot || !other.alive) continue;
    const d = Math.hypot(other.x - bot.x, other.y - bot.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = other;
    }
  }

  const targetX =
    state.orb.active &&
    Math.hypot(state.orb.x - bot.x, state.orb.y - bot.y) < nearestDist
      ? state.orb.x
      : (nearest?.x ?? CX);
  const targetY =
    state.orb.active &&
    Math.hypot(state.orb.x - bot.x, state.orb.y - bot.y) < nearestDist
      ? state.orb.y
      : (nearest?.y ?? CY);

  const dx = targetX - bot.x;
  const dy = targetY - bot.y;

  return {
    left: dx < -3,
    right: dx > 3,
    up: dy < -3,
    down: dy > 3,
    a: nearest !== null && nearestDist < 38 && bot.chargeCooldown <= 0,
    b: false,
  };
}

/**
 * Advances the Sumo Bumper Arena simulation by `dt` seconds.
 */
export function stepSumo(
  state: SumoState,
  inputs: Record<number, ControllerInput>,
  dt: number,
): SumoState {
  if (state.matchWinnerSlot !== null) return state;

  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const waterPhase = state.waterPhase + clampedDt * 4;
  let shakeTimer = Math.max(0, state.shakeTimer - clampedDt);

  const particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * clampedDt,
      y: p.y + p.vy * clampedDt,
      life: p.life - clampedDt,
    }))
    .filter((p) => p.life > 0);

  if (state.roundOverTimer > 0) {
    const nextTimer = state.roundOverTimer - clampedDt;
    if (nextTimer <= 0) {
      return {
        ...state,
        fighters: resetRoundFighters(state.fighters),
        particles,
        orb: { x: CX, y: CY, active: false },
        orbSpawnTimer: 4,
        ringRadius: START_RADIUS,
        round: state.round + 1,
        roundOverTimer: 0,
        roundWinnerSlot: null,
        shakeTimer,
        waterPhase,
      };
    }
    return {
      ...state,
      particles,
      roundOverTimer: nextTimer,
      shakeTimer,
      waterPhase,
    };
  }

  const ringRadius = Math.max(MIN_RADIUS, state.ringRadius - clampedDt * 2.2);
  let orb = { ...state.orb };
  let orbSpawnTimer = state.orbSpawnTimer - clampedDt;
  if (!orb.active && orbSpawnTimer <= 0) {
    const ang = (state.round * 2.1 + state.waterPhase) % (Math.PI * 2);
    const r = Math.min(ringRadius * 0.55, 36);
    orb = {
      x: CX + Math.cos(ang) * r,
      y: CY + Math.sin(ang) * r,
      active: true,
    };
    orbSpawnTimer = 8;
  }

  const fighters = state.fighters.map((f) => ({ ...f }));

  for (const f of fighters) {
    if (!f.alive) continue;

    const input = f.isBot
      ? botSumoInput(f, state)
      : (inputs[f.slot] ?? EMPTY_INPUT);

    if (f.chargeTimer > 0)
      f.chargeTimer = Math.max(0, f.chargeTimer - clampedDt);
    if (f.chargeCooldown > 0)
      f.chargeCooldown = Math.max(0, f.chargeCooldown - clampedDt);
    if (f.dashTimer > 0) f.dashTimer = Math.max(0, f.dashTimer - clampedDt);
    if (f.dashCooldown > 0)
      f.dashCooldown = Math.max(0, f.dashCooldown - clampedDt);
    if (f.giantTimer > 0) f.giantTimer = Math.max(0, f.giantTimer - clampedDt);

    let mx =
      typeof input.ax === 'number' && input.ax !== 0
        ? input.ax
        : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my =
      typeof input.ay === 'number' && input.ay !== 0
        ? input.ay
        : (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (len > 0.08) {
      f.dirX = mx / len;
      f.dirY = my / len;
      f.walkPhase += clampedDt * 11 * Math.min(len, 1);
    }

    // Button A: Heavy charge forward (Seruduk)
    if (input.a && f.chargeCooldown <= 0) {
      f.chargeTimer = 0.22;
      f.chargeCooldown = 0.85;
      f.vx += f.dirX * 165;
      f.vy += f.dirY * 165;
      spawnParticles(particles, f.x, f.y + 4, '#fde047', 6, 2);
    }

    // Button B: Quick dodge dash
    if (input.b && f.dashCooldown <= 0) {
      f.dashTimer = 0.14;
      f.dashCooldown = 1.0;
      f.vx += f.dirX * 135;
      f.vy += f.dirY * 135;
      spawnParticles(particles, f.x, f.y + 4, '#e2e8f0', 5, 2);
    }

    const accel = f.giantTimer > 0 ? 310 : 270;
    f.vx += mx * accel * clampedDt;
    f.vy += my * accel * clampedDt;

    const drag = Math.pow(0.08, clampedDt);
    f.vx *= drag;
    f.vy *= drag;

    f.x += f.vx * clampedDt;
    f.y += f.vy * clampedDt;

    // Power orb pickup
    if (orb.active && Math.hypot(f.x - orb.x, f.y - orb.y) < 13) {
      orb.active = false;
      f.giantTimer = 5.5;
      spawnParticles(particles, orb.x, orb.y, '#fbbf24', 10, 2);
    }
  }

  // Fighter-to-fighter sumo collisions & knockback
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i];
      const b = fighters[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const radA = a.giantTimer > 0 ? 11 : 8;
      const radB = b.giantTimer > 0 ? 11 : 8;
      const minDist = radA + radB;

      if (dist > 0.01 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const forceA =
          (a.chargeTimer > 0 ? 185 : 95) * (a.giantTimer > 0 ? 1.45 : 1);
        const forceB =
          (b.chargeTimer > 0 ? 185 : 95) * (b.giantTimer > 0 ? 1.45 : 1);

        a.vx -= nx * forceB;
        a.vy -= ny * forceB;
        b.vx += nx * forceA;
        b.vy += ny * forceA;

        if (a.chargeTimer > 0 || b.chargeTimer > 0) {
          shakeTimer = 0.12;
          spawnParticles(
            particles,
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
            '#fde047',
            8,
            2,
          );
        }
      }
    }
  }

  // Ring-out check
  for (const f of fighters) {
    if (!f.alive) continue;
    if (Math.hypot(f.x - CX, f.y - CY) > ringRadius + 4) {
      f.alive = false;
      shakeTimer = 0.18;
      spawnParticles(particles, f.x, f.y, '#38bdf8', 16, 3);
      spawnParticles(particles, f.x, f.y, '#ffffff', 8, 2);
    }
  }

  // Round win check
  const aliveFighters = fighters.filter((f) => f.alive);
  let roundOverTimer = 0;
  let roundWinnerSlot: number | null = null;
  let matchWinnerSlot: number | null = null;

  if (fighters.length > 1 && aliveFighters.length <= 1) {
    roundOverTimer = 1.8;
    if (aliveFighters.length === 1) {
      const winner = aliveFighters[0];
      winner.score += 1;
      roundWinnerSlot = winner.slot;
      if (winner.score >= WIN_SCORE) {
        matchWinnerSlot = winner.slot;
      }
    }
  }

  return {
    fighters,
    particles,
    orb,
    orbSpawnTimer,
    ringRadius,
    round: state.round,
    roundOverTimer,
    roundWinnerSlot,
    matchWinnerSlot,
    shakeTimer,
    waterPhase,
  };
}

export function drawSumoArena(ctx: CanvasRenderingContext2D, state: SumoState) {
  ctx.imageSmoothingEnabled = false;
  const sx = state.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const sy = state.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;

  ctx.save();
  ctx.translate(sx, sy);

  // Pixel water backdrop with animated wave highlights
  ctx.fillStyle = '#0c2340';
  ctx.fillRect(0, 0, SUMO_W, SUMO_H);
  ctx.fillStyle = '#153a66';
  for (let wy = 24; wy < SUMO_H; wy += 16) {
    const offset = Math.round(Math.sin(state.waterPhase + wy) * 6);
    for (let wx = 12; wx < SUMO_W; wx += 36) {
      ctx.fillRect(wx + offset, wy, 14, 2);
    }
  }

  // Ring shadow in water
  ctx.fillStyle = '#07172b';
  ctx.beginPath();
  ctx.arc(CX, CY + 4, state.ringRadius + 3, 0, Math.PI * 2);
  ctx.fill();

  // Outer warning rim (flashes when shrinking small)
  const danger = state.ringRadius < 52;
  ctx.fillStyle =
    danger && Math.floor(state.waterPhase * 2) % 2 === 0
      ? '#ef4444'
      : '#d97706';
  ctx.beginPath();
  ctx.arc(CX, CY, state.ringRadius + 3, 0, Math.PI * 2);
  ctx.fill();

  // Sand / Dohyo clay ring
  ctx.fillStyle = '#e7c68b';
  ctx.beginPath();
  ctx.arc(CX, CY, state.ringRadius, 0, Math.PI * 2);
  ctx.fill();

  // Inner sumo circle & starting marks
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, CY, Math.max(8, state.ringRadius - 6), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(CX - 10, CY - 4, 3, 8);
  ctx.fillRect(CX + 7, CY - 4, 3, 8);

  // Power orb (golden onigiri/star)
  if (state.orb.active) {
    const ox = Math.round(state.orb.x);
    const oy =
      Math.round(state.orb.y) + Math.round(Math.sin(state.waterPhase * 2) * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(ox - 4, oy - 4, 8, 8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(ox - 2, oy - 2, 4, 4);
  }

  // Particles
  for (const pt of state.particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }

  // Pixel Sumo Fighters
  for (const f of state.fighters) {
    if (!f.alive) continue;
    const fx = Math.round(f.x);
    const fy = Math.round(f.y);
    const theme = TV_SLOTS[f.slot] ?? TV_SLOTS[0];
    const scale = f.giantTimer > 0 ? 1.4 : 1;
    const step =
      Math.hypot(f.vx, f.vy) > 10 ? Math.round(Math.sin(f.walkPhase)) : 0;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-7, 6, 14, 3);

    // Legs
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-5, 4 + step, 3, 3);
    ctx.fillRect(2, 4 - step, 3, 3);

    // Sumo body + colored mawashi belt
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = theme.color;
    ctx.fillRect(-6, 1, 12, 4);

    // Head + topknot
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(-4, -9, 8, 5);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-2, -11, 4, 2);

    // Charge aura
    if (f.chargeTimer > 0) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1;
      ctx.strokeRect(-8, -11, 16, 18);
    }

    ctx.restore();

    // Player tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`P${f.slot + 1}`, fx, fy - Math.round(13 * scale));
  }

  ctx.restore();

  // Top Scoreboard Strip
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, SUMO_W, 18);
  ctx.font = 'bold 8px monospace';
  ctx.textBaseline = 'middle';

  const spacing = SUMO_W / Math.max(state.fighters.length, 1);
  state.fighters.forEach((f, idx) => {
    const theme = TV_SLOTS[f.slot] ?? TV_SLOTS[0];
    const tx = Math.round(spacing * (idx + 0.5));
    ctx.fillStyle = theme.color;
    ctx.textAlign = 'center';
    ctx.fillText(`P${f.slot + 1}:${f.score}/${WIN_SCORE}`, tx, 9);
  });

  // Round over banner
  if (state.roundOverTimer > 0) {
    ctx.fillStyle = 'rgba(9, 13, 20, 0.85)';
    ctx.fillRect(CX - 78, CY - 18, 156, 36);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - 78, CY - 18, 156, 36);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    const label =
      state.roundWinnerSlot !== null
        ? `RONDE ${state.round}: P${state.roundWinnerSlot + 1} MENANG!`
        : `RONDE ${state.round} SERI!`;
    ctx.fillText(label, CX, CY + 1);
  }
}
