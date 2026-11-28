import type { GameDef } from '@/features/rooms/game';
import { RoomError } from '@/features/rooms/types';

export const BOARD_SIZE = 600;
export const WALL_PAD = 24;
export const PIECE_RADIUS = 13.5;
export const STRIKER_RADIUS = 18;
export const POCKET_RADIUS = 23;
export const BASELINE_MIN = 115;
export const BASELINE_MAX = 485;
export const BASELINE_OFFSET = 100;
export const MAX_POWER = 24;
export const TURN_SECONDS = 45;

export type BoardSide = 'bottom' | 'right' | 'top' | 'left';

export const POCKETS: readonly { x: number; y: number }[] = [
  { x: WALL_PAD + POCKET_RADIUS - 3, y: WALL_PAD + POCKET_RADIUS - 3 },
  {
    x: BOARD_SIZE - WALL_PAD - POCKET_RADIUS + 3,
    y: WALL_PAD + POCKET_RADIUS - 3,
  },
  {
    x: WALL_PAD + POCKET_RADIUS - 3,
    y: BOARD_SIZE - WALL_PAD - POCKET_RADIUS + 3,
  },
  {
    x: BOARD_SIZE - WALL_PAD - POCKET_RADIUS + 3,
    y: BOARD_SIZE - WALL_PAD - POCKET_RADIUS + 3,
  },
];

export type PieceKind = 'white' | 'black' | 'queen';

export interface KarambolPiece {
  id: number;
  kind: PieceKind;
  x: number;
  y: number;
}

export interface KarambolShotMove {
  /** Position along the active player's baseline (115..485). `x` accepted as alias. */
  pos?: number;
  x?: number;
  vx: number;
  vy: number;
}

export interface KarambolShotSummary {
  seq: number;
  seat: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startPieces: KarambolPiece[];
  pocketed: PieceKind[];
  foul: boolean;
  message: string;
}

export interface KarambolState {
  players: number;
  pieces: KarambolPiece[];
  turn: number;
  /** Winning seat (or first seat of winning team in 4-player 2v2) */
  winner: number | null;
  /** In 4-player 2v2: 0 = White team (seats 0,2), 1 = Black team (seats 1,3) */
  winningTeam: 0 | 1 | null;
  /** Per-seat scores (used in 3-player free-for-all) */
  scores: number[];
  /** Seat that currently holds a Queen waiting to be covered, or null */
  queenPending: number | null;
  /** Seat that has secured the Queen, or null */
  queenOwner: number | null;
  shotSeq: number;
  lastShot: KarambolShotSummary | null;
  dropped?: number[];
}

const activeSeats = (s: KarambolState) =>
  Array.from({ length: s.players }, (_, seat) => seat).filter(
    (seat) => !s.dropped?.includes(seat),
  );

