import { createGeludState, FighterInput, stepGelud } from '@/lib/games/gelud';

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
  it('moves fighters and prevents walking past arena bounds', () => {
    let s = createGeludState('2p');
    for (let i = 0; i < 40; i++) {
      s = stepGelud(s, [{ ...idle, left: true }, idle], 0.03).state;
    }
    expect(s.fighters[0].x).toBeGreaterThanOrEqual(46);
  });

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
