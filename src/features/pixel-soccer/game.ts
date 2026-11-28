import {
  type ControllerInput,
  EMPTY_INPUT,
} from '@/features/tv-controller/protocol';

/** Low-res 16-bit virtual canvas dimensions (rendered with image-rendering: pixelated). */
export const PIXEL_W = 384;
export const PIXEL_H = 216;
export const MATCH_DURATION = 90;

export type ScreenMode = 'single' | 'split';

export const PITCH = {
  left: 26,
  right: 358,
  top: 32,
  bottom: 196,
  goalTop: 84,
  goalBottom: 144,
  goalDepth: 14,
} as const;

export type Team = 'red' | 'blue';

export interface SoccerPlayer {
  slot: number;
  team: Team;
  name: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  walkPhase: number;
  dashTimer: number;
  dashCooldown: number;
  kickCooldown: number;
  kickAnim: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  trail: { x: number; y: number }[];
}

export interface PixelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface SoccerMatchState {
  players: SoccerPlayer[];
  ball: BallState;
  particles: PixelParticle[];
  scoreRed: number;
  scoreBlue: number;
  timeLeft: number;
  goldenGoal: boolean;
  goalBannerTimer: number;
  lastScorerTeam: Team | null;
  winner: Team | null;
  shakeTimer: number;
  crowdPhase: number;
}

export interface SoccerSetup {
  slot: number;
  team: Team;
  name: string;
  isBot: boolean;
}

function resetPositions(players: SoccerPlayer[]): {
  players: SoccerPlayer[];
  ball: BallState;
} {
  let redCount = 0;
  let blueCount = 0;
  const midY = (PITCH.top + PITCH.bottom) / 2;
  const resetPlayers = players.map((p) => {
    const idx = p.team === 'red' ? redCount++ : blueCount++;
    const x = p.team === 'red' ? 116 - idx * 30 : 268 + idx * 30;
    const y = idx === 0 ? midY : midY + (idx % 2 === 1 ? -30 : 30);
    return {
      ...p,
      x,
      y,
      vx: 0,
      vy: 0,
      dirX: p.team === 'red' ? 1 : -1,
      dirY: 0,
      walkPhase: 0,
      dashTimer: 0,
      dashCooldown: 0,
      kickCooldown: 0,
      kickAnim: 0,
    };
  });
  return {
    players: resetPlayers,
    ball: {
      x: PIXEL_W / 2,
      y: midY,
      vx: 0,
      vy: 0,
      spin: 0,
      trail: [],
    },
  };
}

export function createInitialMatch(setups: SoccerSetup[]): SoccerMatchState {
  const basePlayers: SoccerPlayer[] = setups.map((s) => ({
    slot: s.slot,
    team: s.team,
    name: s.name,
    isBot: s.isBot,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    dirX: s.team === 'red' ? 1 : -1,
    dirY: 0,
    walkPhase: 0,
    dashTimer: 0,
    dashCooldown: 0,
    kickCooldown: 0,
    kickAnim: 0,
  }));

  const { players, ball } = resetPositions(basePlayers);
  return {
    players,
    ball,
    particles: [],
    scoreRed: 0,
    scoreBlue: 0,
    timeLeft: MATCH_DURATION,
    goldenGoal: false,
    goalBannerTimer: 0,
    lastScorerTeam: null,
    winner: null,
    shakeTimer: 0,
    crowdPhase: 0,
  };
}

function botSoccerInput(bot: SoccerPlayer, ball: BallState): ControllerInput {
  const targetGoalX = bot.team === 'red' ? PITCH.right : PITCH.left;
  const ownGoalX = bot.team === 'red' ? PITCH.left : PITCH.right;
  const goalCenterY = (PITCH.goalTop + PITCH.goalBottom) / 2;

  const toGoalX = targetGoalX - ball.x;
  const toGoalY = goalCenterY - ball.y;
  const gLen = Math.hypot(toGoalX, toGoalY) || 1;
  const approachX = ball.x - (toGoalX / gLen) * 11;
  const approachY = ball.y - (toGoalY / gLen) * 11;

  const defend = bot.team === 'red' ? ball.x < bot.x - 20 : ball.x > bot.x + 20;
  const tx = defend ? (ball.x + ownGoalX) / 2 : approachX;
  const ty = defend ? ball.y : approachY;

  const dx = tx - bot.x;
  const dy = ty - bot.y;
  const distToBall = Math.hypot(ball.x - bot.x, ball.y - bot.y);

  return {
    left: dx < -3,
    right: dx > 3,
    up: dy < -3,
    down: dy > 3,
    a: distToBall < 16 && !defend,
    b: distToBall > 60 && bot.dashCooldown <= 0,
  };
}