function nextSeat(state: KarambolState, from: number) {
  const seats = activeSeats(state);
  return seats.find((seat) => seat > from) ?? seats[0] ?? from;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Maps a seat index (0..players-1) to which edge of the board they sit on. */
export function seatSide(seat: number, players: number): BoardSide {
  if (players === 2) return seat === 0 ? 'bottom' : 'top';
  if (seat === 0) return 'bottom';
  if (seat === 1) return 'right';
  if (seat === 2) return 'top';
  return 'left';
}

/** Converts a 1D baseline slider value (115..485) into board (x, y) for a side. */
export function baselineCoords(
  side: BoardSide,
  pos: number,
): {
  x: number;
  y: number;
} {
  const clamped = r2(Math.min(BASELINE_MAX, Math.max(BASELINE_MIN, pos)));
  if (side === 'bottom') return { x: clamped, y: BOARD_SIZE - BASELINE_OFFSET };
  if (side === 'top') return { x: clamped, y: BASELINE_OFFSET };
  if (side === 'right') return { x: BOARD_SIZE - BASELINE_OFFSET, y: clamped };
  return { x: BASELINE_OFFSET, y: clamped };
}

/** In 2p and 4p, seat 0/2 play White (team 0) and seat 1/3 play Black (team 1). */
export function teamOf(seat: number): 0 | 1 {
  return seat % 2 === 0 ? 0 : 1;
}

/**
 * Standard 19-piece hexagonal Carrom rack:
 * 1 Queen at center, 6 inner ring (alternating white/black), 12 outer ring.
 */
export function initialRack(): KarambolPiece[] {
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;
  const d = PIECE_RADIUS * 2 + 0.6;
  const pieces: KarambolPiece[] = [{ id: 0, kind: 'queen', x: cx, y: cy }];
  let id = 1;

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 2;
    pieces.push({
      id: id++,
      kind: i % 2 === 0 ? 'white' : 'black',
      x: r2(cx + Math.cos(angle) * d),
      y: r2(cy + Math.sin(angle) * d),
    });
  }

  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2;
    const dist = i % 2 === 0 ? d * 2 : d * Math.sqrt(3);
    const kind: PieceKind =
      i % 2 === 0
        ? 'white'
        : i === 1 || i === 5 || i === 9
          ? 'black'
          : i === 3 || i === 7 || i === 11
            ? 'black'
            : 'white';
    pieces.push({
      id: id++,
      kind,
      x: r2(cx + Math.cos(angle) * dist),
      y: r2(cy + Math.sin(angle) * dist),
    });
  }

  const whites = pieces.filter((p) => p.kind === 'white').length;
  const blacks = pieces.filter((p) => p.kind === 'black').length;
  if (whites !== 9 || blacks !== 9) {
    let w = 0;
    let b = 0;
    for (const p of pieces) {
      if (p.kind === 'queen') continue;
      if (p.kind === 'white') w++;
      else b++;
      if (w > 9) {
        p.kind = 'black';
        w--;
        b++;
      } else if (b > 9) {
        p.kind = 'white';
        b--;
        w++;
      }
    }
  }

  return pieces;
}

interface SimBody {
  id: number;
  kind: PieceKind | 'striker';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mass: number;
  pocketed: boolean;
}

export interface SimulationFrame {
  bodies: { id: number; kind: PieceKind | 'striker'; x: number; y: number }[];
}

export interface SimulationResult {
  pieces: KarambolPiece[];
  pocketed: PieceKind[];
  foul: boolean;
  frames: SimulationFrame[];
}

/**
 * Deterministic 2D circle physics simulation shared by both the server engine
 * and the client canvas for smooth 60fps replay.
 */
