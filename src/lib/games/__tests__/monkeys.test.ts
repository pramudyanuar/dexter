/**
 * @jest-environment node
 */
import {
  flashAnswer,
  GESTURE_GAP_MS,
  mathAnswer,
  Mod,
  monkeysGame as g,
  MonkeyState,
  SHIFT,
  wireAt,
} from '@/lib/games/monkeys';
import {
  DEFAULT_MONKEYS,
  MonkeyConfig,
  Role,
} from '@/lib/games/monkeys-config';

const seeded = (seed = 7) => {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const cfg = (patch: Partial<MonkeyConfig> = {}): MonkeyConfig => ({
  ...DEFAULT_MONKEYS,
  roles: 'host',
  assign: ['blind', 'mute', 'deaf'],
  ...patch,
});

const T0 = 1_000_000;
const BLIND = 0;
const MUTE = 1;
const DEAF = 2;

function begun(patch: Partial<MonkeyConfig> = {}, seed = 3): MonkeyState {
  let s = g.start(3, seeded(seed), cfg(patch));
  for (const seat of [0, 1, 2])
    s = g.move(s, seat, { t: 'ready' }, seeded(), { host: 0, now: T0 });
  return s;
}
const play = (s: MonkeyState, seat: number, move: unknown, now = T0 + 1000) =>
  g.move(s, seat, move, seeded(9), { host: 0, now });

/** The right moves for a module, read from the server state (a cheat sheet for tests) */
function solveMoves(m: Mod): unknown[] {
  const chosen = <T>(plan: [T, T]) =>
    m.variant && !m.lamp ? plan[1] : plan[0];
  switch (m.kind) {
    case 'wires':
      return chosen(m.plan).map((gest) => ({
        t: 'act',
        m: m.id,
        a: 'cut',
        i: wireAt(gest, m.cut.length),
      }));
    case 'keypad':
      return chosen(m.plan).map((gest) => ({
        t: 'act',
        m: m.id,
        a: 'press',
        i: m.labels.indexOf(['one', 'two', 'three'].indexOf(gest) + 1),
      }));
    case 'knobs':
      return [
        ...chosen(m.plan).map((dir, i) => ({
          t: 'act',
          m: m.id,
          a: 'turn',
          i,
          dir,
        })),
        { t: 'act', m: m.id, a: 'lock' },
      ];
    case 'math':
      return [
        ...String(mathAnswer(m))
          .split('')
          .map((d) => ({ t: 'act', m: m.id, a: 'digit', d: Number(d) })),
        { t: 'act', m: m.id, a: 'enter' },
      ];
    case 'flash':
      return flashAnswer(m).map((i) => ({ t: 'act', m: m.id, a: 'pad', i }));
  }
}

function defuse(s: MonkeyState, now = T0 + 2000): MonkeyState {
  let state = s;
  for (const m of s.modules)
    for (const mv of solveMoves(m)) state = play(state, BLIND, mv, now);
  return state;
}

describe('starting', () => {
  it('only plays with exactly three', () => {
    expect(() => g.start(2, seeded(), cfg())).toThrow();
    expect(() => g.start(4, seeded(), cfg())).toThrow();
    expect(g.capacity?.(null)).toBe(3);
    expect(g.minPlayers).toBe(3);
    expect(g.maxPlayers).toBe(3);
  });

  it('deals each role once, at random', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const s = g.start(3, seeded(seed), { ...cfg(), roles: 'random' });
      expect([...s.roles].sort()).toEqual(['blind', 'deaf', 'mute']);
      seen.add(s.roles.join());
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('lets the host choose the roles', () => {
    const s = g.start(3, seeded(), cfg({ assign: ['deaf', 'blind', 'mute'] }));
    expect(s.roles).toEqual(['deaf', 'blind', 'mute']);
  });

  it('refuses bad role lists from the host', () => {
    const s = g.sanitizeOptions?.({
      roles: 'host',
      assign: ['blind', 'blind', 'mute'],
    });
    expect((s as MonkeyConfig).assign).toEqual(['blind', 'mute', 'deaf']);
  });

  it('starts the clock only when all three are ready', () => {
    let s = g.start(3, seeded(), cfg());
    expect(s.phase).toBe('briefing');
    s = g.move(s, 0, { t: 'ready' }, seeded(), { host: 0, now: T0 });
    s = g.move(s, 1, { t: 'ready' }, seeded(), { host: 0, now: T0 });
    expect(s.phase).toBe('briefing');
    expect(s.endsAt).toBe(0);
    s = g.move(s, 2, { t: 'ready' }, seeded(), { host: 0, now: T0 });
    expect(s.phase).toBe('playing');
    expect(s.endsAt).toBe(T0 + s.spec.seconds * 1000);
  });

  it('does not allow acting during the briefing', () => {
    const s = g.start(3, seeded(), cfg());
    expect(() =>
      g.move(s, 0, { t: 'act', m: 0, a: 'cut', i: 0 }, seeded(), {
        host: 0,
        now: T0,
      }),
    ).toThrow();
  });
});

describe('what each monkey sees', () => {
  const s = begun({
    mode: 'custom',
    custom: { ...DEFAULT_MONKEYS.custom, difficulty: 3, modules: 5 },
  });
  const views = {
    blind: JSON.stringify(g.view(s, BLIND, { host: 0, now: T0 })),
    mute: JSON.stringify(g.view(s, MUTE, { host: 0, now: T0 })),
    deaf: JSON.stringify(g.view(s, DEAF, { host: 0, now: T0 })),
    nobody: JSON.stringify(g.view(s, null, { host: 0, now: T0 })),
  };

  it('keeps the manual from everyone but the Mute Monkey', () => {
    expect(views.mute).toContain('"manual"');
    for (const other of ['blind', 'deaf', 'nobody'] as const) {
      expect(views[other]).not.toContain('"manual"');
      expect(views[other]).not.toContain('"plan"');
      expect(views[other]).not.toContain('"lit"');
    }
  });

  it('shows the Blind Monkey no colours, labels, sums or lamps', () => {
    for (const secret of [
      'colors',
      'labels',
      '"lamp"',
      '"a":',
      '"op"',
      'red',
      'purple',
    ]) {
      expect(views.blind).not.toContain(secret);
    }
    expect(views.blind).toContain('"blind":[');
  });

  it('shows the Deaf Monkey the colourful bomb but no manual', () => {
    expect(views.deaf).toContain('"deaf":[');
    expect(views.deaf).not.toContain('"manual"');
    expect(views.deaf).not.toContain('"offset"');
    expect(views.deaf).not.toContain('"plan"');
  });

  it('never shows the Mute Monkey the bomb itself', () => {
    expect(views.mute).not.toContain('"colors"');
    expect(views.mute).not.toContain('"labels"');
    expect(views.mute).not.toContain('"dirs"');
    expect(views.mute).not.toContain('"entry"');
    expect(views.mute).not.toContain('"cut"');
    expect(views.mute).not.toContain('"blind":[');
    expect(views.mute).not.toContain('"deaf":[');
  });

  it('does not tell the Deaf Monkey the lamp of a module the lamp does not matter for', () => {
    const v = g.view(s, DEAF, { host: 0, now: T0 }) as {
      deaf: { lamp: boolean | null; id: number }[];
    };
    v.deaf.forEach((m) => {
      const real = s.modules[m.id];
      expect(m.lamp).toBe(
        real.variant && real.kind !== 'math' ? real.lamp : null,
      );
    });
  });
});

describe('gestures', () => {
  it('lets only the Mute Monkey gesture, and shows it to the Deaf Monkey', () => {
    const s = begun();
    expect(() => play(s, BLIND, { t: 'gesture', g: 'yes' })).toThrow();
    expect(() => play(s, DEAF, { t: 'gesture', g: 'yes' })).toThrow();
    const next = play(s, MUTE, { t: 'gesture', g: 'one' });
    const deaf = g.view(next, DEAF, { host: 0, now: T0 }) as {
      signs: { g: string }[];
    };
    const mute = g.view(next, MUTE, { host: 0, now: T0 }) as {
      signs: { g: string }[];
    };
    const blind = g.view(next, BLIND, { host: 0, now: T0 }) as {
      signs: unknown[];
    };
    expect(deaf.signs.map((x) => x.g)).toEqual(['one']);
    expect(mute.signs.map((x) => x.g)).toEqual(['one']);
    expect(blind.signs).toEqual([]);
  });

  it('refuses gestures that are not on the wheel and spamming', () => {
    const s = begun();
    expect(() => play(s, MUTE, { t: 'gesture', g: 'hello' })).toThrow();
    const a = play(s, MUTE, { t: 'gesture', g: 'one' }, T0 + 1000);
    expect(() =>
      play(a, MUTE, { t: 'gesture', g: 'two' }, T0 + 1000 + GESTURE_GAP_MS - 1),
    ).toThrow();
    expect(() =>
      play(a, MUTE, { t: 'gesture', g: 'two' }, T0 + 1000 + GESTURE_GAP_MS),
    ).not.toThrow();
  });

  it('numbers them so a client can tell a new one from an old one', () => {
    let s = begun();
    s = play(s, MUTE, { t: 'gesture', g: 'one' }, T0 + 1000);
    s = play(s, MUTE, { t: 'gesture', g: 'one' }, T0 + 2000);
    expect(s.signs.map((x) => x.seq)).toEqual([1, 2]);
  });
});

describe('the bomb', () => {
  it('only the Blind Monkey can touch it', () => {
    const s = begun();
    const mv = { t: 'act', m: 0, a: 'cut', i: 0 };
    expect(() => play(s, MUTE, mv)).toThrow();
    expect(() => play(s, DEAF, mv)).toThrow();
  });

  it('is defused when every module is solved, by the right moves', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = begun(
        {
          mode: 'custom',
          custom: { ...DEFAULT_MONKEYS.custom, modules: 5, difficulty: 3 },
        },
        seed,
      );
      const done = defuse(s);
      expect(done.phase).toBe('won');
      expect(done.mistakes).toBe(0);
      expect(g.isOver(done)).toBe(true);
    }
  });

  it('makes every kind of module solvable at every difficulty', () => {
    for (const difficulty of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 25; seed++) {
        const s = begun(
          {
            mode: 'custom',
            custom: { ...DEFAULT_MONKEYS.custom, modules: 5, difficulty },
          },
          seed,
        );
        expect(new Set(s.modules.map((m) => m.kind)).size).toBe(5);
        expect(defuse(s).phase).toBe('won');
      }
    }
  });

  it('counts a mistake, takes time off, and carries on', () => {
    const s = begun();
    const m = s.modules.find((x) => x.kind === 'wires') as Extract<
      Mod,
      { kind: 'wires' }
    >;
    const wrong = m.cut.findIndex(
      (_, i) =>
        i !==
        wireAt((m.variant && !m.lamp ? m.plan[1] : m.plan[0])[0], m.cut.length),
    );
    const next = play(s, BLIND, { t: 'act', m: m.id, a: 'cut', i: wrong });
    expect(next.mistakes).toBe(1);
    expect(next.endsAt).toBe(s.endsAt - s.spec.penalty * 1000);
    expect(next.phase).toBe('playing');
    expect(next.event?.kind).toBe('bad');
  });

  it('explodes on one mistake too many', () => {
    let s = begun({
      mode: 'custom',
      custom: {
        ...DEFAULT_MONKEYS.custom,
        mistakes: 1,
        kinds: ['keypad'],
        modules: 3,
        difficulty: 1,
      },
    });
    const m = s.modules[0] as Extract<Mod, { kind: 'keypad' }>;
    const want = m.labels.indexOf(
      ['one', 'two', 'three'].indexOf(m.plan[0][0]) + 1,
    );
    const wrong = (want + 1) % 3;
    s = play(s, BLIND, { t: 'act', m: 0, a: 'press', i: wrong });
    expect(s.phase).toBe('playing');
    s = play(s, BLIND, { t: 'act', m: 0, a: 'press', i: wrong });
    expect(s.phase).toBe('exploded');
    expect(s.cause).toBe('mistakes');
    expect(g.isOver(s)).toBe(true);
    expect(() =>
      play(s, BLIND, { t: 'act', m: 0, a: 'press', i: 0 }),
    ).toThrow();
  });

  it('rejects touching a solved module or something that is not there', () => {
    const s = begun();
    expect(() => play(s, BLIND, { t: 'act', m: 99, a: 'cut', i: 0 })).toThrow();
    const wires = s.modules.find((x) => x.kind === 'wires');
    if (wires)
      expect(() =>
        play(s, BLIND, { t: 'act', m: wires.id, a: 'cut', i: 99 }),
      ).toThrow();
  });

  it('shifts a flash by the manual', () => {
    const s = begun({
      mode: 'custom',
      custom: {
        ...DEFAULT_MONKEYS.custom,
        kinds: ['flash'],
        modules: 3,
        difficulty: 1,
      },
    });
    const m = s.modules[0] as Extract<Mod, { kind: 'flash' }>;
    const shift = SHIFT[m.plan[0]] ?? 0;
    expect(flashAnswer(m)).toEqual(m.seq.map((p) => (p + shift) % 4));
  });
});

