/** @jest-environment node */
import {
  checkWinner,
  enabled,
  RoleId,
  roleList,
  sanitizeWerewolf,
  start,
  TIMES,
  werewolfGame as g,
  WerewolfState,
  WerewolfView,
} from '@/lib/games/werewolf';
import { RoomError } from '@/lib/rooms/types';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const T0 = 1_000_000;

const errorOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RoomError;
  }
  return undefined;
};
const view = (s: WerewolfState, seat: number | null) =>
  g.view(s, seat) as WerewolfView;

/** A game with exactly these roles (seat 0 first), already into the first night. */
function night(
  roles: RoleId[],
  cfg: Record<string, unknown> = {},
): WerewolfState {
  const s = start(roles.length, seeded(1), cfg);
  s.roles = roles;
  s.deadline = T0;
  return g.tick!(s, T0, seeded(1))!;
}

const act = (
  s: WerewolfState,
  seat: number,
  m: Record<string, unknown>,
  now = T0,
) => g.move(s, seat, { type: 'night', ...m }, seeded(2), { host: 0, now });
const tick = (s: WerewolfState, now: number) => g.tick!(s, now, seeded(3)) ?? s;
const vote = (
  s: WerewolfState,
  seat: number,
  target: number | null,
  now = T0,
) => g.move(s, seat, { type: 'vote', target }, seeded(2), { host: 0, now });

/** Plays a night to the morning: every actor that is given an action does it. */
function throughNight(
  s: WerewolfState,
  acts: [number, Record<string, unknown>][],
  now = T0,
) {
  let cur = s;
  for (const [seat, a] of acts) cur = act(cur, seat, a, now);
  // time runs out: first stage, then the witch's (unless the night already ended)
  if (cur.phase === 'night')
    cur = tick(cur, now + s.config.nightSeconds * 1000 + 1);
  if (cur.phase === 'night') {
    cur = tick(
      cur,
      now + s.config.nightSeconds * 1000 + TIMES.witch * 1000 + 2,
    );
  }
  return cur;
}

const WOLF = [
  'werewolf',
  'villager',
  'villager',
  'villager',
  'villager',
] as RoleId[];

describe('roles and settings', () => {
  it('fills any table with the right number of roles, and the wolves never reach half', () => {
    const cfg = sanitizeWerewolf({});
    for (let n = 5; n <= 20; n++) {
      const roles = roleList(n, cfg);
      expect(roles).toHaveLength(n);
      const wolves = roles.filter(
        (r) => r === 'werewolf' || r === 'alpha',
      ).length;
      expect(wolves).toBeGreaterThanOrEqual(1);
      expect(wolves * 2).toBeLessThan(n + 1);
      expect(wolves).toBe(Math.max(1, Math.floor(n / 4)));
    }
  });

  it('classic has a Seer and a Doctor and nothing else special', () => {
    const roles = roleList(8, sanitizeWerewolf({ preset: 'classic' }));
    expect(roles.filter((r) => r === 'seer')).toHaveLength(1);
    expect(roles.filter((r) => r === 'doctor')).toHaveLength(1);
    expect(roles.filter((r) => r === 'werewolf')).toHaveLength(2);
    expect(roles.filter((r) => r === 'witch' || r === 'hunter')).toHaveLength(
      0,
    );
    expect(roles.filter((r) => r === 'villager')).toHaveLength(4);
  });

  it('beginner keeps it simple', () => {
    const c = sanitizeWerewolf({ preset: 'beginner' });
    expect(
      roleList(8, c).filter((r) => r !== 'villager' && r !== 'werewolf'),
    ).toEqual(['seer']);
    expect(c.discussionSeconds).toBeGreaterThan(
      sanitizeWerewolf({}).discussionSeconds,
    );
  });

  it('advanced adds the special roles, as room allows', () => {
    const roles = roleList(12, sanitizeWerewolf({ preset: 'advanced' }));
    for (const r of [
      'alpha',
      'seer',
      'doctor',
      'witch',
      'hunter',
      'bodyguard',
      'jester',
      'mayor',
    ]) {
      expect(roles).toContain(r);
    }
    expect(roles).not.toContain('serialkiller');
    expect(roles.filter((r) => r === 'werewolf' || r === 'alpha')).toHaveLength(
      3,
    );
  });

  it('a small table drops what does not fit, and keeps a villager', () => {
    const roles = roleList(5, sanitizeWerewolf({ preset: 'advanced' }));
    expect(roles).toHaveLength(5);
    expect(roles).toContain('villager');
    expect(roles.filter((r) => r === 'werewolf' || r === 'alpha')).toHaveLength(
      1,
    );
  });

  it('custom: the host picks the roles and the number of wolves', () => {
    const c = sanitizeWerewolf({
      preset: 'custom',
      wolves: 3,
      roles: { seer: false, doctor: false, witch: true, hunter: true },
    });
    const roles = roleList(12, c);
    expect(roles.filter((r) => r === 'werewolf')).toHaveLength(3);
    expect(roles).toContain('witch');
    expect(roles).toContain('hunter');
    expect(roles).not.toContain('seer');
    // too many wolves for the table is held back
    expect(
      roleList(5, sanitizeWerewolf({ wolves: 6 })).filter(
        (r) => r === 'werewolf',
      ),
    ).toHaveLength(2);
  });

  it('the optional roles come in together or not at all', () => {
    const on = sanitizeWerewolf({
      variations: true,
      roles: { jester: true, mason: true, serialkiller: true },
    });
    const roles = roleList(12, on);
    expect(roles).toContain('jester');
    expect(roles).toContain('serialkiller');
    expect(roles.filter((r) => r === 'mason')).toHaveLength(2);
    const off = sanitizeWerewolf({
      variations: false,
      roles: { jester: true, mason: true },
    });
    expect(enabled(off, 'jester')).toBe(false);
    expect(roleList(12, off)).not.toContain('jester');
    expect(roleList(12, off)).not.toContain('mason');
  });

  it('clamps the settings', () => {
    const c = sanitizeWerewolf({
      maxPlayers: 99,
      discussionSeconds: 1,
      tieRule: 'nope',
    });
    expect(c.maxPlayers).toBe(20);
    expect(c.discussionSeconds).toBe(15);
    expect(c.tieRule).toBe('none');
    expect(sanitizeWerewolf(null).maxPlayers).toBe(12);
    expect(g.capacity!({ maxPlayers: 8 })).toBe(8);
  });
});