function spawnParticles(
  particles: PixelParticle[],
  x: number,
  y: number,
  color: string,
  count: number,
  size = 2,
) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = 28 + Math.random() * 65;
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

/**
 * Advances the pixel soccer simulation by `dt` seconds.
 */
export function stepSoccer(
  state: SoccerMatchState,
  inputs: Record<number, ControllerInput>,
  dt: number,
): SoccerMatchState {
  if (state.winner !== null) return state;

  const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);
  const crowdPhase = state.crowdPhase + clampedDt * 6;
  const shakeTimer = Math.max(0, state.shakeTimer - clampedDt);

  const particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * clampedDt,
      y: p.y + p.vy * clampedDt,
      life: p.life - clampedDt,
    }))
    .filter((p) => p.life > 0);

  if (state.goalBannerTimer > 0) {
    const nextTimer = state.goalBannerTimer - clampedDt;
    if (nextTimer <= 0) {
      const reset = resetPositions(state.players);
      return {
        ...state,
        players: reset.players,
        ball: reset.ball,
        particles,
        goalBannerTimer: 0,
        shakeTimer,
        crowdPhase,
      };
    }
    return {
      ...state,
      particles,
      goalBannerTimer: nextTimer,
      shakeTimer,
      crowdPhase: crowdPhase + clampedDt * 8,
    };
  }

  let timeLeft = state.timeLeft - clampedDt;
  let goldenGoal = state.goldenGoal;
  let winner: Team | null = null;

  if (timeLeft <= 0) {
    timeLeft = 0;
    if (state.scoreRed > state.scoreBlue) {
      winner = 'red';
    } else if (state.scoreBlue > state.scoreRed) {
      winner = 'blue';
    } else {
      goldenGoal = true;
    }
  }

  if (winner !== null) {
    return {
      ...state,
      timeLeft,
      goldenGoal,
      winner,
      particles,
      shakeTimer,
      crowdPhase,
    };
  }

  const players = state.players.map((p) => ({ ...p }));
  const ball = {
    ...state.ball,
    trail: [...state.ball.trail],
  };

  let nextShake = shakeTimer;

  for (const p of players) {
    const input = p.isBot
      ? botSoccerInput(p, ball)
      : (inputs[p.slot] ?? EMPTY_INPUT);

    if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - clampedDt);
    if (p.dashCooldown > 0)
      p.dashCooldown = Math.max(0, p.dashCooldown - clampedDt);
    if (p.kickCooldown > 0)
      p.kickCooldown = Math.max(0, p.kickCooldown - clampedDt);
    if (p.kickAnim > 0) p.kickAnim = Math.max(0, p.kickAnim - clampedDt);

    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.dirX = mx;
      p.dirY = my;
      p.walkPhase += clampedDt * (p.dashTimer > 0 ? 18 : 11);
    }

    if (input.b && p.dashCooldown <= 0 && len > 0) {
      p.dashTimer = 0.16;
      p.dashCooldown = 1.0;
      spawnParticles(particles, p.x, p.y + 4, '#f8fafc', 5, 2);
    }

    const moveSpeed = p.dashTimer > 0 ? 190 : 98;
    p.vx = mx * moveSpeed;
    p.vy = my * moveSpeed;
    p.x += p.vx * clampedDt;
    p.y += p.vy * clampedDt;

    p.x = Math.max(PITCH.left + 6, Math.min(PITCH.right - 6, p.x));
    p.y = Math.max(PITCH.top + 6, Math.min(PITCH.bottom - 6, p.y));

    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    const hitDist = 12;

    if (input.a && p.kickCooldown <= 0 && dist < 19) {
      const kx = dist > 0.5 ? dx / dist : p.dirX;
      const ky = dist > 0.5 ? dy / dist : p.dirY;
      ball.vx = kx * 265 + p.vx * 0.4;
      ball.vy = ky * 265 + p.vy * 0.4;
      p.kickCooldown = 0.24;
      p.kickAnim = 0.18;
      nextShake = 0.08;
      spawnParticles(particles, ball.x, ball.y, '#fde047', 7, 2);
    } else if (dist < hitDist && dist > 0.01) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = p.x + nx * hitDist;
      ball.y = p.y + ny * hitDist;
      ball.vx = nx * 105 + p.vx * 0.68;
      ball.vy = ny * 105 + p.vy * 0.68;
    }
  }

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01 && dist < 13) {
        const push = (13 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Ball trail when moving fast
  const ballSpeed = Math.hypot(ball.vx, ball.vy);
  if (ballSpeed > 130) {
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 5) ball.trail.shift();
  } else if (ball.trail.length > 0) {
    ball.trail.shift();
  }

  ball.x += ball.vx * clampedDt;
  ball.y += ball.vy * clampedDt;
  ball.spin += ballSpeed * clampedDt * 0.15;
  const ballDrag = Math.pow(0.28, clampedDt);
  ball.vx *= ballDrag;
  ball.vy *= ballDrag;

  if (ball.y < PITCH.top + 4) {
    ball.y = PITCH.top + 4;
    ball.vy = Math.abs(ball.vy) * 0.78;
  } else if (ball.y > PITCH.bottom - 4) {
    ball.y = PITCH.bottom - 4;
    ball.vy = -Math.abs(ball.vy) * 0.78;
  }

  const inGoalMouth =
    ball.y >= PITCH.goalTop + 2 && ball.y <= PITCH.goalBottom - 2;

  let scoreRed = state.scoreRed;
  let scoreBlue = state.scoreBlue;
  let goalBannerTimer = 0;
  let lastScorerTeam = state.lastScorerTeam;

  if (ball.x < PITCH.left && inGoalMouth) {
    if (ball.x < PITCH.left - 4) {
      scoreBlue += 1;
      lastScorerTeam = 'blue';
      goalBannerTimer = 1.6;
      nextShake = 0.25;
      spawnParticles(particles, PITCH.left, ball.y, '#60a5fa', 18, 3);
      spawnParticles(particles, PITCH.left, ball.y, '#fde047', 10, 2);
      if (goldenGoal) winner = 'blue';
    }
  } else if (ball.x < PITCH.left + 4) {
    ball.x = PITCH.left + 4;
    ball.vx = Math.abs(ball.vx) * 0.78;
  }

  if (ball.x > PITCH.right && inGoalMouth) {
    if (ball.x > PITCH.right + 4) {
      scoreRed += 1;
      lastScorerTeam = 'red';
      goalBannerTimer = 1.6;
      nextShake = 0.25;
      spawnParticles(particles, PITCH.right, ball.y, '#f87171', 18, 3);
      spawnParticles(particles, PITCH.right, ball.y, '#fde047', 10, 2);
      if (goldenGoal) winner = 'red';
    }
  } else if (ball.x > PITCH.right - 4) {
    ball.x = PITCH.right - 4;
    ball.vx = -Math.abs(ball.vx) * 0.78;
  }

  return {
    players,
    ball,
    particles,
    scoreRed,
    scoreBlue,
    timeLeft,
    goldenGoal,
    goalBannerTimer,
    lastScorerTeam,
    winner,
    shakeTimer: nextShake,
    crowdPhase,
  };
}