describe('the clock', () => {
  it('blows the bomb at zero, on the server', () => {
    const s = begun();
    expect(g.tick?.(s, s.endsAt - 1, undefined, [])).toBeNull();
    const boom = g.tick?.(s, s.endsAt, undefined, []);
    expect(boom?.phase).toBe('exploded');
    expect(boom?.cause).toBe('time');
  });

  it('counts down in the view', () => {
    const s = begun();
    const v = g.view(s, MUTE, { host: 0, now: T0 + 10_000 }) as {
      remaining: number;
    };
    expect(v.remaining).toBe(s.spec.seconds * 1000 - 10_000);
  });

  it('stands still while a monkey is away, and carries on when they are back', () => {
    const s = begun();
    const paused = g.tick?.(s, T0 + 5000, undefined, [1]) as MonkeyState;
    expect(paused.pausedAt).toBe(T0 + 5000);
    // nothing to do while still away, and no explosion however long it lasts
    expect(g.tick?.(paused, T0 + 99_999_999, undefined, [1])).toBeNull();
    expect(() =>
      play(paused, BLIND, { t: 'act', m: 0, a: 'cut', i: 0 }),
    ).toThrow();
    const v = g.view(paused, DEAF, { host: 0, now: T0 + 60_000 }) as {
      remaining: number;
      paused: boolean;
    };
    expect(v.paused).toBe(true);
    expect(v.remaining).toBe(s.endsAt - (T0 + 5000));
    const back = g.tick?.(paused, T0 + 25_000, undefined, []) as MonkeyState;
    expect(back.pausedAt).toBeNull();
    expect(back.endsAt).toBe(s.endsAt + 20_000);
  });

  it('abandons the bomb when a monkey is taken out for good', () => {
    const s = g.eliminate?.(begun(), 1) as MonkeyState;
    expect(s.phase).toBe('abandoned');
    expect(g.isOver(s)).toBe(true);
    expect(g.voice?.(s, DEAF)).toBeNull();
  });
});

