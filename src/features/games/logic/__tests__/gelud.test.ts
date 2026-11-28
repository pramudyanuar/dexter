import {
  createGeludState,
  FighterInput,
  geludGame,
  MOVE_SPEED,
  stepGelud,
} from '@/features/games/logic/gelud';

const idle: FighterInput = {
  left: false,
  right: false,
  jump: false,
  block: false,
  punch: false,
  kick: false,
  special: false,
};

describe('gelud fighting engine', () => {
  it('ends a live match when a new host page tries to start it again', () => {
    const started = geludGame.start(2);
    const open = { match: 0, hostRun: 'a'.repeat(32) };
    expect(() => geludGame.move(started, 1, open)).toThrow();
    const live = geludGame.move(started, 0, open);
    expect(geludGame.move(live, 0, open)).toBe(live);
    const reloaded = geludGame.move(live, 0, {
      match: 0,
      hostRun: 'b'.repeat(32),
    });
    expect(reloaded).toMatchObject({ winner: null, hostReloaded: true });
    expect(geludGame.isOver(reloaded)).toBe(true);
    expect(geludGame.voice!(reloaded, 1)).toBeNull();
    expect(geludGame.restart(reloaded, 2)).toEqual({ match: 1, winner: null });
  });

  it('requires both seats to agree and rejects a report from a previous match', () => {
    const room = geludGame.start(2);
    const pending = geludGame.move(room, 1, { match: 0, winner: 0 });
    expect(pending.winner).toBeNull();
    expect(
      geludGame.move(pending, 0, { match: 0, winner: 1 }).winner,
    ).toBeNull();
    const over = geludGame.move(pending, 0, { match: 0, winner: 0 });
    expect(over.winner).toBe(0);
    const rematch = geludGame.restart(over, 2);
    expect(rematch.winner).toBeNull();
    expect(() => geludGame.move(rematch, 0, { match: 0, winner: 0 })).toThrow();
    expect(geludGame.eliminate!(rematch, 0).winner).toBe(1);
  });
  it('moves fighters and prevents walking past arena bounds', () => {
    let s = createGeludState('2p');
    for (let i = 0; i < 40; i++) {
      s = stepGelud(s, [{ ...idle, left: true }, idle], 0.03).state;
    }
    expect(s.fighters[0].x).toBeGreaterThanOrEqual(46);
  });

  it.each(['kick', 'punch'] as const)(
    'moves during a %s and responds to direction changes mid-attack',
    (attack) => {
      const start = createGeludState('2p');
      const moving = stepGelud(
        start,
        [{ ...idle, right: true }, idle],
        0.02,
      ).state;
      const attacking = stepGelud(
        moving,
        [{ ...idle, right: true, [attack]: true }, idle],
        0.02,
      ).state;
      expect(attacking.fighters[0]).toMatchObject({
        action: attack,
        vx: MOVE_SPEED,
      });
      expect(attacking.fighters[0].x).toBeGreaterThan(moving.fighters[0].x);
      const retreating = stepGelud(
        attacking,
        [{ ...idle, left: true }, idle],
        0.02,
      ).state;
      expect(retreating.fighters[0]).toMatchObject({
        action: attack,
        vx: -MOVE_SPEED,
        facing: 1,
      });
      expect(retreating.fighters[0].x).toBeLessThan(attacking.fighters[0].x);
    },
  );

  it('lands punches when in range and reduces opponent HP', () => {
    let s = createGeludState('2p');
    s.fighters[0].x = 300;
    s.fighters[1].x = 360;

    let hit = false;
    for (let i = 0; i < 12; i++) {
      const res = stepGelud(s, [{ ...idle, punch: i === 0 }, idle], 0.02);
      s = res.state;
      if (res.events.hit) hit = true;
    }
    expect(hit).toBe(true);
    expect(s.fighters[1].hp).toBeLessThan(100);
  });

  it('reduces damage when opponent is blocking', () => {
    let s = createGeludState('2p');
    s.fighters[0].x = 300;
    s.fighters[1].x = 360;

    for (let i = 0; i < 12; i++) {
      s = stepGelud(
        s,
        [
          { ...idle, kick: i === 0 },
          { ...idle, block: true },
        ],
        0.02,
      ).state;
    }
    // Unblocked kick is 13 dmg; blocked is 3 dmg (97 HP)
    expect(s.fighters[1].hp).toBe(97);
  });

  it('triggers match-over when a fighter wins 2 rounds', () => {
    const s = createGeludState('2p');
    s.fighters[0].roundsWon = 1;
    s.fighters[1].hp = 5;
    s.fighters[0].x = 300;
    s.fighters[1].x = 360;

    let cur = s;
    for (let i = 0; i < 12; i++) {
      cur = stepGelud(cur, [{ ...idle, punch: i === 0 }, idle], 0.02).state;
    }
    expect(cur.phase).toBe('match-over');
    expect(cur.winner).toBe(0);
  });
});
