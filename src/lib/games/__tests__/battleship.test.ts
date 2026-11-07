import {
  battleshipGame,
  BattleshipState,
  BattleshipView,
  FLEET,
  randomFleet,
  Ship,
  shipCells,
  validFleet,
} from '@/lib/games/battleship';

const start = () => battleshipGame.start(2) as BattleshipState;

describe('battleship', () => {
  it('builds valid random fleets', () => {
    for (let i = 0; i < 25; i++) {
      const fleet = randomFleet();
      expect(validFleet(fleet)).toBe(true);
      expect(fleet.map((s) => s.len).sort()).toEqual([...FLEET].sort());
    }
  });

  it('rejects overlapping, out-of-bounds and wrong-sized fleets', () => {
    const fleet = randomFleet();
    expect(validFleet(fleet.slice(1))).toBe(false);
    expect(
      validFleet([{ ...fleet[0], x: 9, horizontal: true }, ...fleet.slice(1)]),
    ).toBe(false);
    expect(validFleet([fleet[0], { ...fleet[0] }, ...fleet.slice(2)])).toBe(
      false,
    );
  });

  it('starts the battle once both fleets are placed and hides the other fleet', () => {
    let s = start();
    const a = randomFleet();
    const b = randomFleet();
    s = battleshipGame.move(
      s,
      0,
      { type: 'place', ships: a },
      () => 0,
    ) as BattleshipState;
    expect(s.phase).toBe('placing');
    expect(() =>
      battleshipGame.move(s, 0, { type: 'place', ships: a }),
    ).toThrow(/siap/);
    s = battleshipGame.move(
      s,
      1,
      { type: 'place', ships: b },
      () => 0,
    ) as BattleshipState;
    expect(s.phase).toBe('battle');
    expect(s.turn).toBe(0);

    const view = battleshipGame.view(s, 0) as BattleshipView;
    expect(view.mine).toEqual(a);
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(b));
    expect(view.revealed).toEqual([]);
  });

  it('plays to a win, reporting hits, sunk ships and refusing repeats', () => {
    let s = start();
    const a = randomFleet();
    const b = randomFleet();
    s = battleshipGame.move(
      s,
      0,
      { type: 'place', ships: a },
      () => 0,
    ) as BattleshipState;
    s = battleshipGame.move(
      s,
      1,
      { type: 'place', ships: b },
      () => 0,
    ) as BattleshipState;

    const targets = b.flatMap(shipCells);
    const misses = Array.from({ length: 100 }, (_, i) => ({
      x: i % 10,
      y: Math.floor(i / 10),
    })).filter((p) => !targets.some((t) => t.x === p.x && t.y === p.y));

    const first = battleshipGame.move(s, 0, {
      type: 'fire',
      ...targets[0],
    }) as BattleshipState;
    expect(first.last?.hit).toBe(true);
    expect(first.turn).toBe(1);
    expect(() =>
      battleshipGame.move(first, 0, { type: 'fire', x: 0, y: 0 }),
    ).toThrow(/giliran/);

    s = first;
    let i = 1;
    let m = 0;
    while (s.winner === null) {
      // seat 1 wastes shots on empty water while seat 0 sinks the fleet
      s = battleshipGame.move(s, 1, {
        type: 'fire',
        ...(misses.length
          ? { x: m % 10, y: Math.floor(m / 10) }
          : { x: 0, y: 0 }),
      }) as BattleshipState;
      m++;
      s = battleshipGame.move(s, 0, {
        type: 'fire',
        ...targets[i++],
      }) as BattleshipState;
    }
    expect(s.winner).toBe(0);
    expect(battleshipGame.isOver(s)).toBe(true);
    expect((battleshipGame.view(s, 1) as BattleshipView).revealed).toHaveLength(
      5,
    );
    const sunkOne: Ship | undefined = (
      battleshipGame.view(s, 0) as BattleshipView
    ).revealed[0];
    expect(sunkOne).toBeDefined();
  });
});