export function simulateShot(
  startPieces: readonly KarambolPiece[],
  strikerX: number,
  strikerY: number,
  vx: number,
  vy: number,
  recordFrames = false,
): SimulationResult {
  const bodies: SimBody[] = [
    ...startPieces.map((p) => ({
      id: p.id,
      kind: p.kind as PieceKind | 'striker',
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      r: PIECE_RADIUS,
      mass: 1,
      pocketed: false,
    })),
    {
      id: -1,
      kind: 'striker',
      x: strikerX,
      y: strikerY,
      vx,
      vy,
      r: STRIKER_RADIUS,
      mass: 1.6,
      pocketed: false,
    },
  ];

  const pocketed: PieceKind[] = [];
  let foul = false;
  const frames: SimulationFrame[] = [];

  const minWall = WALL_PAD;
  const maxWall = BOARD_SIZE - WALL_PAD;
  const substeps = 4;
  const friction = Math.pow(0.985, 1 / substeps);
  const stopSq = 0.04 * 0.04;
  const maxTicks = 260;

  const snapshot = () => ({
    bodies: bodies
      .filter((b) => !b.pocketed)
      .map((b) => ({ id: b.id, kind: b.kind, x: b.x, y: b.y })),
  });

  if (recordFrames) frames.push(snapshot());

  for (let tick = 0; tick < maxTicks; tick++) {
    for (let s = 0; s < substeps; s++) {
      for (const b of bodies) {
        if (b.pocketed) continue;
        b.x += b.vx / substeps;
        b.y += b.vy / substeps;
        b.vx *= friction;
        b.vy *= friction;

        if (b.x - b.r < minWall) {
          b.x = minWall + b.r;
          b.vx = Math.abs(b.vx) * 0.84;
        } else if (b.x + b.r > maxWall) {
          b.x = maxWall - b.r;
          b.vx = -Math.abs(b.vx) * 0.84;
        }
        if (b.y - b.r < minWall) {
          b.y = minWall + b.r;
          b.vy = Math.abs(b.vy) * 0.84;
        } else if (b.y + b.r > maxWall) {
          b.y = maxWall - b.r;
          b.vy = -Math.abs(b.vy) * 0.84;
        }
      }

      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minDist = a.r + b.r;
          const distSq = dx * dx + dy * dy;
          if (distSq >= minDist * minDist || distSq === 0) continue;

          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          const totalMass = a.mass + b.mass;

          a.x -= nx * overlap * (b.mass / totalMass);
          a.y -= ny * overlap * (b.mass / totalMass);
          b.x += nx * overlap * (a.mass / totalMass);
          b.y += ny * overlap * (a.mass / totalMass);

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal > 0) continue;

          const restitution = 0.88;
          const impulse =
            (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
          a.vx -= (impulse / a.mass) * nx;
          a.vy -= (impulse / a.mass) * ny;
          b.vx += (impulse / b.mass) * nx;
          b.vy += (impulse / b.mass) * ny;
        }
      }

      for (const b of bodies) {
        if (b.pocketed) continue;
        for (const p of POCKETS) {
          const dx = b.x - p.x;
          const dy = b.y - p.y;
          if (dx * dx + dy * dy <= POCKET_RADIUS * POCKET_RADIUS) {
            b.pocketed = true;
            b.vx = 0;
            b.vy = 0;
            if (b.kind === 'striker') foul = true;
            else pocketed.push(b.kind);
            break;
          }
        }
      }
    }

    if (recordFrames) frames.push(snapshot());

    const moving = bodies.some(
      (b) => !b.pocketed && b.vx * b.vx + b.vy * b.vy > stopSq,
    );
    if (!moving) break;
  }

  const pieces = bodies
    .filter((b) => !b.pocketed && b.kind !== 'striker')
    .map((b) => ({
      id: b.id,
      kind: b.kind as PieceKind,
      x: r2(b.x),
      y: r2(b.y),
    }));

  return { pieces, pocketed, foul, frames };
}

function findCenterSpot(pieces: readonly KarambolPiece[]): {
  x: number;
  y: number;
} {
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;
  const minD = PIECE_RADIUS * 2 + 1;
  const clear = (x: number, y: number) =>
    pieces.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= minD * minD);

  if (clear(cx, cy)) return { x: cx, y: cy };
  for (let ring = 1; ring <= 6; ring++) {
    const dist = ring * minD;
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const x = r2(cx + Math.cos(a) * dist);
      const y = r2(cy + Math.sin(a) * dist);
      if (clear(x, y)) return { x, y };
    }
  }
  return { x: cx, y: cy };
}

