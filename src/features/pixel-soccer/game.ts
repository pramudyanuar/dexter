import {
  type ControllerInput,
  EMPTY_INPUT,
} from '@/features/tv-controller/protocol';

/** Low-res 16-bit virtual canvas dimensions (rendered with image-rendering: pixelated). */
export const PIXEL_W = 320;
export const PIXEL_H = 180;
export const MATCH_DURATION = 90;

export const PITCH = {
  left: 20,
  right: 300,
  top: 22,
  bottom: 164,
  goalTop: 68,
  goalBottom: 118,
  goalDepth: 12,
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
  dashTimer: number;
  dashCooldown: number;
  kickCooldown: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PixelParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
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
  const resetPlayers = players.map((p) => {
    const idx = p.team === 'red' ? redCount++ : blueCount++;
    const x = p.team === 'red' ? 95 - idx * 24 : 225 + idx * 24;
    const y = idx === 0 ? 93 : 66 + (idx % 2) * 54;
    return {
      ...p,
      x,
      y,
      vx: 0,
      vy: 0,
      dirX: p.team === 'red' ? 1 : -1,
      dirY: 0,
      dashTimer: 0,
      dashCooldown: 0,
      kickCooldown: 0,
    };
  });
  return {
    players: resetPlayers,
    ball: { x: PIXEL_W / 2, y: (PITCH.top + PITCH.bottom) / 2, vx: 0, vy: 0 },
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
    dashTimer: 0,
    dashCooldown: 0,
    kickCooldown: 0,
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
  };
}

function botSoccerInput(bot: SoccerPlayer, ball: BallState): ControllerInput {
  const targetGoalX = bot.team === 'red' ? PITCH.right : PITCH.left;
  const ownGoalX = bot.team === 'red' ? PITCH.left : PITCH.right;
  const goalCenterY = (PITCH.goalTop + PITCH.goalBottom) / 2;

  // Position slightly behind the ball relative to opponent goal so bot dribbles forward
  const toGoalX = targetGoalX - ball.x;
  const toGoalY = goalCenterY - ball.y;
  const gLen = Math.hypot(toGoalX, toGoalY) || 1;
  const approachX = ball.x - (toGoalX / gLen) * 10;
  const approachY = ball.y - (toGoalY / gLen) * 10;

  // If ball is very far behind bot toward own goal, fall back first
  const defend = bot.team === 'red' ? ball.x < bot.x - 18 : ball.x > bot.x + 18;
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
    a: distToBall < 15 && !defend,
    b: distToBall > 55 && bot.dashCooldown <= 0,
  };
}