describe('starting', () => {
  it('needs five players', () => {
    expect(errorOf(() => start(4, seeded(1)))?.status).toBe(409);
    expect(start(5, seeded(1)).roles).toHaveLength(5);
  });

  it('deals the roles at random, the same way for the same seed', () => {
    const a = start(10, seeded(5)).roles;
    expect(a).toEqual(start(10, seeded(5)).roles);
    expect(a).not.toEqual(start(10, seeded(6)).roles);
    expect([...a].sort()).toEqual(
      [...roleList(10, sanitizeWerewolf({}))].sort(),
    );
  });

  it('opens on the role reveal, and moves on to night by itself', () => {
    const s = start(6, seeded(1));
    expect(s.phase).toBe('roles');
    expect(g.tick!(s, s.deadline! - 1000, seeded(1))).toBeNull();
    const n = g.tick!(s, s.deadline!, seeded(1))!;
    expect(n.phase).toBe('night');
    expect(n.day).toBe(1);
  });

  it('can skip the reveal when everybody is ready', () => {
    let s = start(5, seeded(1));
    for (let i = 0; i < 5; i++)
      s = g.move(s, i, { type: 'ready' }, seeded(1), { host: 0, now: T0 });
    expect(s.phase).toBe('night');
  });
});

describe('secret information', () => {
  const full = () =>
    night([
      'werewolf',
      'werewolf',
      'seer',
      'doctor',
      'witch',
      'hunter',
      'villager',
      'villager',
    ] as RoleId[]);

  it("shows you your own role and nobody else's", () => {
    const s = full();
    for (let i = 0; i < 8; i++) {
      const v = view(s, i);
      expect(v.me!.role).toBe(s.roles[i]);
      // no other seat's role anywhere in what this player is sent
      const json = JSON.stringify(v);
      expect(v.roster.every((p) => p.role === null)).toBe(true);
      expect(v.reveal).toBeNull();
      for (let j = 0; j < 8; j++) {
        if (j === i) continue;
        expect(json).not.toContain(
          `"seat":${j},"alive":true,"role":"${s.roles[j]}"`,
        );
      }
    }
  });

  it('lets the werewolves know each other, and nobody else', () => {
    const s = full();
    expect(view(s, 0).me!.allies).toEqual([1]);
    expect(view(s, 1).me!.allies).toEqual([0]);
    for (const i of [2, 3, 4, 5, 6, 7])
      expect(view(s, i).me!.allies).toEqual([]);
  });

  it('keeps the night picks to the pack', () => {
    let s = full();
    s = act(s, 0, { target: 6 });
    expect(view(s, 0).me!.night!.packVotes).toEqual({ 0: 6 });
    expect(view(s, 1).me!.night!.packVotes).toEqual({ 0: 6 });
    for (const i of [2, 3, 4, 5, 6, 7]) {
      expect(view(s, i).me!.night?.packVotes ?? {}).toEqual({});
    }
    expect(JSON.stringify(view(s, 2))).not.toContain('"packVotes":{"0":6}');
    expect(view(s, null).me).toBeNull();
  });

  it('keeps what the Seer found to the Seer', () => {
    let s = full();
    s = act(s, 2, { target: 0 });
    expect(view(s, 2).me!.seen).toEqual([{ day: 1, target: 0, wolf: true }]);
    for (const i of [0, 1, 3, 4, 5, 6, 7])
      expect(view(s, i).me!.seen).toEqual([]);
    expect(JSON.stringify(view(s, 3))).not.toContain('"wolf":true');
  });

  it("keeps the Witch's knowledge to the Witch, and only once the pack has chosen", () => {
    let s = full();
    s = act(s, 0, { target: 6 });
    s = act(s, 1, { target: 6 });
    s = act(s, 2, { target: 7 });
    s = act(s, 3, { target: 3 });
    // the first stage is done, the Witch is told
    expect(s.stage).toBe('witch');
    const w = view(s, 4).me!.night!;
    expect(w.victim).toBe(6);
    expect(w.heal && w.poison).toBe(true);
    for (const i of [0, 1, 2, 3, 5, 6, 7])
      expect(view(s, i).me!.night?.victim ?? null).toBeNull();
  });

  it('does not tell the dead who is who, nor let them see the night', () => {
    let s = full();
    s = throughNight(s, [
      [0, { target: 6 }],
      [1, { target: 6 }],
    ]);
    expect(s.alive[6]).toBe(false);
    const dead = view(s, 6);
    expect(dead.me!.alive).toBe(false);
    expect(dead.me!.night).toBeNull();
    expect(
      dead.roster.filter((p) => p.seat !== 6 && p.role !== null),
    ).toHaveLength(0);
    expect(dead.reveal).toBeNull();
  });

  it('shows the roles at the end, and only then', () => {
    const s = night(WOLF);
    expect(view(s, 1).reveal).toBeNull();
    expect(view(s, 1).winner).toBeNull();
    const over = {
      ...s,
      phase: 'over' as const,
      winner: { team: 'village' as const, seats: [1] },
    };
    expect(view(over, 1).reveal!.roles).toEqual(s.roles);
  });
});