function drawPitchScene(
  ctx: CanvasRenderingContext2D,
  state: SoccerMatchState,
) {
  // Stadium stands & dark pixel backdrop
  ctx.fillStyle = '#090e17';
  ctx.fillRect(0, 0, PIXEL_W, PIXEL_H);

  // Pixel crowd dots along top & bottom stands
  const crowdColors = ['#ef4444', '#3b82f6', '#fde047', '#22c55e', '#e2e8f0'];
  for (let cx = 24; cx < PIXEL_W - 20; cx += 9) {
    const bounce =
      state.goalBannerTimer > 0
        ? Math.round(Math.sin(state.crowdPhase + cx) * 2)
        : Math.round(Math.sin(state.crowdPhase * 0.4 + cx) * 0.6);
    ctx.fillStyle = crowdColors[cx % crowdColors.length];
    ctx.fillRect(cx, 23 + bounce, 3, 3);
    ctx.fillRect(cx + 3, PIXEL_H - 12 + bounce, 3, 3);
  }

  // Striped pixel grass
  const stripeW = 24;
  for (let x = PITCH.left; x < PITCH.right; x += stripeW) {
    const idx = Math.floor((x - PITCH.left) / stripeW);
    ctx.fillStyle = idx % 2 === 0 ? '#166534' : '#15803d';
    ctx.fillRect(
      x,
      PITCH.top,
      Math.min(stripeW, PITCH.right - x),
      PITCH.bottom - PITCH.top,
    );
  }

  // Crisp pixel pitch lines
  ctx.fillStyle = '#dcfce7';
  ctx.fillRect(PITCH.left, PITCH.top, PITCH.right - PITCH.left, 2);
  ctx.fillRect(PITCH.left, PITCH.bottom - 2, PITCH.right - PITCH.left, 2);
  ctx.fillRect(PITCH.left, PITCH.top, 2, PITCH.bottom - PITCH.top);
  ctx.fillRect(PITCH.right - 2, PITCH.top, 2, PITCH.bottom - PITCH.top);

  const midX = Math.floor((PITCH.left + PITCH.right) / 2);
  const midY = Math.floor((PITCH.top + PITCH.bottom) / 2);
  ctx.fillRect(midX - 1, PITCH.top, 2, PITCH.bottom - PITCH.top);
  ctx.strokeStyle = '#dcfce7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(midX, midY, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Penalty boxes
  ctx.strokeRect(PITCH.left, PITCH.goalTop - 16, 34, 92);
  ctx.strokeRect(PITCH.right - 34, PITCH.goalTop - 16, 34, 92);

  // Goals with pixel net mesh
  const goalH = PITCH.goalBottom - PITCH.goalTop;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(
    PITCH.left - PITCH.goalDepth,
    PITCH.goalTop,
    PITCH.goalDepth,
    goalH,
  );
  ctx.fillRect(PITCH.right, PITCH.goalTop, PITCH.goalDepth, goalH);

  ctx.fillStyle = '#475569';
  for (let ny = PITCH.goalTop + 4; ny < PITCH.goalBottom; ny += 6) {
    ctx.fillRect(PITCH.left - PITCH.goalDepth, ny, PITCH.goalDepth, 1);
    ctx.fillRect(PITCH.right, ny, PITCH.goalDepth, 1);
  }
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(PITCH.left - PITCH.goalDepth, PITCH.goalTop, PITCH.goalDepth, 2);
  ctx.fillRect(
    PITCH.left - PITCH.goalDepth,
    PITCH.goalBottom - 2,
    PITCH.goalDepth,
    2,
  );
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(PITCH.right, PITCH.goalTop, PITCH.goalDepth, 2);
  ctx.fillRect(PITCH.right, PITCH.goalBottom - 2, PITCH.goalDepth, 2);

  // Ball speed trail
  for (let i = 0; i < state.ball.trail.length; i++) {
    const t = state.ball.trail[i];
    ctx.fillStyle = `rgba(253, 224, 71, ${(i + 1) * 0.12})`;
    ctx.fillRect(Math.round(t.x) - 2, Math.round(t.y) - 2, 4, 4);
  }

  // Particles
  for (const pt of state.particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }

  // Animated Pixel Players
  for (const p of state.players) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const shirt = p.team === 'red' ? '#ef4444' : '#3b82f6';
    const trim = p.team === 'red' ? '#fca5a5' : '#93c5fd';
    const moving = Math.hypot(p.vx, p.vy) > 5;
    const step = moving ? Math.round(Math.sin(p.walkPhase)) : 0;

    // Dash ghost afterimage
    if (p.dashTimer > 0) {
      ctx.fillStyle =
        p.team === 'red' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)';
      ctx.fillRect(
        px - Math.round(p.dirX * 6) - 4,
        py - Math.round(p.dirY * 6) - 6,
        8,
        12,
      );
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px - 5, py + 5, 10, 2);

    // Animated legs
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px - 3, py + 3 + step, 2, 3);
    ctx.fillRect(
      px + 1 + (p.kickAnim > 0 ? Math.round(p.dirX * 3) : 0),
      py + 3 - step,
      2,
      3,
    );

    // Shorts & jersey
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 4, py + 1, 8, 3);
    ctx.fillStyle = shirt;
    ctx.fillRect(px - 4, py - 4, 8, 6);
    // Jersey stripe
    ctx.fillStyle = trim;
    ctx.fillRect(px - 1, py - 4, 2, 5);

    // Head + hair/headband
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(px - 3, py - 9, 6, 5);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px - 3, py - 10, 6, 2);
    ctx.fillStyle = trim;
    ctx.fillRect(px - 3, py - 8, 6, 1);

    // Player tag (P1..P4)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`P${p.slot + 1}`, px, py - 12);
  }

  // Pixel soccer ball
  const bx = Math.round(state.ball.x);
  const by = Math.round(state.ball.y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(bx - 3, by + 3, 6, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx - 3, by - 3, 6, 6);
  ctx.fillStyle = '#0f172a';
  const spinOffset = Math.round(Math.sin(state.ball.spin));
  ctx.fillRect(bx - 1 + spinOffset, by - 1, 2, 2);
  ctx.fillRect(bx - 3, by - 3, 1, 1);
  ctx.fillRect(bx + 2, by - 3, 1, 1);
  ctx.fillRect(bx - 3, by + 2, 1, 1);
  ctx.fillRect(bx + 2, by + 2, 1, 1);
}

