export interface GameConfig {
  room: {
    /** 0 = pakai bawaan tiap game, 10-300 = timpa batas waktu giliran (detik) */
    turnSeconds: number;
    maxStrikes: number;
    leaveGraceSeconds: number;
  };
  unomercy: {
    mercyLimit: number;
    handSize: number;
  };
  unoflip: {
    handSize: number;
  };
  uno: {
    handSize: number;
  };
  domino: {
    handSize: number;
  };
  remo: {
    mode: 'classic' | 'point' | 'quick' | 'joker';
    handSize: number;
    jokers: number;
    jokerLimit: number;
    initialMeld: number;
    finish: 'discard' | 'melded';
    turnSeconds: number;
    rounds: number;
    aceLow: boolean;
    aceHigh: boolean;
    layoff: boolean;
    noSameDiscard: boolean;
  };
  suit: {
    winsNeeded: number;
  };
  dice: {
    startDice: number;
  };
  quiz: {
    totalQuestions: number;
  };
  pictionary: {
    turnsEach: number;
  };
  sekata: {
    mode:
      | 'classic'
      | 'green'
      | 'point'
      | 'elimination'
      | 'speed'
      | 'vocabulary'
      | 'norepeat';
    handSize: number;
    sharedYellow: number;
    greenPerPlayer: number;
    blankCards: number;
    penalty: number;
    timeLimit: number;
    minWordCards: number;
    replaceLimit: number;
    cooldown: boolean;
    replacement: boolean;
    allowRepeats: boolean;
    challenges: boolean;
    needMeaning: boolean;
  };
  dart: {
    mode: '501' | '301' | 'countup' | 'clock' | 'cricket';
    startScore: number;
    throwMode: 'casual' | 'skill';
    difficulty: 'easy' | 'normal' | 'hard';
    doubleOut: boolean;
    clockBull: boolean;
    rounds: number;
    maxRounds: number;
  };
  monkeys: {
    mode: 'practice' | 'campaign' | 'custom' | 'endless';
    level: number;
    roles: 'random' | 'host';
    custom: {
      modules: number;
      seconds: number;
      strikes: number;
    };
  };
  werewolf: {
    preset: 'beginner' | 'classic' | 'chaotic' | 'custom';
    wolves: number;
    variations: boolean;
    doctorSelf: boolean;
    bodyguardRepeat: boolean;
    bodyguardDies: boolean;
    alphaHidden: boolean;
    hunterOnPoison: boolean;
    anonymousVoting: boolean;
    revealRoles: boolean;
    voteChange: boolean;
    tieRule: 'none' | 'revote' | 'random';
    deadChat: boolean;
    discussionSeconds: number;
    votingSeconds: number;
    nightSeconds: number;
    maxPlayers: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  room: {
    turnSeconds: 0,
    maxStrikes: 3,
    leaveGraceSeconds: 10,
  },
  unomercy: {
    mercyLimit: 25,
    handSize: 7,
  },
  unoflip: {
    handSize: 7,
  },
  uno: {
    handSize: 7,
  },
  domino: {
    handSize: 7,
  },
  remo: {
    mode: 'classic',
    handSize: 7,
    jokers: 0,
    jokerLimit: 1,
    initialMeld: 0,
    finish: 'discard',
    turnSeconds: 60,
    rounds: 1,
    aceLow: true,
    aceHigh: true,
    layoff: true,
    noSameDiscard: true,
  },
  suit: {
    winsNeeded: 2,
  },
  dice: {
    startDice: 5,
  },
  quiz: {
    totalQuestions: 10,
  },
  pictionary: {
    turnsEach: 2,
  },
  sekata: {
    mode: 'classic',
    handSize: 7,
    sharedYellow: 2,
    greenPerPlayer: 1,
    blankCards: 2,
    penalty: 1,
    timeLimit: 0,
    minWordCards: 2,
    replaceLimit: 2,
    cooldown: false,
    replacement: true,
    allowRepeats: false,
    challenges: true,
    needMeaning: false,
  },
  dart: {
    mode: '501',
    startScore: 501,
    throwMode: 'casual',
    difficulty: 'normal',
    doubleOut: true,
    clockBull: true,
    rounds: 8,
    maxRounds: 0,
  },
  monkeys: {
    mode: 'campaign',
    level: 1,
    roles: 'random',
    custom: {
      modules: 3,
      seconds: 120,
      strikes: 3,
    },
  },
  werewolf: {
    preset: 'classic',
    wolves: 0,
    variations: false,
    doctorSelf: true,
    bodyguardRepeat: false,
    bodyguardDies: true,
    alphaHidden: true,
    hunterOnPoison: false,
    anonymousVoting: false,
    revealRoles: true,
    voteChange: true,
    tieRule: 'none',
    deadChat: true,
    discussionSeconds: 90,
    votingSeconds: 45,
    nightSeconds: 45,
    maxPlayers: 12,
  },
};

function clampInt(
  val: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function pickEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

function pickBool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

export function sanitizeGameConfig(raw: unknown): GameConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    Record<string, unknown> | undefined
  >;
  const rawTurn = Number(obj.room?.turnSeconds);
  const turnSeconds =
    Number.isFinite(rawTurn) && rawTurn > 0
      ? Math.min(300, Math.max(10, Math.round(rawTurn)))
      : 0;

  return {
    room: {
      turnSeconds,
      maxStrikes: clampInt(
        obj.room?.maxStrikes,
        1,
        10,
        DEFAULT_GAME_CONFIG.room.maxStrikes,
      ),
      leaveGraceSeconds: clampInt(
        obj.room?.leaveGraceSeconds,
        3,
        60,
        DEFAULT_GAME_CONFIG.room.leaveGraceSeconds,
      ),
    },
    unomercy: {
      mercyLimit: clampInt(
        obj.unomercy?.mercyLimit,
        5,
        100,
        DEFAULT_GAME_CONFIG.unomercy.mercyLimit,
      ),
      handSize: clampInt(
        obj.unomercy?.handSize,
        2,
        15,
        DEFAULT_GAME_CONFIG.unomercy.handSize,
      ),
    },
    unoflip: {
      handSize: clampInt(
        obj.unoflip?.handSize,
        2,
        15,
        DEFAULT_GAME_CONFIG.unoflip.handSize,
      ),
    },
    uno: {
      handSize: clampInt(
        obj.uno?.handSize,
        2,
        15,
        DEFAULT_GAME_CONFIG.uno.handSize,
      ),
    },
    domino: {
      handSize: clampInt(
        obj.domino?.handSize,
        3,
        10,
        DEFAULT_GAME_CONFIG.domino.handSize,
      ),
    },
    remo: {
      mode: pickEnum(
        obj.remo?.mode,
        ['classic', 'point', 'quick', 'joker'] as const,
        DEFAULT_GAME_CONFIG.remo.mode,
      ),
      handSize: clampInt(
        obj.remo?.handSize,
        5,
        10,
        DEFAULT_GAME_CONFIG.remo.handSize,
      ),
      jokers: clampInt(obj.remo?.jokers, 0, 4, DEFAULT_GAME_CONFIG.remo.jokers),
      jokerLimit: clampInt(
        obj.remo?.jokerLimit,
        1,
        3,
        DEFAULT_GAME_CONFIG.remo.jokerLimit,
      ),
      initialMeld: clampInt(
        obj.remo?.initialMeld,
        0,
        60,
        DEFAULT_GAME_CONFIG.remo.initialMeld,
      ),
      finish: pickEnum(
        obj.remo?.finish,
        ['discard', 'melded'] as const,
        DEFAULT_GAME_CONFIG.remo.finish,
      ),
      turnSeconds: clampInt(
        obj.remo?.turnSeconds,
        0,
        180,
        DEFAULT_GAME_CONFIG.remo.turnSeconds,
      ),
      rounds: clampInt(
        obj.remo?.rounds,
        1,
        10,
        DEFAULT_GAME_CONFIG.remo.rounds,
      ),
      aceLow: pickBool(obj.remo?.aceLow, DEFAULT_GAME_CONFIG.remo.aceLow),
      aceHigh: pickBool(obj.remo?.aceHigh, DEFAULT_GAME_CONFIG.remo.aceHigh),
      layoff: pickBool(obj.remo?.layoff, DEFAULT_GAME_CONFIG.remo.layoff),
      noSameDiscard: pickBool(
        obj.remo?.noSameDiscard,
        DEFAULT_GAME_CONFIG.remo.noSameDiscard,
      ),
    },
    suit: {
      winsNeeded: clampInt(
        obj.suit?.winsNeeded,
        1,
        10,
        DEFAULT_GAME_CONFIG.suit.winsNeeded,
      ),
    },
    dice: {
      startDice: clampInt(
        obj.dice?.startDice,
        1,
        10,
        DEFAULT_GAME_CONFIG.dice.startDice,
      ),
    },
    quiz: {
      totalQuestions: clampInt(
        obj.quiz?.totalQuestions,
        3,
        30,
        DEFAULT_GAME_CONFIG.quiz.totalQuestions,
      ),
    },
    pictionary: {
      turnsEach: clampInt(
        obj.pictionary?.turnsEach,
        1,
        5,
        DEFAULT_GAME_CONFIG.pictionary.turnsEach,
      ),
    },
    sekata: {
      mode: pickEnum(
        obj.sekata?.mode,
        [
          'classic',
          'green',
          'point',
          'elimination',
          'speed',
          'vocabulary',
          'norepeat',
        ] as const,
        DEFAULT_GAME_CONFIG.sekata.mode,
      ),
      handSize: clampInt(
        obj.sekata?.handSize,
        5,
        14,
        DEFAULT_GAME_CONFIG.sekata.handSize,
      ),
      sharedYellow: clampInt(
        obj.sekata?.sharedYellow,
        1,
        5,
        DEFAULT_GAME_CONFIG.sekata.sharedYellow,
      ),
      greenPerPlayer: clampInt(
        obj.sekata?.greenPerPlayer,
        0,
        4,
        DEFAULT_GAME_CONFIG.sekata.greenPerPlayer,
      ),
      blankCards: clampInt(
        obj.sekata?.blankCards,
        0,
        6,
        DEFAULT_GAME_CONFIG.sekata.blankCards,
      ),
      penalty: clampInt(
        obj.sekata?.penalty,
        0,
        5,
        DEFAULT_GAME_CONFIG.sekata.penalty,
      ),
      timeLimit: clampInt(
        obj.sekata?.timeLimit,
        0,
        300,
        DEFAULT_GAME_CONFIG.sekata.timeLimit,
      ),
      minWordCards: clampInt(
        obj.sekata?.minWordCards,
        1,
        5,
        DEFAULT_GAME_CONFIG.sekata.minWordCards,
      ),
      replaceLimit: clampInt(
        obj.sekata?.replaceLimit,
        1,
        5,
        DEFAULT_GAME_CONFIG.sekata.replaceLimit,
      ),
      cooldown: pickBool(
        obj.sekata?.cooldown,
        DEFAULT_GAME_CONFIG.sekata.cooldown,
      ),
      replacement: pickBool(
        obj.sekata?.replacement,
        DEFAULT_GAME_CONFIG.sekata.replacement,
      ),
      allowRepeats: pickBool(
        obj.sekata?.allowRepeats,
        DEFAULT_GAME_CONFIG.sekata.allowRepeats,
      ),
      challenges: pickBool(
        obj.sekata?.challenges,
        DEFAULT_GAME_CONFIG.sekata.challenges,
      ),
      needMeaning: pickBool(
        obj.sekata?.needMeaning,
        DEFAULT_GAME_CONFIG.sekata.needMeaning,
      ),
    },
    dart: {
      mode: pickEnum(
        obj.dart?.mode,
        ['501', '301', 'countup', 'clock', 'cricket'] as const,
        DEFAULT_GAME_CONFIG.dart.mode,
      ),
      startScore: clampInt(
        obj.dart?.startScore,
        61,
        1001,
        DEFAULT_GAME_CONFIG.dart.startScore,
      ),
      throwMode: pickEnum(
        obj.dart?.throwMode,
        ['casual', 'skill'] as const,
        DEFAULT_GAME_CONFIG.dart.throwMode,
      ),
      difficulty: pickEnum(
        obj.dart?.difficulty,
        ['easy', 'normal', 'hard'] as const,
        DEFAULT_GAME_CONFIG.dart.difficulty,
      ),
      doubleOut: pickBool(
        obj.dart?.doubleOut,
        DEFAULT_GAME_CONFIG.dart.doubleOut,
      ),
      clockBull: pickBool(
        obj.dart?.clockBull,
        DEFAULT_GAME_CONFIG.dart.clockBull,
      ),
      rounds: clampInt(
        obj.dart?.rounds,
        3,
        20,
        DEFAULT_GAME_CONFIG.dart.rounds,
      ),
      maxRounds: clampInt(
        obj.dart?.maxRounds,
        0,
        50,
        DEFAULT_GAME_CONFIG.dart.maxRounds,
      ),
    },
    monkeys: {
      mode: pickEnum(
        obj.monkeys?.mode,
        ['practice', 'campaign', 'custom', 'endless'] as const,
        DEFAULT_GAME_CONFIG.monkeys.mode,
      ),
      level: clampInt(
        obj.monkeys?.level,
        1,
        10,
        DEFAULT_GAME_CONFIG.monkeys.level,
      ),
      roles: pickEnum(
        obj.monkeys?.roles,
        ['random', 'host'] as const,
        DEFAULT_GAME_CONFIG.monkeys.roles,
      ),
      custom: {
        modules: clampInt(
          (obj.monkeys?.custom as Record<string, unknown> | undefined)?.modules,
          1,
          6,
          DEFAULT_GAME_CONFIG.monkeys.custom.modules,
        ),
        seconds: clampInt(
          (obj.monkeys?.custom as Record<string, unknown> | undefined)?.seconds,
          30,
          300,
          DEFAULT_GAME_CONFIG.monkeys.custom.seconds,
        ),
        strikes: clampInt(
          (obj.monkeys?.custom as Record<string, unknown> | undefined)?.strikes,
          1,
          5,
          DEFAULT_GAME_CONFIG.monkeys.custom.strikes,
        ),
      },
    },
    werewolf: {
      preset: pickEnum(
        obj.werewolf?.preset,
        ['beginner', 'classic', 'chaotic', 'custom'] as const,
        DEFAULT_GAME_CONFIG.werewolf.preset,
      ),
      wolves: clampInt(
        obj.werewolf?.wolves,
        0,
        6,
        DEFAULT_GAME_CONFIG.werewolf.wolves,
      ),
      variations: pickBool(
        obj.werewolf?.variations,
        DEFAULT_GAME_CONFIG.werewolf.variations,
      ),
      doctorSelf: pickBool(
        obj.werewolf?.doctorSelf,
        DEFAULT_GAME_CONFIG.werewolf.doctorSelf,
      ),
      bodyguardRepeat: pickBool(
        obj.werewolf?.bodyguardRepeat,
        DEFAULT_GAME_CONFIG.werewolf.bodyguardRepeat,
      ),
      bodyguardDies: pickBool(
        obj.werewolf?.bodyguardDies,
        DEFAULT_GAME_CONFIG.werewolf.bodyguardDies,
      ),
      alphaHidden: pickBool(
        obj.werewolf?.alphaHidden,
        DEFAULT_GAME_CONFIG.werewolf.alphaHidden,
      ),
      hunterOnPoison: pickBool(
        obj.werewolf?.hunterOnPoison,
        DEFAULT_GAME_CONFIG.werewolf.hunterOnPoison,
      ),
      anonymousVoting: pickBool(
        obj.werewolf?.anonymousVoting,
        DEFAULT_GAME_CONFIG.werewolf.anonymousVoting,
      ),
      revealRoles: pickBool(
        obj.werewolf?.revealRoles,
        DEFAULT_GAME_CONFIG.werewolf.revealRoles,
      ),
      voteChange: pickBool(
        obj.werewolf?.voteChange,
        DEFAULT_GAME_CONFIG.werewolf.voteChange,
      ),
      tieRule: pickEnum(
        obj.werewolf?.tieRule,
        ['none', 'revote', 'random'] as const,
        DEFAULT_GAME_CONFIG.werewolf.tieRule,
      ),
      deadChat: pickBool(
        obj.werewolf?.deadChat,
        DEFAULT_GAME_CONFIG.werewolf.deadChat,
      ),
      discussionSeconds: clampInt(
        obj.werewolf?.discussionSeconds,
        30,
        300,
        DEFAULT_GAME_CONFIG.werewolf.discussionSeconds,
      ),
      votingSeconds: clampInt(
        obj.werewolf?.votingSeconds,
        15,
        180,
        DEFAULT_GAME_CONFIG.werewolf.votingSeconds,
      ),
      nightSeconds: clampInt(
        obj.werewolf?.nightSeconds,
        15,
        180,
        DEFAULT_GAME_CONFIG.werewolf.nightSeconds,
      ),
      maxPlayers: clampInt(
        obj.werewolf?.maxPlayers,
        5,
        16,
        DEFAULT_GAME_CONFIG.werewolf.maxPlayers,
      ),
    },
  };
}

const REDIS_KEY = 'admin:game-config';

async function redisCommand(
  url: string,
  token: string,
  args: (string | number)[],
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.error) {
    throw new Error(json?.error ?? `Redis HTTP ${res.status}`);
  }
  return json?.result;
}

export async function getGameConfig(): Promise<GameConfig> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (url && token) {
    try {
      const raw = await redisCommand(url, token, ['GET', REDIS_KEY]);
      if (raw) return sanitizeGameConfig(JSON.parse(raw));
    } catch {
      // fall back to default on transient read error
    }
    return structuredClone(DEFAULT_GAME_CONFIG);
  }

  const g = globalThis as unknown as { __gameConfig?: GameConfig };
  return g.__gameConfig
    ? sanitizeGameConfig(g.__gameConfig)
    : structuredClone(DEFAULT_GAME_CONFIG);
}

export async function saveGameConfig(raw: unknown): Promise<GameConfig> {
  const clean = sanitizeGameConfig(raw);
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (url && token) {
    await redisCommand(url, token, ['SET', REDIS_KEY, JSON.stringify(clean)]);
    return clean;
  }

  const g = globalThis as unknown as { __gameConfig?: GameConfig };
  g.__gameConfig = clean;
  return clean;
}