describe('the night', () => {
  it('only the roles with a night power can act, and not by day', () => {
    const s = night(
      ['werewolf', 'seer', 'villager', 'hunter', 'mayor'] as RoleId[],
      { variations: true, roles: { mayor: true } },
    );
    expect(errorOf(() => act(s, 2, { target: 0 }))?.message).toMatch(
      /nothing to do/,
    );
    expect(errorOf(() => act(s, 3, { target: 0 }))?.status).toBe(403);
    expect(errorOf(() => act(s, 4, { target: 0 }))?.status).toBe(403);
    const day = { ...s, phase: 'discussion' as const };
    expect(errorOf(() => act(day, 1, { target: 0 }))?.status).toBe(409);
  });

  it('werewolves pick a victim, but not each other', () => {
    const s = night([
      'werewolf',
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    expect(errorOf(() => act(s, 0, { target: 1 }))?.status).toBe(400);
    expect(errorOf(() => act(s, 0, { target: 99 }))?.status).toBe(400);
    expect(errorOf(() => act(s, 0, {}))?.status).toBe(400);
    const done = act(s, 0, { target: 2 });
    expect(done.night.wolf).toEqual({ 0: 2 });
    // and can change their mind until the night ends
    expect(act(done, 0, { target: 3 }).night.wolf).toEqual({ 0: 3 });
  });

  it('the night ends early when everyone has acted, and the victim dies', () => {
    let s = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s = act(s, 0, { target: 2 });
    expect(s.phase).toBe('night');
    s = act(s, 1, { target: 3 });
    expect(s.phase).toBe('morning');
    expect(s.alive[2]).toBe(false);
    expect(s.morning.map((d) => d.seat)).toEqual([2]);
  });

  it('the night ends by itself when time runs out, victim or not', () => {
    const s = night(WOLF);
    const early = tick(s, T0 + s.config.nightSeconds * 1000 - 1);
    expect(early.phase).toBe('night');
    const late = tick(s, T0 + s.config.nightSeconds * 1000);
    expect(late.phase).toBe('morning');
    expect(late.morning).toEqual([]);
    expect(late.alive.every(Boolean)).toBe(true);
  });

  it('the pack goes with the most picks, and a coin toss between equals', () => {
    const roles = [
      'werewolf',
      'werewolf',
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    const s = night(roles);
    const two = act(act(act(s, 0, { target: 3 }), 1, { target: 3 }), 2, {
      target: 4,
    });
    expect(two.phase).toBe('morning');
    expect(two.alive[3]).toBe(false);
    expect(two.alive[4]).toBe(true);
    const tied = night([
      'werewolf',
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    const a = act(act(tied, 0, { target: 3 }), 1, { target: 4 });
    expect(a.phase).toBe('morning');
    expect([a.alive[3], a.alive[4]].filter((x) => !x)).toHaveLength(1);
  });

  it('the dead cannot act, nor anyone twice', () => {
    let s = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s.alive[1] = false;
    expect(errorOf(() => act(s, 1, { target: 0 }))?.status).toBe(403);
    s = night([
      'werewolf',
      'seer',
      'doctor',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s = act(s, 1, { target: 0 });
    expect(errorOf(() => act(s, 1, { target: 2 }))?.message).toMatch(/already/);
  });

  it('works out each night the same way whatever order people act in', () => {
    const roles: RoleId[] = [
      'werewolf',
      'seer',
      'doctor',
      'villager',
      'villager',
      'villager',
    ];
    const order = (list: [number, Record<string, unknown>][]) =>
      throughNight(night(roles), list);
    const acts: [number, Record<string, unknown>][] = [
      [0, { target: 3 }],
      [1, { target: 0 }],
      [2, { target: 3 }],
    ];
    const a = order(acts);
    const b = order([...acts].reverse());
    expect(a.alive).toEqual(b.alive);
    expect(a.alive[3]).toBe(true);
  });
});

describe('the Seer', () => {
  it('learns whether a player is on the werewolf team', () => {
    let s = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s = act(s, 1, { target: 0 });
    expect(s.seen).toEqual([{ seat: 1, day: 1, target: 0, wolf: true }]);
    let t = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    t = act(t, 1, { target: 2 });
    expect(t.seen[0].wolf).toBe(false);
  });

  it('cannot look at themselves, and the Alpha looks innocent unless switched off', () => {
    const roles = [
      'alpha',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    const s = night(roles, { variations: true, roles: { alpha: true } });
    expect(errorOf(() => act(s, 1, { target: 1 }))?.status).toBe(400);
    expect(act(s, 1, { target: 0 }).seen[0].wolf).toBe(false);
    const open = night(roles, {
      variations: true,
      alphaHidden: false,
      roles: { alpha: true },
    });
    expect(act(open, 1, { target: 0 }).seen[0].wolf).toBe(true);
  });

  it('builds up a record over the nights', () => {
    let s = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s = act(s, 1, { target: 2 });
    s = throughNight(s, [[0, { target: 6 }]], T0);
    s = tick(s, T0 + 1_000_000); // morning, discussion, voting...
    expect(view(s, 1).me!.seen).toHaveLength(1);
  });
});

describe('the Doctor and the Bodyguard', () => {
  const roles: RoleId[] = [
    'werewolf',
    'doctor',
    'bodyguard',
    'villager',
    'villager',
    'villager',
  ];

  it("the Doctor's patient survives the werewolves", () => {
    const s = throughNight(night(roles), [
      [0, { target: 3 }],
      [1, { target: 3 }],
    ]);
    expect(s.alive[3]).toBe(true);
    expect(s.morning).toEqual([]);
    expect(s.nightLog[0].saved).toEqual([3]);
  });

  it('can protect themselves, unless that is switched off', () => {
    const s = throughNight(night(roles), [
      [0, { target: 1 }],
      [1, { target: 1 }],
    ]);
    expect(s.alive[1]).toBe(true);
    const off = night(roles, { doctorSelf: false });
    expect(errorOf(() => act(off, 1, { target: 1 }))?.message).toMatch(
      /yourself/,
    );
    expect(view(off, 1).me!.night!.targets).not.toContain(1);
  });

  it('can sit a night out', () => {
    const s = act(night(roles), 1, { target: null });
    expect(s.night.acted[1]).toBe(true);
    expect(s.night.doctor).toBeNull();
  });

  it('the Bodyguard takes the bite instead', () => {
    const s = throughNight(night(roles), [
      [0, { target: 3 }],
      [2, { target: 3 }],
    ]);
    expect(s.alive[3]).toBe(true);
    expect(s.alive[2]).toBe(false);
    expect(s.deaths.map((d) => d.cause)).toEqual(['guard']);
  });

  it('or keeps the target safe without dying, if so set', () => {
    const s = throughNight(night(roles, { bodyguardDies: false }), [
      [0, { target: 3 }],
      [2, { target: 3 }],
    ]);
    expect(s.alive[3] && s.alive[2]).toBe(true);
  });

  it('cannot guard the same player two nights in a row, unless allowed', () => {
    let s = throughNight(night(roles), [[2, { target: 4 }]]);
    expect(s.lastGuard).toBe(4);
    // next night
    s = { ...s, phase: 'discussion' as const };
    const again = { ...tick(s, T0 + 5_000_000) };
    void again;
    const next = night(roles);
    next.lastGuard = 4;
    expect(errorOf(() => act(next, 2, { target: 4 }))?.message).toMatch(
      /two nights/,
    );
    expect(view(next, 2).me!.night!.targets).not.toContain(4);
    const loose = night(roles, { bodyguardRepeat: true });
    loose.lastGuard = 4;
    expect(act(loose, 2, { target: 4 }).night.guard).toBe(4);
    expect(errorOf(() => act(night(roles), 2, { target: 2 }))?.status).toBe(
      400,
    );
  });
});

describe('the Witch', () => {
  const roles: RoleId[] = [
    'werewolf',
    'witch',
    'villager',
    'villager',
    'villager',
    'villager',
  ];

  it('acts after the pack: she cannot act before the first stage is over', () => {
    const s = night(roles);
    expect(errorOf(() => act(s, 1, { heal: true }))?.message).toMatch(
      /werewolves/,
    );
    const w = act(s, 0, { target: 3 });
    expect(w.stage).toBe('witch');
    expect(w.phase).toBe('night');
  });

  it('heals the victim', () => {
    let s = act(night(roles), 0, { target: 3 });
    s = act(s, 1, { heal: true });
    expect(s.phase).toBe('morning');
    expect(s.alive[3]).toBe(true);
    expect(s.witchHeal).toBe(false);
    expect(s.witchPoison).toBe(true);
  });

  it('poisons someone', () => {
    let s = act(night(roles), 0, { target: 3 });
    s = act(s, 1, { poison: 4 });
    expect(s.alive[3]).toBe(false);
    expect(s.alive[4]).toBe(false);
    expect(s.deaths.map((d) => d.cause).sort()).toEqual(['poison', 'wolves']);
    expect(s.witchPoison).toBe(false);
  });

  it('can heal and poison on the same night', () => {
    let s = act(night(roles), 0, { target: 3 });
    s = act(s, 1, { heal: true, poison: 4 });
    expect(s.alive[3]).toBe(true);
    expect(s.alive[4]).toBe(false);
  });

  it('each potion only works once in the game', () => {
    const used = act(act(night(roles), 0, { target: 3 }), 1, {
      heal: true,
      poison: 4,
    });
    expect(used.witchHeal || used.witchPoison).toBe(false);
    const next = night(roles);
    next.witchHeal = false;
    next.witchPoison = false;
    const w = act(next, 0, { target: 3 });
    // no potions left: the night does not wait for her
    expect(w.stage).toBe('main');
    expect(w.phase).toBe('morning');
    const half = night(roles);
    half.witchHeal = false;
    let h = act(half, 0, { target: 3 });
    expect(errorOf(() => act(h, 1, { heal: true }))?.message).toMatch(/used/);
    h = act(h, 1, { poison: 5 });
    expect(h.alive[5]).toBe(false);
  });

  it('can do nothing, and the night moves on', () => {
    let s = act(night(roles), 0, { target: 3 });
    s = act(s, 1, {});
    expect(s.phase).toBe('morning');
    expect(s.alive[3]).toBe(false);
    expect(s.witchHeal && s.witchPoison).toBe(true);
  });

  it('is run out of time: the night ends without her', () => {
    const s = throughNight(night(roles), [[0, { target: 3 }]]);
    expect(s.phase).toBe('morning');
    expect(s.alive[3]).toBe(false);
  });

  it('cannot heal when nobody was attacked, or poison herself', () => {
    const s = tick(night(roles), T0 + 45_001);
    expect(s.stage === 'witch' || s.phase === 'morning').toBe(true);
    const w = night(roles);
    w.night.victim = null;
    w.stage = 'witch';
    expect(errorOf(() => act(w, 1, { heal: true }))?.message).toMatch(/Nobody/);
    expect(errorOf(() => act(w, 1, { poison: 1 }))?.status).toBe(400);
  });
});

describe('the Serial Killer and the Alpha', () => {
  it('the Serial Killer strikes through every protection', () => {
    const roles = [
      'werewolf',
      'doctor',
      'serialkiller',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    const cfg = { variations: true, roles: { serialkiller: true } };
    const s = throughNight(night(roles, cfg), [
      [2, { target: 3 }],
      [1, { target: 3 }],
      [0, { target: 4 }],
    ]);
    expect(s.alive[3]).toBe(false);
    expect(s.alive[4]).toBe(false);
    expect(s.deaths.find((d) => d.seat === 3)!.cause).toBe('serialkiller');
  });

  it('the Alpha may bite twice, once in the whole game', () => {
    const roles = [
      'alpha',
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    const cfg = { variations: true, roles: { alpha: true } };
    let s = night(roles, cfg);
    s = act(s, 0, { target: 2, second: 3 });
    s = act(s, 1, { target: 2 });
    expect(s.phase).toBe('morning');
    expect(s.alive[2]).toBe(false);
    expect(s.alive[3]).toBe(false);
    expect(s.alphaUsed).toBe(true);
    // the next night it is gone
    const again = night(roles, cfg);
    again.alphaUsed = true;
    expect(
      errorOf(() => act(again, 0, { target: 2, second: 3 }))?.message,
    ).toMatch(/already/);
    expect(view(again, 0).me!.night!.secondAvailable).toBe(false);
    // and a plain werewolf cannot
    const plain = night(roles, cfg);
    expect(act(plain, 1, { target: 2, second: 3 }).night.second).toBeNull();
  });
});

describe('the morning and the Hunter', () => {
  it('announces who died, with or without their role', () => {
    const roles = [
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    const s = throughNight(night(roles), [[0, { target: 2 }]]);
    expect(view(s, 3).morning).toEqual([{ seat: 2, role: 'villager' }]);
    const hidden = throughNight(night(roles, { revealRoles: false }), [
      [0, { target: 2 }],
    ]);
    expect(view(hidden, 3).morning).toEqual([{ seat: 2, role: null }]);
    expect(view(hidden, 3).roster.every((p) => p.role === null)).toBe(true);
    // nobody died
    const quiet = throughNight(night(roles), []);
    expect(view(quiet, 3).morning).toEqual([]);
  });

  it('after the morning comes the discussion, with a clock', () => {
    const roles = [
      'werewolf',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = throughNight(night(roles), [[0, { target: 2 }]]);
    expect(s.phase).toBe('morning');
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('discussion');
    expect(view(s, 1).secondsLeft).not.toBeNull();
  });

  const hunterGame = (cfg: Record<string, unknown> = {}) =>
    night(
      [
        'werewolf',
        'werewolf',
        'hunter',
        'villager',
        'villager',
        'villager',
        'villager',
      ] as RoleId[],
      cfg,
    );

  it('a Hunter killed in the night takes someone with them', () => {
    let s = throughNight(hunterGame(), [
      [0, { target: 2 }],
      [1, { target: 2 }],
    ]);
    expect(s.phase).toBe('morning');
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('hunter');
    expect(view(s, 2).hunter).toMatchObject({ seat: 2, isMe: true });
    expect(view(s, 2).hunter!.targets).toContain(0);
    expect(view(s, 3).hunter).toMatchObject({ isMe: false, targets: [] });
    expect(
      errorOf(() =>
        g.move(s, 3, { type: 'hunter', target: 0 }, seeded(1), {
          host: 0,
          now: T0,
        }),
      )?.status,
    ).toBe(403);
    s = g.move(s, 2, { type: 'hunter', target: 0 }, seeded(1), {
      host: 0,
      now: T0,
    });
    expect(s.alive[0]).toBe(false);
    expect(s.deaths.at(-1)!.cause).toBe('hunter');
    expect(s.phase).toBe('discussion');
  });

  it('the shot can be passed up, or the time runs out', () => {
    let s = throughNight(hunterGame(), [
      [0, { target: 2 }],
      [1, { target: 2 }],
    ]);
    s = tick(s, s.deadline!);
    const later = tick(s, s.deadline!);
    expect(later.phase).toBe('discussion');
    expect(later.alive.filter(Boolean)).toHaveLength(6);
    const none = g.move(s, 2, { type: 'hunter', target: null }, seeded(1), {
      host: 0,
      now: T0,
    });
    expect(none.alive.filter(Boolean)).toHaveLength(6);
  });

  it("is not triggered by the Witch's poison, unless switched on", () => {
    const roles = [
      'werewolf',
      'witch',
      'hunter',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = act(night(roles), 0, { target: 3 });
    s = act(s, 1, { poison: 2 });
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('discussion');
    let t = act(night(roles, { hunterOnPoison: true }), 0, { target: 3 });
    t = act(t, 1, { poison: 2 });
    t = tick(t, t.deadline!);
    expect(t.phase).toBe('hunter');
  });

  it('can end the game with the shot', () => {
    const roles = [
      'werewolf',
      'hunter',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = throughNight(night(roles), [[0, { target: 1 }]]);
    s = tick(s, s.deadline!);
    s = g.move(s, 1, { type: 'hunter', target: 0 }, seeded(1), {
      host: 0,
      now: T0,
    });
    expect(s.phase).toBe('over');
    expect(s.winner!.team).toBe('village');
  });
});

describe('the discussion and the vote', () => {
  const day = (
    roles: RoleId[] = [
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ],
    cfg: Record<string, unknown> = {},
  ) => {
    const s = night(roles, cfg);
    const d = tick(tick(s, T0 + 100_000), T0 + 200_000); // night, morning
    const out: WerewolfState = {
      ...d,
      phase: 'discussion',
      deadline: T0 + 300_000,
    };
    return out;
  };
  const voting = (roles?: RoleId[], cfg?: Record<string, unknown>) =>
    tick(day(roles, cfg), T0 + 300_000);

  it('moves from discussion to voting when the time is up, or everyone is ready', () => {
    const s = day();
    expect(tick(s, T0 + 299_999).phase).toBe('discussion');
    expect(tick(s, T0 + 300_000).phase).toBe('voting');
    let r = s;
    for (let i = 0; i < 6; i++)
      r = g.move(r, i, { type: 'ready' }, seeded(1), { host: 0, now: T0 });
    expect(r.phase).toBe('voting');
  });

  it('only the living vote, for the living, and not for themselves', () => {
    let s = voting();
    s.alive[5] = false;
    expect(errorOf(() => vote(s, 5, 0))?.status).toBe(403);
    expect(errorOf(() => vote(s, 0, 5))?.status).toBe(400);
    expect(errorOf(() => vote(s, 0, 0))?.message).toMatch(/yourself/);
    expect(errorOf(() => vote(s, 0, 99))?.status).toBe(400);
    s = vote(s, 0, 2);
    expect(s.votes).toEqual({ 0: 2 });
    expect(
      errorOf(() =>
        g.move(day(), 0, { type: 'vote', target: 1 }, seeded(1), {
          host: 0,
          now: T0,
        }),
      )?.status,
    ).toBe(409);
  });

  it('eliminates the player with the most votes', () => {
    let s = voting();
    for (const v of [0, 1, 3, 4]) s = vote(s, v, 2);
    s = vote(s, 2, 0);
    s = vote(s, 5, null);
    s = tick(s, T0 + 1_000_000);
    expect(s.alive[2]).toBe(false);
    expect(s.phase).toBe('result');
    expect(s.lastVote).toMatchObject({ eliminated: 2, tie: false });
    expect(s.lastVote!.tally).toEqual({ 2: 4, 0: 1 });
  });

  it('can change a vote while the clock runs, if allowed', () => {
    let s = voting();
    s = vote(s, 0, 2);
    s = vote(s, 0, 3);
    expect(s.votes[0]).toBe(3);
    let locked = voting(undefined, { voteChange: false });
    locked = vote(locked, 0, 2);
    expect(errorOf(() => vote(locked, 0, 3))?.message).toMatch(
      /cannot be changed/,
    );
  });

  it('ends early once everyone has voted, after a moment to think', () => {
    let s = voting();
    for (let i = 0; i < 6; i++) s = vote(s, i, (i + 1) % 6, T0 + 1000);
    expect(s.deadline).toBe(T0 + 1000 + TIMES.grace * 1000);
    expect(tick(s, T0 + 1000 + TIMES.grace * 1000 - 1).phase).toBe('voting');
    expect(tick(s, T0 + 1000 + TIMES.grace * 1000).phase).toBe('result');
    let strict = voting(undefined, { voteChange: false });
    for (let i = 0; i < 6; i++)
      strict = vote(strict, i, (i + 1) % 6, T0 + 1000);
    expect(strict.phase).toBe('result');
  });

  it('nobody is eliminated when nobody votes, or on a tie by default', () => {
    expect(tick(voting(), T0 + 1_000_000).lastVote!.eliminated).toBeNull();
    let s = voting();
    s = vote(vote(vote(vote(s, 0, 2), 1, 2), 2, 3), 4, 3);
    s = tick(s, T0 + 1_000_000);
    expect(s.lastVote).toMatchObject({ eliminated: null, tie: true });
    expect(s.alive.every(Boolean)).toBe(true);
  });

  it('can settle a tie by chance', () => {
    let s = voting(undefined, { tieRule: 'random' });
    s = vote(vote(vote(vote(s, 0, 2), 1, 2), 2, 3), 4, 3);
    s = tick(s, T0 + 1_000_000);
    expect([2, 3]).toContain(s.lastVote!.eliminated);
  });

  it('or send the tied players to a second vote, and only those', () => {
    let s = voting(undefined, { tieRule: 'revote' });
    s = vote(vote(vote(vote(s, 0, 2), 1, 2), 2, 3), 4, 3);
    s = tick(s, T0 + 1_000_000);
    expect(s.phase).toBe('voting');
    expect(s.round).toBe(2);
    expect(s.candidates!.sort()).toEqual([2, 3]);
    expect(view(s, 0).vote!.candidates.sort()).toEqual([2, 3]);
    expect(errorOf(() => vote(s, 0, 4))?.message).toMatch(/tied/);
    s = vote(vote(vote(s, 0, 2), 1, 2), 4, 3);
    s = tick(s, T0 + 2_000_000);
    expect(s.alive[2]).toBe(false);
    // still tied after the revote: nobody
    let t = voting(undefined, { tieRule: 'revote' });
    t = vote(vote(vote(vote(t, 0, 2), 1, 2), 2, 3), 4, 3);
    t = tick(t, T0 + 1_000_000);
    t = vote(vote(t, 0, 2), 1, 3);
    t = tick(t, T0 + 2_000_000);
    expect(t.lastVote!.eliminated).toBeNull();
    expect(t.alive.every(Boolean)).toBe(true);
  });

  it("the Mayor's vote counts twice", () => {
    const roles = [
      'werewolf',
      'mayor',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = voting(roles, { variations: true, roles: { mayor: true } });
    s = vote(s, 1, 2); // the Mayor: 2
    s = vote(s, 3, 4);
    s = tick(s, T0 + 1_000_000);
    expect(s.lastVote!.tally).toEqual({ 2: 2, 4: 1 });
    expect(s.alive[2]).toBe(false);
  });

  it('shows who voted for whom, or only how many have voted when anonymous', () => {
    let pub = voting();
    pub = vote(vote(pub, 0, 2), 1, 2);
    expect(view(pub, 3).vote!.open).toEqual({ 0: 2, 1: 2 });
    let anon = voting(undefined, { anonymousVoting: true });
    anon = vote(vote(anon, 0, 2), 1, 2);
    const v = view(anon, 3).vote!;
    expect(v.open).toBeNull();
    expect(v.voted).toBe(2);
    expect(v.mine).toBeUndefined();
    expect(view(anon, 0).vote!.mine).toBe(2);
    expect(JSON.stringify(view(anon, 3))).not.toContain('"open":{');
    // after the result, an anonymous game shows only the count
    const done = tick(anon, T0 + 1_000_000);
    expect(view(done, 3).lastVote!.votes).toBeNull();
    expect(view(done, 3).lastVote!.tally).toEqual({ 2: 2 });
  });

  it("shows the eliminated player's role, or not", () => {
    let s = voting();
    for (const v of [0, 1, 3]) s = vote(s, v, 2);
    s = tick(s, T0 + 1_000_000);
    expect(view(s, 0).lastVote!.role).toBe('villager');
    let hidden = voting(undefined, { revealRoles: false });
    for (const v of [0, 1, 3]) hidden = vote(hidden, v, 2);
    hidden = tick(hidden, T0 + 1_000_000);
    expect(view(hidden, 0).lastVote!.role).toBeNull();
  });

  it('after the result the night comes round again', () => {
    let s = voting();
    for (const v of [0, 1, 3]) s = vote(s, v, 2);
    s = tick(s, T0 + 1_000_000);
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('night');
    expect(s.day).toBe(2);
    expect(s.night.acted).toEqual({});
  });

  it('a Hunter voted out takes a last shot', () => {
    const roles = [
      'werewolf',
      'hunter',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = voting(roles);
    for (const v of [0, 2, 3, 4]) s = vote(s, v, 1);
    s = tick(s, T0 + 1_000_000);
    s = tick(s, s.deadline!);
    expect(s.phase).toBe('hunter');
    s = g.move(s, 1, { type: 'hunter', target: 0 }, seeded(1), {
      host: 0,
      now: T0,
    });
    expect(s.phase).toBe('over');
    expect(s.winner!.team).toBe('village');
  });

  it('the Jester wins alone when voted out', () => {
    const roles = [
      'werewolf',
      'jester',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    let s = voting(roles, { variations: true, roles: { jester: true } });
    for (const v of [0, 2, 3, 4]) s = vote(s, v, 1);
    s = tick(s, T0 + 1_000_000);
    expect(s.phase).toBe('over');
    expect(s.winner).toEqual({ team: 'jester', seats: [1] });
  });
});

describe('who wins', () => {
  const state = (roles: RoleId[], alive: boolean[]) => {
    const s = start(roles.length, seeded(1));
    s.roles = roles;
    s.alive = alive;
    return s;
  };

  it('the village, when the last werewolf is gone', () => {
    const w = checkWinner(
      state(
        ['werewolf', 'villager', 'seer', 'villager', 'villager'],
        [false, true, true, true, true],
      ),
    )!;
    expect(w.team).toBe('village');
    expect(w.seats).toEqual([1, 2, 3, 4]);
  });

  it('the werewolves, when they equal the rest', () => {
    expect(
      checkWinner(
        state(
          ['werewolf', 'villager', 'villager', 'villager', 'villager'],
          [true, true, false, false, false],
        ),
      )!.team,
    ).toBe('wolves');
    expect(
      checkWinner(
        state(
          ['werewolf', 'villager', 'villager', 'villager', 'villager'],
          [true, true, true, false, false],
        ),
      ),
    ).toBeNull();
    expect(
      checkWinner(
        state(
          ['werewolf', 'werewolf', 'villager', 'villager', 'villager'],
          [true, true, true, true, true],
        ),
      ),
    ).toBeNull();
    expect(
      checkWinner(
        state(
          ['werewolf', 'werewolf', 'villager', 'villager', 'villager'],
          [true, true, true, false, false],
        ),
      )!.team,
    ).toBe('wolves');
  });

  it('the Serial Killer, last against one', () => {
    const roles = [
      'werewolf',
      'serialkiller',
      'villager',
      'villager',
      'villager',
    ] as RoleId[];
    expect(
      checkWinner(state(roles, [false, true, true, false, false]))!.team,
    ).toBe('serialkiller');
    expect(
      checkWinner(state(roles, [false, true, true, true, false])),
    ).toBeNull();
    // the village has not won while a killer lives
    expect(
      checkWinner(state(roles, [false, true, true, true, true])),
    ).toBeNull();
  });

  it('ends the game and shows everything', () => {
    let s = throughNight(
      night([
        'werewolf',
        'villager',
        'villager',
        'villager',
        'villager',
      ] as RoleId[]),
      [[0, { target: 1 }]],
    );
    s.alive = [true, false, false, true, false];
    s = tick({ ...s, phase: 'morning', deadline: T0 }, T0);
    expect(s.phase).toBe('over');
    expect(s.winner!.team).toBe('wolves');
    expect(g.isOver(s)).toBe(true);
    const v = view(s, 3);
    expect(v.reveal!.roles).toEqual(s.roles);
    expect(v.roster.every((p) => p.role !== null)).toBe(true);
    expect(v.reveal!.nights).toHaveLength(1);
    expect(v.winner!.team).toBe('wolves');
    expect(errorOf(() => act(s, 0, { target: 3 }))?.status).toBe(409);
  });
});

describe('players leaving', () => {
  it('a player who leaves is out, and the game can end on it', () => {
    let s = night(WOLF);
    s = g.eliminate!(s, 4)!;
    expect(s.alive[4]).toBe(false);
    expect(s.deaths.at(-1)!.cause).toBe('left');
    s = g.eliminate!(s, 3)!;
    s = g.eliminate!(s, 2)!;
    expect(s.phase).toBe('over');
    expect(s.winner!.team).toBe('wolves');
    // twice is harmless
    expect(g.eliminate!(s, 2)).toBe(s);
  });

  it('a player who leaves mid-night does not hold it up', () => {
    let s = night([
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
      'villager',
    ] as RoleId[]);
    s = act(s, 0, { target: 2 });
    s = g.eliminate!(s, 1)!;
    expect(tick(s, T0 + 1).phase).toBe('morning');
  });

  it('the Hunter who leaves does not get a shot', () => {
    const s = g.eliminate!(
      night([
        'werewolf',
        'hunter',
        'villager',
        'villager',
        'villager',
        'villager',
      ] as RoleId[]),
      1,
    )!;
    expect(s.hunter).toBeNull();
  });
});

describe('chat', () => {
  const s = night([
    'werewolf',
    'werewolf',
    'seer',
    'doctor',
    'villager',
    'villager',
  ] as RoleId[]);

  it('at night only the werewolves talk, privately', () => {
    expect(g.chat!(s, 0)).toEqual({ send: 'wolves', read: ['all', 'wolves'] });
    expect(g.chat!(s, 2)).toEqual({ send: null, read: ['all'] });
    expect(g.chat!(s, null)).toEqual({ send: null, read: ['all'] });
  });

  it('by day the living talk to everyone, and the pack can still read its own chat', () => {
    const d = { ...s, phase: 'discussion' as const };
    expect(g.chat!(d, 2)).toEqual({ send: 'all', read: ['all'] });
    expect(g.chat!(d, 0)).toEqual({ send: 'all', read: ['all', 'wolves'] });
  });

  it('the dead have a chat of their own and cannot talk to the living', () => {
    const dead = {
      ...s,
      phase: 'discussion' as const,
      alive: [true, true, false, true, true, true],
    };
    expect(g.chat!(dead, 2)).toEqual({ send: 'dead', read: ['all', 'dead'] });
    const off = { ...dead, config: { ...dead.config, deadChat: false } };
    expect(g.chat!(off, 2)).toEqual({ send: null, read: ['all', 'dead'] });
  });

  it('the role reveal is quiet, and everyone talks once it is over', () => {
    expect(g.chat!(start(5, seeded(1)), 0).send).toBeNull();
    const over = { ...s, phase: 'over' as const };
    expect(g.chat!(over, 4)).toEqual({
      send: 'all',
      read: ['all', 'wolves', 'dead'],
    });
  });
});

describe('a whole game', () => {
  it('plays out on its own clock, every night and day, with nobody lost', () => {
    for (const seed of [1, 2, 3, 4]) {
      const rng = seeded(seed);
      let s = start(9, rng, { preset: 'advanced' });
      let now = T0;
      let guard = 0;
      while (s.phase !== 'over' && guard++ < 400) {
        // players do what they can; otherwise the clock does it
        if (s.phase === 'night' && s.stage === 'main') {
          const wolf = s.roles.findIndex(
            (r, i) => (r === 'werewolf' || r === 'alpha') && s.alive[i],
          );
          const target = s.roles.findIndex(
            (r, i) => s.alive[i] && r !== 'werewolf' && r !== 'alpha',
          );
          if (wolf !== -1 && target !== -1)
            s = g.move(s, wolf, { type: 'night', target }, rng, {
              host: 0,
              now,
            });
        }
        if (s.phase === 'voting') {
          const wolves = s.roles
            .map((r, i) =>
              s.alive[i] && (r === 'werewolf' || r === 'alpha') ? i : -1,
            )
            .filter((i) => i >= 0);
          for (let i = 0; i < 9; i++) {
            if (
              s.alive[i] &&
              s.phase === 'voting' &&
              wolves[0] !== undefined &&
              i !== wolves[0]
            ) {
              s = g.move(s, i, { type: 'vote', target: wolves[0] }, rng, {
                host: 0,
                now,
              });
            }
          }
        }
        now = (s.deadline ?? now) + 1;
        s = tick(s, now);
        expect(s.alive.filter(Boolean).length).toBeGreaterThan(0);
      }
      expect(s.phase).toBe('over');
      expect(s.winner).not.toBeNull();
      expect(s.nightLog.length).toBeGreaterThan(0);
    }
  });
});