function nextPieceId(pieces: readonly KarambolPiece[]) {
  return pieces.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

export function start(players = 2): KarambolState {
  const count = Math.min(4, Math.max(2, players));
  return {
    players: count,
    pieces: initialRack(),
    turn: 0,
    winner: null,
    winningTeam: null,
    scores: Array(count).fill(0),
    queenPending: null,
    queenOwner: null,
    shotSeq: 0,
    lastShot: null,
  };
}

export function move(
  state: KarambolState,
  seat: number,
  raw: unknown,
): KarambolState {
  if (state.winner !== null)
    throw new RoomError('Permainan sudah selesai', 409);
  if (seat !== state.turn || state.dropped?.includes(seat))
    throw new RoomError('Bukan giliranmu', 409);

  const m = raw as Partial<KarambolShotMove> | null;
  const posRaw = m?.pos ?? m?.x;
  if (
    !m ||
    typeof posRaw !== 'number' ||
    typeof m.vx !== 'number' ||
    typeof m.vy !== 'number' ||
    !Number.isFinite(posRaw) ||
    !Number.isFinite(m.vx) ||
    !Number.isFinite(m.vy)
  ) {
    throw new RoomError('Tembakan tidak valid', 400);
  }

  const speed = Math.hypot(m.vx, m.vy);
  if (speed < 0.8) throw new RoomError('Tarikan terlalu lemah', 400);

  const scale = speed > MAX_POWER ? MAX_POWER / speed : 1;
  const vx = r2(m.vx * scale);
  const vy = r2(m.vy * scale);
  const side = seatSide(seat, state.players);
  const { x: sx, y: sy } = baselineCoords(side, posRaw);

  const sim = simulateShot(state.pieces, sx, sy, vx, vy, false);
  const pieces = [...sim.pieces];
  const scores = [...state.scores];
  const isFreeForAll = state.players === 3;
  const myTeam = teamOf(seat);
  const myKind: PieceKind = myTeam === 0 ? 'white' : 'black';
  const oppKind: PieceKind = myTeam === 0 ? 'black' : 'white';

  const sankMine = isFreeForAll
    ? sim.pocketed.filter((k) => k !== 'queen').length
    : sim.pocketed.filter((k) => k === myKind).length;
  const sankOpp = isFreeForAll
    ? 0
    : sim.pocketed.filter((k) => k === oppKind).length;
  const sankQueen = sim.pocketed.includes('queen');

  let queenPending = state.queenPending;
  let queenOwner = state.queenOwner;

  const returnPiece = (kind: PieceKind) => {
    const spot = findCenterSpot(pieces);
    pieces.push({ id: nextPieceId(pieces), kind, x: spot.x, y: spot.y });
  };

  const parts: string[] = [];

  if (isFreeForAll && sankMine > 0) {
    scores[seat] += sankMine;
  }

  // Handle Queen status
  if (sankQueen) {
    if (sim.foul) {
      returnPiece('queen');
      parts.push('Ratu dikembalikan karena foul');
    } else if (sankMine > 0) {
      queenOwner = seat;
      queenPending = null;
      if (isFreeForAll) scores[seat] += 3;
      parts.push('Ratu berhasil diamankan!');
    } else {
      queenPending = seat;
      parts.push('Ratu masuk! Masukkan 1 bidak untuk mengunci Ratu.');
    }
  } else if (queenPending === seat) {
    if (!sim.foul && sankMine > 0) {
      queenOwner = seat;
      queenPending = null;
      if (isFreeForAll) scores[seat] += 3;
      parts.push('Ratu berhasil di-cover!');
    } else {
      returnPiece('queen');
      queenPending = null;
      parts.push('Gagal cover Ratu, Ratu kembali ke tengah.');
    }
  }

  // Handle Striker foul
  if (sim.foul) {
    if (isFreeForAll) {
      scores[seat] = Math.max(0, scores[seat] - 1);
      const anyPocketed = pieces.filter((p) => p.kind !== 'queen').length < 18;
      if (anyPocketed) returnPiece(sankMine > 0 ? 'white' : 'black');
    } else {
      const currentMineCount = pieces.filter((p) => p.kind === myKind).length;
      if (currentMineCount < 9) {
        returnPiece(myKind);
      }
    }
    parts.push('Striker masuk lubang (Foul)!');
  } else {
    if (sankMine > 0) parts.push(`+${sankMine} bidak masuk`);
    if (sankOpp > 0) parts.push(`${sankOpp} bidak lawan masuk`);
    if (!sankMine && !sankOpp && !sankQueen)
      parts.push('Belum ada yang masuk.');
  }

  const whiteLeft = pieces.filter((p) => p.kind === 'white').length;
  const blackLeft = pieces.filter((p) => p.kind === 'black').length;

  let winner: number | null = null;
  let winningTeam: 0 | 1 | null = null;

  if (isFreeForAll) {
    if (whiteLeft === 0 && blackLeft === 0 && queenPending === null) {
      const [first, ...others] = activeSeats(state);
      let bestSeat = first;
      for (const i of others) {
        if (scores[i] > scores[bestSeat]) bestSeat = i;
      }
      winner = bestSeat;
    }
  } else {
    if (
      whiteLeft === 0 &&
      (queenPending === null || teamOf(queenPending) !== 0)
    ) {
      winningTeam = 0;
      winner =
        teamOf(seat) === 0
          ? seat
          : (activeSeats(state).find((i) => teamOf(i) === 0) ?? null);
    } else if (
      blackLeft === 0 &&
      (queenPending === null || teamOf(queenPending) !== 1)
    ) {
      winningTeam = 1;
      winner =
        teamOf(seat) === 1
          ? seat
          : (activeSeats(state).find((i) => teamOf(i) === 1) ?? null);
    }
  }

  const keepTurn = winner === null && !sim.foul && (sankMine > 0 || sankQueen);

  return {
    ...state,
    pieces,
    turn: keepTurn ? seat : nextSeat(state, seat),
    winner,
    winningTeam,
    scores,
    queenPending,
    queenOwner,
    shotSeq: state.shotSeq + 1,
    lastShot: {
      seq: state.shotSeq + 1,
      seat,
      x: sx,
      y: sy,
      vx,
      vy,
      startPieces: state.pieces,
      pocketed: sim.pocketed,
      foul: sim.foul,
      message: parts.join(' · '),
    },
  };
}

export const karambolGame: GameDef<KarambolState> = {
  id: 'karambol',
  minPlayers: 2,
  maxPlayers: 4,
  autoStart: false,
  restart: (_prev, players) => start(players),
  start: (players) => start(players),
  move: (state, seat, m) => move(state, seat, m),
  view: (state) => state,
  eliminate(state, seat) {
    if (state.winner !== null || state.dropped?.includes(seat)) return state;
    const next = { ...state, dropped: [...(state.dropped ?? []), seat] };
    const seats = activeSeats(next);
    const remainingTeam = seats.every((i) => teamOf(i) === teamOf(seats[0]));
    if (seats.length === 1 || (state.players === 4 && remainingTeam)) {
      return {
        ...next,
        winner: seats[0],
        winningTeam: state.players === 4 ? teamOf(seats[0]) : null,
      };
    }
    if (next.queenPending === seat) {
      const spot = findCenterSpot(next.pieces);
      next.pieces = [
        ...next.pieces,
        { ...spot, id: nextPieceId(next.pieces), kind: 'queen' },
      ];
      next.queenPending = null;
    }
    if (state.turn === seat) next.turn = nextSeat(next, seat);
    return next;
  },
  waiting: (state) =>
    state.winner === null
      ? { seats: [state.turn], seconds: TURN_SECONDS }
      : null,
  autoMove: (state, seat) => {
    const side = seatSide(seat, state.players);
    const { x: sx, y: sy } = baselineCoords(side, 300);
    const myKind: PieceKind = teamOf(seat) === 0 ? 'white' : 'black';
    const target =
      (state.players === 3
        ? state.pieces[0]
        : state.pieces.find((p) => p.kind === myKind)) ?? state.pieces[0];
    if (!target) {
      return {
        pos: 300,
        vx: side === 'right' ? -12 : side === 'left' ? 12 : 0,
        vy: side === 'bottom' ? -12 : side === 'top' ? 12 : 0,
      };
    }
    const dx = target.x - sx;
    const dy = target.y - sy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      pos: 300,
      vx: r2((dx / len) * 14),
      vy: r2((dy / len) * 14),
    };
  },
  isOver: (state) => state.winner !== null,
};
