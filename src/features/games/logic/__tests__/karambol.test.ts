import {
  BASELINE_OFFSET,
  BOARD_SIZE,
  initialRack,
  karambolGame,
  move,
  POCKETS,
  seatSide,
  simulateShot,
  start,
} from '@/features/games/logic/karambol';

describe('karambol engine', () => {
  it('skips departing seats and ends when a team has no players left', () => {
    const next = karambolGame.eliminate!(start(4), 0);
    expect(next.turn).toBe(1);
    expect(next.winner).toBeNull();
    expect(karambolGame.eliminate!(next, 2)).toMatchObject({
      winner: 1,
      winningTeam: 1,
    });
  });
  it('sets up a standard 19-piece rack (9 white, 9 black, 1 queen)', () => {
    const rack = initialRack();
    expect(rack).toHaveLength(19);
    expect(rack.filter((p) => p.kind === 'white')).toHaveLength(9);
    expect(rack.filter((p) => p.kind === 'black')).toHaveLength(9);
    expect(rack.filter((p) => p.kind === 'queen')).toHaveLength(1);
  });

  it('rejects out-of-turn or too-weak shots', () => {
    const s = start();
    expect(() => move(s, 1, { x: 300, vx: 0, vy: -10 })).toThrow(
      'Bukan giliranmu',
    );
    expect(() => move(s, 0, { x: 300, vx: 0.1, vy: 0.1 })).toThrow(
      'Tarikan terlalu lemah',
    );
  });

  it('pockets a piece aimed at a corner pocket and keeps the turn', () => {
    const px = 120;
    const py = 140;
    const sx = 405;
    const s = {
      ...start(),
      pieces: [
        { id: 1, kind: 'white' as const, x: px, y: py },
        { id: 2, kind: 'black' as const, x: 450, y: 450 },
        { id: 3, kind: 'white' as const, x: 450, y: 350 },
      ],
    };
    const sy = BOARD_SIZE - BASELINE_OFFSET;
    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy);
    const next = move(s, 0, {
      x: sx,
      vx: (dx / len) * 9,
      vy: (dy / len) * 9,
    });
    expect(next.pieces.some((p) => p.id === 1)).toBe(false);
    expect(next.turn).toBe(0);
    expect(next.lastShot?.foul).toBe(false);
  });

  it('penalizes a striker foul by returning a pocketed piece and passing turn', () => {
    const pocket = POCKETS[2]; // bottom-left
    const s = {
      ...start(),
      pieces: [
        { id: 1, kind: 'white' as const, x: 300, y: 300 },
        { id: 2, kind: 'black' as const, x: 420, y: 300 },
      ],
    };
    // Aim striker straight into bottom-left pocket
    const dx = pocket.x - 120;
    const dy = pocket.y - (BOARD_SIZE - BASELINE_OFFSET);
    const len = Math.hypot(dx, dy);
    const next = move(s, 0, {
      x: 120,
      vx: (dx / len) * 14,
      vy: (dy / len) * 14,
    });
    expect(next.lastShot?.foul).toBe(true);
    expect(next.turn).toBe(1);
    // Had 1 white left (<9), so 1 white is returned to center -> 2 whites now
    expect(next.pieces.filter((p) => p.kind === 'white')).toHaveLength(2);
  });

  it('declares winner when all of a player pieces are pocketed', () => {
    const px = 120;
    const py = 140;
    const sx = 405;
    const s = {
      ...start(),
      pieces: [
        { id: 1, kind: 'white' as const, x: px, y: py },
        { id: 2, kind: 'black' as const, x: 450, y: 450 },
      ],
    };
    const sy = BOARD_SIZE - BASELINE_OFFSET;
    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy);
    const next = move(s, 0, {
      x: sx,
      vx: (dx / len) * 9,
      vy: (dy / len) * 9,
    });
    expect(next.winner).toBe(0);
    expect(karambolGame.isOver(next)).toBe(true);
  });

  it('records simulation frames when requested', () => {
    const sim = simulateShot(
      initialRack(),
      300,
      BOARD_SIZE - BASELINE_OFFSET,
      0,
      -18,
      true,
    );
    expect(sim.frames.length).toBeGreaterThan(10);
  });

  it('supports 4-player 2v2 teams with rotating turns and team win', () => {
    const s = start(4);
    expect(s.players).toBe(4);
    expect(seatSide(0, 4)).toBe('bottom');
    expect(seatSide(1, 4)).toBe('right');
    expect(seatSide(2, 4)).toBe('top');
    expect(seatSide(3, 4)).toBe('left');

    // Miss on seat 0 rotates to seat 1
    const after0 = move(s, 0, { pos: 300, vx: 0, vy: 2 });
    expect(after0.turn).toBe(1);

    // Seat 2 (White team partner, top baseline) sinks last white piece into bottom-left pocket -> White team wins
    const px = 120;
    const py = 460;
    const sx = 405;
    const sy = BASELINE_OFFSET;
    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy);
    const endState = {
      ...start(4),
      turn: 2,
      pieces: [
        { id: 1, kind: 'white' as const, x: px, y: py },
        { id: 2, kind: 'black' as const, x: 450, y: 450 },
      ],
    };
    const won = move(endState, 2, {
      pos: sx,
      vx: (dx / len) * 9,
      vy: (dy / len) * 9,
    });
    expect(won.winningTeam).toBe(0);
    expect(karambolGame.isOver(won)).toBe(true);
  });

  it('supports 3-player free-for-all scoring', () => {
    const px = 120;
    const py = 140;
    const sx = 405;
    const sy = BOARD_SIZE - BASELINE_OFFSET;
    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy);
    const s = {
      ...start(3),
      pieces: [
        { id: 1, kind: 'black' as const, x: px, y: py },
        { id: 2, kind: 'white' as const, x: 450, y: 450 },
      ],
    };
    const next = move(s, 0, {
      pos: sx,
      vx: (dx / len) * 9,
      vy: (dy / len) * 9,
    });
    expect(next.scores[0]).toBe(1);
    expect(next.turn).toBe(0);
  });
});