function drawScoreHud(
  ctx: CanvasRenderingContext2D,
  state: SoccerMatchState,
  screenMode: ScreenMode,
) {
  const midX = Math.floor(PIXEL_W / 2);
  const midY = Math.floor((PITCH.top + PITCH.bottom) / 2);

  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, PIXEL_W, 18);
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f87171';
  ctx.textAlign = 'right';
  ctx.fillText(`MERAH ${state.scoreRed}`, midX - 24, 9);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  const sec = Math.ceil(state.timeLeft);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  ctx.fillText(state.goldenGoal ? 'GOLDEN' : `${mm}:${ss}`, midX, 9);

  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.scoreBlue} BIRU`, midX + 24, 9);

  if (screenMode === 'split') {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LAYAR 1 · MERAH', 6, 26);

    ctx.fillStyle = '#60a5fa';
    ctx.textAlign = 'right';
    ctx.fillText('LAYAR 2 · BIRU', PIXEL_W - 6, 26);

    // Center mini radar
    const rw = 64;
    const rh = 34;
    const rx = midX - rw / 2;
    const ry = PIXEL_H - rh - 4;
    ctx.fillStyle = 'rgba(9, 13, 20, 0.85)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    for (const p of state.players) {
      const px = rx + ((p.x - PITCH.left) / (PITCH.right - PITCH.left)) * rw;
      const py = ry + ((p.y - PITCH.top) / (PITCH.bottom - PITCH.top)) * rh;
      ctx.fillStyle = p.team === 'red' ? '#ef4444' : '#3b82f6';
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
    }
    const bx =
      rx + ((state.ball.x - PITCH.left) / (PITCH.right - PITCH.left)) * rw;
    const by =
      ry + ((state.ball.y - PITCH.top) / (PITCH.bottom - PITCH.top)) * rh;
    ctx.fillStyle = '#fde047';
    ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2);
  }

  if (state.goalBannerTimer > 0) {
    ctx.fillStyle = 'rgba(9, 13, 20, 0.82)';
    ctx.fillRect(midX - 64, midY - 18, 128, 36);
    ctx.strokeStyle = state.lastScorerTeam === 'red' ? '#f87171' : '#60a5fa';
    ctx.lineWidth = 2;
    ctx.strokeRect(midX - 64, midY - 18, 128, 36);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOL!!', midX, midY + 1);
  }
}

export function drawPixelSoccer(
  ctx: CanvasRenderingContext2D,
  state: SoccerMatchState,
  screenMode: ScreenMode = 'single',
) {
  ctx.imageSmoothingEnabled = false;
  const sx = state.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
  const sy = state.shakeTimer > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;

  if (screenMode === 'single') {
    ctx.save();
    ctx.translate(sx, sy);
    drawPitchScene(ctx, state);
    ctx.restore();
    drawScoreHud(ctx, state, 'single');
    return;
  }

  // Mode 2 Layar (Split-Screen): Left tracks Red P1, Right tracks Blue P2
  const halfW = PIXEL_W / 2;
  const zoom = 1.55;
  const redFocus =
    state.players.find((p) => p.team === 'red') ?? state.players[0];
  const blueFocus =
    state.players.find((p) => p.team === 'blue') ?? state.players[0];

  const renderViewport = (clipX: number, focus: SoccerPlayer | undefined) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, 18, halfW, PIXEL_H - 18);
    ctx.clip();

    const fx = focus ? focus.x : PIXEL_W / 2;
    const fy = focus ? focus.y : PIXEL_H / 2;
    const viewW = halfW / zoom;
    const viewH = (PIXEL_H - 18) / zoom;
    const camX = Math.max(0, Math.min(PIXEL_W - viewW, fx - viewW / 2));
    const camY = Math.max(18, Math.min(PIXEL_H - viewH, fy - viewH / 2));

    ctx.translate(clipX + sx, 18 + sy);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
    drawPitchScene(ctx, state);
    ctx.restore();
  };

  ctx.fillStyle = '#090e17';
  ctx.fillRect(0, 0, PIXEL_W, PIXEL_H);
  renderViewport(0, redFocus);
  renderViewport(halfW, blueFocus);

  // Center split divider
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(halfW - 1, 18, 2, PIXEL_H - 18);

  drawScoreHud(ctx, state, 'split');
}
