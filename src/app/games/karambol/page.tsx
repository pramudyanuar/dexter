'use client';

import * as React from 'react';

import {
  BASELINE_MAX,
  BASELINE_MIN,
  BASELINE_OFFSET,
  baselineCoords,
  BOARD_SIZE,
  BoardSide,
  KarambolPiece,
  KarambolState,
  MAX_POWER,
  PIECE_RADIUS,
  POCKET_RADIUS,
  POCKETS,
  seatSide,
  simulateShot,
  SimulationFrame,
  STRIKER_RADIUS,
  teamOf,
  TURN_SECONDS,
  WALL_PAD,
} from '@/lib/games/karambol';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomChat from '@/components/games/RoomChat';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

function toView(x: number, y: number, viewSide: BoardSide) {
  if (viewSide === 'bottom') return { x, y };
  if (viewSide === 'top') return { x: BOARD_SIZE - x, y: BOARD_SIZE - y };
  if (viewSide === 'right') return { x: y, y: BOARD_SIZE - x };
  return { x: BOARD_SIZE - y, y: x };
}

function toBoardPoint(vx: number, vy: number, viewSide: BoardSide) {
  if (viewSide === 'bottom') return { x: vx, y: vy };
  if (viewSide === 'top') return { x: BOARD_SIZE - vx, y: BOARD_SIZE - vy };
  if (viewSide === 'right') return { x: BOARD_SIZE - vy, y: vx };
  return { x: vy, y: BOARD_SIZE - vx };
}