describe('voice', () => {
  const s = begun();
  it('connects the Deaf Monkey (sending) to the Blind Monkey (receiving) only', () => {
    expect(g.voice?.(s, DEAF)).toEqual({ peer: BLIND, dir: 'send' });
    expect(g.voice?.(s, BLIND)).toEqual({ peer: DEAF, dir: 'receive' });
    expect(g.voice?.(s, MUTE)).toBeNull();
  });
  it('follows the roles when they are shuffled', () => {
    const t = g.start(3, seeded(), cfg({ assign: ['mute', 'deaf', 'blind'] }));
    expect(g.voice?.(t, 1)).toEqual({ peer: 2, dir: 'send' });
    expect(g.voice?.(t, 2)).toEqual({ peer: 1, dir: 'receive' });
    expect(g.voice?.(t, 0)).toBeNull();
  });
});

describe('chat', () => {
  it('is closed while the bomb is live and open afterwards', () => {
    const s = begun();
    expect(g.chat?.(s, 0)).toEqual({ send: null, read: [] });
    expect(g.chat?.(defuse(s), 0)).toEqual({ send: 'all', read: ['all'] });
  });
});

describe('campaign, endless and rematch', () => {
  it('has ten levels and opens the next one after a win', () => {
    const s = defuse(begun({ mode: 'campaign', level: 3 }));
    expect(s.phase).toBe('won');
    expect(g.restart(s, 3, seeded()).config.level).toBe(4);
  });

  it('replays the same level after an explosion and stops at the last', () => {
    const boom = {
      ...begun({ mode: 'campaign', level: 3 }),
      phase: 'exploded' as const,
    };
    expect(g.restart(boom, 3, seeded()).config.level).toBe(3);
    const last = {
      ...begun({ mode: 'campaign', level: 10 }),
      phase: 'won' as const,
    };
    expect(g.restart(last, 3, seeded()).config.level).toBe(10);
  });

  it('keeps going in endless mode with a fresh, harder bomb', () => {
    const first = begun({ mode: 'endless' }, 4);
    const next = defuse(first);
    expect(next.phase).toBe('playing');
    expect(next.defused).toBe(1);
    expect(next.bomb).toBe(1);
    expect(next.modules.every((m) => !m.solved)).toBe(true);
    expect(next.event?.kind).toBe('next');
  });

  it('makes endless bombs shorter and harder as it goes', () => {
    let s = begun({ mode: 'endless' }, 5);
    const seconds: number[] = [s.spec.seconds];
    for (let i = 0; i < 4; i++) {
      s = defuse(s, T0 + 2000 + i);
      seconds.push(s.spec.seconds);
    }
    expect(seconds[4]).toBeLessThan(seconds[0]);
    expect(s.spec.difficulty).toBeGreaterThan(1);
  });

  it('practice mode is forgiving', () => {
    const s = begun({ mode: 'practice' });
    expect(s.spec.mistakes).toBeGreaterThan(5);
    expect(s.spec.penalty).toBe(0);
  });

  it('keeps custom settings in range', () => {
    const c = g.sanitizeOptions?.({
      mode: 'custom',
      custom: {
        seconds: 5,
        modules: 99,
        difficulty: 9,
        mistakes: -1,
        kinds: ['nope'],
      },
    }) as MonkeyConfig;
    expect(c.custom.seconds).toBe(60);
    expect(c.custom.modules).toBe(5);
    expect(c.custom.difficulty).toBe(3);
    expect(c.custom.mistakes).toBe(1);
    expect(c.custom.kinds.length).toBe(5);
  });
});

describe('roles are real', () => {
  it('uses each role exactly once', () => {
    const s = begun();
    const roles: Role[] = s.roles;
    expect(new Set(roles).size).toBe(3);
  });
});