function spawnParticles(
  particles: PixelParticle[],
  x: number,
  y: number,
  color: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = 25 + Math.random() * 55;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 0.28 + Math.random() * 0.2,
      color,
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
  const particles = state.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * clampedDt,
      y: p.y + p.vy * clampedDt,
      life: p.life - clampedDt,
    }))
    .filter((p) => p.life > 0);

  // Brief goal celebration pause before kickoff
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
      };
    }
    return { ...state, particles, goalBannerTimer: nextTimer };
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
    return { ...state, timeLeft, goldenGoal, winner, particles };
  }

  const players = state.players.map((p) => ({ ...p }));
  const ball = { ...state.ball };

  for (const p of players) {
    const input = p.isBot
      ? botSoccerInput(p, ball)
      : (inputs[p.slot] ?? EMPTY_INPUT);

    if (p.dashTimer > 0) p.dashTimer = Math.max(0, p.dashTimer - clampedDt);
    if (p.dashCooldown > 0)
      p.dashCooldown = Math.max(0, p.dashCooldown - clampedDt);
    if (p.kickCooldown > 0)
      p.kickCooldown = Math.max(0, p.kickCooldown - clampedDt);

    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.dirX = mx;
      p.dirY = my;
    }

    if (input.b && p.dashCooldown <= 0 && len > 0) {
      p.dashTimer = 0.16;
      p.dashCooldown = 1.1;
      spawnParticles(particles, p.x, p.y + 4, '#f8fafc', 5);
    }

    const moveSpeed = p.dashTimer > 0 ? 175 : 88;
    p.vx = mx * moveSpeed;
    p.vy = my * moveSpeed;
    p.x += p.vx * clampedDt;
    p.y += p.vy * clampedDt;

    // Keep players inside pitch bounds
    p.x = Math.max(PITCH.left + 6, Math.min(PITCH.right - 6, p.x));
    p.y = Math.max(PITCH.top + 6, Math.min(PITCH.bottom - 6, p.y));

    // Player-ball interaction (dribble & kick)
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    const hitDist = 11;

    if (input.a && p.kickCooldown <= 0 && dist < 17) {
      const kx = dist > 0.5 ? dx / dist : p.dirX;
      const ky = dist > 0.5 ? dy / dist : p.dirY;
      ball.vx = kx * 230 + p.vx * 0.4;
      ball.vy = ky * 230 + p.vy * 0.4;
      p.kickCooldown = 0.25;
      spawnParticles(particles, ball.x, ball.y, '#fde047', 6);
    } else if (dist < hitDist && dist > 0.01) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = p.x + nx * hitDist;
      ball.y = p.y + ny * hitDist;
      ball.vx = nx * 95 + p.vx * 0.65;
      ball.vy = ny * 95 + p.vy * 0.65;
    }
  }

  // Player-to-player separation
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01 && dist < 12) {
        const push = (12 - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  // Ball movement & grass friction
  ball.x += ball.vx * clampedDt;
  ball.y += ball.vy * clampedDt;
  const ballDrag = Math.pow(0.28, clampedDt);
  ball.vx *= ballDrag;
  ball.vy *= ballDrag;

  // Top & bottom pitch wall bounce
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

  // Left goal (Blue scores) & right goal (Red scores)
  if (ball.x < PITCH.left && inGoalMouth) {
    if (ball.x < PITCH.left - 4) {
      scoreBlue += 1;
      lastScorerTeam = 'blue';
      goalBannerTimer = 1.6;
      spawnParticles(particles, PITCH.left, ball.y, '#60a5fa', 14);
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
      spawnParticles(particles, PITCH.right, ball.y, '#f87171', 14);
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
  };
}

export function drawPixelSoccer(
  ctx: CanvasRenderingContext2D,
  state: SoccerMatchState,
) {
  ctx.imageSmoothingEnabled = false;

  // Outer stadium dark border
  ctx.fillStyle = '#0c131f';
  ctx.fillRect(0, 0, PIXEL_W, PIXEL_H);

  // Striped pixel grass
  const stripeW = 20;
  for (let x = PITCH.left; x < PITCH.right; x += stripeW) {
    const idx = Math.floor((x - PITCH.left) / stripeW);
    ctx.fillStyle = idx % 2 === 0 ? '#1b5e34' : '#206b3c';
    ctx.fillRect(
      x,
      PITCH.top,
      Math.min(stripeW, PITCH.right - x),
      PITCH.bottom - PITCH.top,
    );
  }

  // Pitch markings (crisp 1px/2px pixel lines)
  ctx.fillStyle = '#d1fae5';
  // Border
  ctx.fillRect(PITCH.left, PITCH.top, PITCH.right - PITCH.left, 1);
  ctx.fillRect(PITCH.left, PITCH.bottom - 1, PITCH.right - PITCH.left, 1);
  ctx.fillRect(PITCH.left, PITCH.top, 1, PITCH.bottom - PITCH.top);
  ctx.fillRect(PITCH.right - 1, PITCH.top, 1, PITCH.bottom - PITCH.top);
  // Halfway line & center circle
  const midX = Math.floor((PITCH.left + PITCH.right) / 2);
  const midY = Math.floor((PITCH.top + PITCH.bottom) / 2);
  ctx.fillRect(midX, PITCH.top, 1, PITCH.bottom - PITCH.top);
  ctx.strokeStyle = '#d1fae5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(midX, midY, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Penalty boxes
  ctx.strokeRect(PITCH.left, PITCH.goalTop - 14, 28, 78);
  ctx.strokeRect(PITCH.right - 28, PITCH.goalTop - 14, 28, 78);

  // Goals (left Red, right Blue)
  const goalH = PITCH.goalBottom - PITCH.goalTop;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(
    PITCH.left - PITCH.goalDepth,
    PITCH.goalTop,
    PITCH.goalDepth,
    goalH,
  );
  ctx.fillRect(PITCH.right, PITCH.goalTop, PITCH.goalDepth, goalH);
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

  // Pixel particles
  for (const pt of state.particles) {
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2);
  }

  // Players (pixel-art blocky sprites)
  for (const p of state.players) {
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const shirt = p.team === 'red' ? '#ef4444' : '#3b82f6';
    const trim = p.team === 'red' ? '#fca5a5' : '#93c5fd';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px - 4, py + 4, 8, 2);

    // Jersey body
    ctx.fillStyle = shirt;
    ctx.fillRect(px - 4, py - 3, 8, 6);
    // Shorts
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 4, py + 3, 8, 2);
    // Head
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(px - 3, py - 7, 6, 4);
    // Hair/headband
    ctx.fillStyle = trim;
    ctx.fillRect(px - 3, py - 8, 6, 2);

    // Facing indicator pixel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      px + Math.round(p.dirX * 4),
      py + Math.round(p.dirY * 4),
      1,
      1,
    );
  }

  // Pixel soccer ball
  const bx = Math.round(state.ball.x);
  const by = Math.round(state.ball.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(bx - 3, by + 3, 6, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx - 3, by - 3, 6, 6);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bx - 1, by - 1, 2, 2);
  ctx.fillRect(bx - 3, by - 3, 1, 1);
  ctx.fillRect(bx + 2, by - 3, 1, 1);
  ctx.fillRect(bx - 3, by + 2, 1, 1);
  ctx.fillRect(bx + 2, by + 2, 1, 1);

  // Top pixel scoreboard strip
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, PIXEL_W, 18);
  ctx.font = 'bold 10px monospace';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f87171';
  ctx.textAlign = 'right';
  ctx.fillText(`MERAH ${state.scoreRed}`, midX - 18, 9);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  const sec = Math.ceil(state.timeLeft);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  ctx.fillText(state.goldenGoal ? 'GOLDEN' : `${mm}:${ss}`, midX, 9);

  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.scoreBlue} BIRU`, midX + 18, 9);

  // Goal celebration banner
  if (state.goalBannerTimer > 0) {
    ctx.fillStyle = 'rgba(9, 13, 20, 0.75)';
    ctx.fillRect(midX - 58, midY - 16, 116, 32);
    ctx.strokeStyle = state.lastScorerTeam === 'red' ? '#f87171' : '#60a5fa';
    ctx.lineWidth = 2;
    ctx.strokeRect(midX - 58, midY - 16, 116, 32);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GOL!!', midX, midY + 1);
  }
}