function toViewVec(dx: number, dy: number, viewSide: BoardSide) {
  if (viewSide === 'bottom') return { x: dx, y: dy };
  if (viewSide === 'top') return { x: -dx, y: -dy };
  if (viewSide === 'right') return { x: dy, y: -dx };
  return { x: -dy, y: dx };
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  bodies: readonly { id: number; kind: string; x: number; y: number }[],
  viewSide: BoardSide,
  aim: { sx: number; sy: number; vx: number; vy: number } | null,
) {
  const pt = (x: number, y: number) => toView(x, y, viewSide);

  ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Outer wooden frame
  ctx.fillStyle = '#3b281a';
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Inner playing surface
  ctx.fillStyle = '#e6cfa8';
  ctx.fillRect(
    WALL_PAD,
    WALL_PAD,
    BOARD_SIZE - WALL_PAD * 2,
    BOARD_SIZE - WALL_PAD * 2,
  );

  // Subtle inner frame border
  ctx.strokeStyle = '#6b472b';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    WALL_PAD,
    WALL_PAD,
    BOARD_SIZE - WALL_PAD * 2,
    BOARD_SIZE - WALL_PAD * 2,
  );

  // Center circles
  const cx = BOARD_SIZE / 2;
  const cy = BOARD_SIZE / 2;
  ctx.strokeStyle = '#9c4234';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#7a4e32';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 17, 0, Math.PI * 2);
  ctx.stroke();

  // All 4 baselines (standard Carrom board)
  const drawBaseline = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    nx: number,
    ny: number,
  ) => {
    const a1 = pt(x1 + nx * 12, y1 + ny * 12);
    const b1 = pt(x2 + nx * 12, y2 + ny * 12);
    const a2 = pt(x1 - nx * 12, y1 - ny * 12);
    const b2 = pt(x2 - nx * 12, y2 - ny * 12);
    ctx.strokeStyle = '#7a4e32';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();

    for (const end of [pt(x1, y1), pt(x2, y2)]) {
      ctx.fillStyle = '#b93b2f';
      ctx.beginPath();
      ctx.arc(end.x, end.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5c2c1b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  drawBaseline(
    BASELINE_MIN,
    BOARD_SIZE - BASELINE_OFFSET,
    BASELINE_MAX,
    BOARD_SIZE - BASELINE_OFFSET,
    0,
    1,
  );
  drawBaseline(
    BASELINE_MIN,
    BASELINE_OFFSET,
    BASELINE_MAX,
    BASELINE_OFFSET,
    0,
    1,
  );
  drawBaseline(
    BOARD_SIZE - BASELINE_OFFSET,
    BASELINE_MIN,
    BOARD_SIZE - BASELINE_OFFSET,
    BASELINE_MAX,
    1,
    0,
  );
  drawBaseline(
    BASELINE_OFFSET,
    BASELINE_MIN,
    BASELINE_OFFSET,
    BASELINE_MAX,
    1,
    0,
  );

  // Diagonal arrows
  ctx.strokeStyle = 'rgba(122, 78, 50, 0.55)';
  ctx.lineWidth = 1.5;
  for (const [ax, ay, bx, by] of [
    [105, 105, 195, 195],
    [495, 105, 405, 195],
    [105, 495, 195, 405],
    [495, 495, 405, 405],
  ]) {
    const p1 = pt(ax, ay);
    const p2 = pt(bx, by);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // 4 corner pockets
  for (const p of POCKETS) {
    const vp = pt(p.x, p.y);
    ctx.fillStyle = '#14110f';
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3d28';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Aim line & power indicator
  if (aim) {
    const speed = Math.hypot(aim.vx, aim.vy);
    if (speed > 0.8) {
      const s = pt(aim.sx, aim.sy);
      const av = toViewVec(aim.vx, aim.vy, viewSide);
      const ratio = Math.min(1, speed / MAX_POWER);

      ctx.strokeStyle = `rgba(185, 59, 47, ${0.35 + ratio * 0.45})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, STRIKER_RADIUS + 8 + ratio * 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = 'rgba(20, 17, 15, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + av.x * 12, s.y + av.y * 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw pieces & striker
  for (const b of bodies) {
    const vp = pt(b.x, b.y);
    const r = b.kind === 'striker' ? STRIKER_RADIUS : PIECE_RADIUS;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.arc(vp.x + 2, vp.y + 2.5, r, 0, Math.PI * 2);
    ctx.fill();

    if (b.kind === 'white') {
      ctx.fillStyle = '#f7f3ea';
      ctx.strokeStyle = '#9c8f7a';
    } else if (b.kind === 'black') {
      ctx.fillStyle = '#23262e';
      ctx.strokeStyle = '#0c0d11';
    } else if (b.kind === 'queen') {
      ctx.fillStyle = '#d13b47';
      ctx.strokeStyle = '#751822';
    } else {
      ctx.fillStyle = '#e7b94c';
      ctx.strokeStyle = '#6f4e12';
    }

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle =
      b.kind === 'black' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(vp.x, vp.y, r * 0.56, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function KarambolBoard({
  state,
  you,
  canShoot,
  busy,
  onShoot,
}: {
  state: KarambolState;
  you: number;
  canShoot: boolean;
  busy: boolean;
  onShoot: (pos: number, vx: number, vy: number) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [sliderPos, setSliderPos] = React.useState(300);
  const [drag, setDrag] = React.useState<{
    pos: number;
    sx: number;
    sy: number;
    vx: number;
    vy: number;
  } | null>(null);
  const [frames, setFrames] = React.useState<SimulationFrame[] | null>(null);
  const [frameIdx, setFrameIdx] = React.useState(0);
  const lastPlayedSeq = React.useRef(state.shotSeq);

  const viewSide = seatSide(you, state.players);
  const turnSide = seatSide(state.turn, state.players);

  // Map screen-bottom slider (115..485 left-to-right) to board baseline coord
  const boardPos =
    viewSide === 'top' || viewSide === 'right'
      ? BOARD_SIZE - sliderPos
      : sliderPos;
  const strikerCoords = baselineCoords(
    turnSide,
    state.turn === you ? boardPos : 300,
  );

  React.useEffect(() => {
    if (!state.lastShot || state.lastShot.seq === lastPlayedSeq.current) return;
    lastPlayedSeq.current = state.lastShot.seq;
    const sim = simulateShot(
      state.lastShot.startPieces,
      state.lastShot.x,
      state.lastShot.y,
      state.lastShot.vx,
      state.lastShot.vy,
      true,
    );
    setFrames(sim.frames);
    setFrameIdx(0);
  }, [state.lastShot]);

  React.useEffect(() => {
    if (!frames) return;
    if (frameIdx >= frames.length - 1) {
      const done = setTimeout(() => setFrames(null), 120);
      return () => clearTimeout(done);
    }
    const raf = requestAnimationFrame(() => {
      setFrameIdx((i) => Math.min(frames.length - 1, i + 1));
    });
    return () => cancelAnimationFrame(raf);
  }, [frames, frameIdx]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (frames && frames[frameIdx]) {
      drawBoard(ctx, frames[frameIdx].bodies, viewSide, null);
      return;
    }

    const bodies: { id: number; kind: string; x: number; y: number }[] =
      state.pieces.map((p: KarambolPiece) => ({
        id: p.id,
        kind: p.kind,
        x: p.x,
        y: p.y,
      }));
    if (state.winner === null) {
      bodies.push({
        id: -1,
        kind: 'striker',
        x: strikerCoords.x,
        y: strikerCoords.y,
      });
    }
    drawBoard(ctx, bodies, viewSide, drag);
  }, [
    state.pieces,
    state.winner,
    strikerCoords.x,
    strikerCoords.y,
    viewSide,
    drag,
    frames,
    frameIdx,
  ]);

  const toBoard = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 300, y: 300 };
    const rect = canvas.getBoundingClientRect();
    const vx = ((clientX - rect.left) / rect.width) * BOARD_SIZE;
    const vy = ((clientY - rect.top) / rect.height) * BOARD_SIZE;
    return toBoardPoint(vx, vy, viewSide);
  };

  const animating = Boolean(frames);
  const interactive = canShoot && !busy && !animating;

  return (
    <div className='mx-auto flex w-full max-w-[32rem] flex-col gap-3'>
      <canvas
        ref={canvasRef}
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        aria-label='Papan Karambol'
        onPointerDown={(e) => {
          if (!interactive) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({
            pos: boardPos,
            sx: strikerCoords.x,
            sy: strikerCoords.y,
            vx: 0,
            vy: 0,
          });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const pt = toBoard(e.clientX, e.clientY);
          const rawVx = (drag.sx - pt.x) * 0.16;
          const rawVy = (drag.sy - pt.y) * 0.16;
          const spd = Math.hypot(rawVx, rawVy);
          const scale = spd > MAX_POWER ? MAX_POWER / spd : 1;
          setDrag({
            ...drag,
            vx: rawVx * scale,
            vy: rawVy * scale,
          });
        }}
        onPointerUp={(e) => {
          if (!drag) return;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
          const speed = Math.hypot(drag.vx, drag.vy);
          const shot = drag;
          setDrag(null);
          if (speed >= 1) {
            onShoot(shot.pos, shot.vx, shot.vy);
          }
        }}
        onPointerCancel={() => setDrag(null)}
        className={`aspect-square w-full touch-none rounded-xl border-2 border-[#5a4230] shadow-xl ${
          interactive ? 'cursor-crosshair' : 'cursor-default'
        }`}
      />

      {interactive && (
        <label className='flex items-center gap-3 rounded-lg border border-line bg-surface/60 px-3 py-2 text-xs text-[var(--mute)]'>
          <span className='shrink-0'>Posisi striker</span>
          <input
            type='range'
            min={BASELINE_MIN}
            max={BASELINE_MAX}
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className='w-full accent-accent'
          />
        </label>
      )}
    </div>
  );
}

function Karambol() {
  const r = useRoom<KarambolState>('karambol');

  return (
    <RoomGate
      r={r}
      blurb='# Karambol online untuk 2–4 pemain. 2 pemain (1v1), 3 pemain (rebutan poin), atau 4 pemain (2v2 tim seberang). Tarik mundur untuk membidik!'
    >
      {({ room, you }) => {
        const s = room.state;
        const over = s.winner !== null;
        const myTurn = !over && s.turn === you;
        const isFfa = s.players === 3;
        const myTeam = teamOf(you);
        const didWin =
          over &&
          (s.winningTeam !== null
            ? s.winningTeam === myTeam
            : s.winner === you);

        const whiteLeft = s.pieces.filter((p) => p.kind === 'white').length;
        const blackLeft = s.pieces.filter((p) => p.kind === 'black').length;

        const queenLabel =
          s.queenOwner !== null
            ? `Ratu: ${room.names[s.queenOwner] ?? `Pemain ${s.queenOwner + 1}`}`
            : s.queenPending !== null
              ? `Ratu perlu di-cover (${s.queenPending === you ? 'kamu' : (room.names[s.queenPending] ?? `P${s.queenPending + 1}`)})`
              : 'Ratu di meja';

        const activeName = room.names[s.turn] ?? `Pemain ${s.turn + 1}`;

        return (
          <>
            {didWin && <Confetti />}

            <div className='mb-2 flex flex-wrap items-center justify-between gap-2 text-xs'>
              {isFfa ? (
                <div className='flex flex-wrap items-center gap-3'>
                  {s.scores.map((sc, idx) => (
                    <span
                      key={idx}
                      className={idx === you ? 'font-semibold text-accent' : ''}
                    >
                      {room.names[idx] ?? `P${idx + 1}`}:{' '}
                      <strong className='text-ink'>{sc}</strong>
                    </span>
                  ))}
                </div>
              ) : (
                <div className='flex items-center gap-3'>
                  <span className='inline-flex items-center gap-1.5'>
                    <span className='size-3 rounded-full border border-line-strong bg-[#f7f3ea]' />
                    {s.players === 4 ? 'Tim Putih' : 'Putih'}:{' '}
                    <strong className='text-ink'>{whiteLeft}</strong>
                  </span>
                  <span className='inline-flex items-center gap-1.5'>
                    <span className='size-3 rounded-full border border-line-strong bg-[#23262e]' />
                    {s.players === 4 ? 'Tim Hitam' : 'Hitam'}:{' '}
                    <strong className='text-ink'>{blackLeft}</strong>
                  </span>
                </div>
              )}
              <span className='rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] text-[var(--mute)]'>
                {queenLabel}
              </span>
            </div>

            <p
              key={`${s.turn}-${s.winner}-${s.shotSeq}`}
              className='a-slide-up mb-2 text-center text-sm'
              aria-live='polite'
            >
              {over ? (
                didWin ? (
                  <span className='text-accent'>
                    {s.players === 4 ? 'Tim kamu menang!' : 'Kamu menang!'}
                  </span>
                ) : (
                  <span className='text-err'>
                    {s.players === 4 ? 'Tim kamu kalah.' : 'Kamu kalah.'}
                  </span>
                )
              ) : myTurn ? (
                <span className='text-accent'>
                  Giliranmu
                  {!isFfa && ` (${myTeam === 0 ? 'Putih' : 'Hitam'})`} — tarik
                  mundur untuk menembak
                </span>
              ) : (
                <span className='text-mute'>Giliran {activeName}…</span>
              )}
            </p>

            {s.lastShot?.message && (
              <p className='mb-3 text-center text-xs text-[var(--mute)]'>
                {s.lastShot.message}
              </p>
            )}

            <KarambolBoard
              state={s}
              you={you}
              canShoot={myTurn}
              busy={r.busy}
              onShoot={(pos, vx, vy) => r.move({ pos, vx, vy })}
            />

            {over && <Rematch r={r} />}

            <p className='mt-auto pt-4 text-center text-xs text-mute'>
              {TURN_SECONDS} detik per giliran. Room hilang sendiri setelah 2
              jam.
            </p>
          </>
        );
      }}
    </RoomGate>
  );
}

export default function KarambolPage() {
  const mounted = useMounted();

  return (
    <GameShell name='karambol' wide>
      {mounted ? (
        <>
          <Karambol />
          <RoomChat game='karambol' />
        </>
      ) : null}
    </GameShell>
  );
}
