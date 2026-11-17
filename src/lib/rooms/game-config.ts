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
  werewolf: {
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
  werewolf: {
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
    werewolf: {
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
