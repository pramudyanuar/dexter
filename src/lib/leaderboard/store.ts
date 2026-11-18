import {
  LeaderboardEntry,
  sortEntries,
  VALID_GAME_IDS,
} from '@/lib/leaderboard/types';
import { getRedisConfig, redisCommand, RedisConfig } from '@/lib/upstash';

export interface LeaderboardStore {
  list(game: string): Promise<LeaderboardEntry[]>;
  listAll(): Promise<Record<string, LeaderboardEntry[]>>;
  submit(
    game: string,
    entry: LeaderboardEntry,
  ): Promise<{ entries: LeaderboardEntry[]; rank: number | null }>;
  clear(game: string): Promise<void>;
}

interface BoardOptions {
  keyFor: (game: string) => string;
  keepBest?: boolean;
  ttlSeconds?: number;
}

const classic: BoardOptions = { keyFor: (game) => `lb:${game}` };

const REPLACE_ENTRIES = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
local ttl = tonumber(ARGV[3])
if ttl > 0 then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ttl)
else
  redis.call('SET', KEYS[1], ARGV[2])
end
return 1
`;

function parseEntries(raw: string | null, game: string): LeaderboardEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    return Array.isArray(parsed) ? sortEntries(parsed, game) : [];
  } catch {
    return [];
  }
}

function submitTo(
  current: LeaderboardEntry[],
  game: string,
  entry: LeaderboardEntry,
  keepBest = false,
) {
  const existing = current.find(({ id }) => id === entry.id);
  const entries =
    !existing || (keepBest && entry.score > existing.score)
      ? sortEntries(
          [...current.filter(({ id }) => id !== entry.id), entry],
          game,
        )
      : current;
  const idx = entries.findIndex(({ id }) => id === entry.id);
  return { entries, rank: idx === -1 ? null : idx + 1 };
}

class RedisLeaderboardStore implements LeaderboardStore {
  constructor(
    private config: RedisConfig,
    private options: BoardOptions,
  ) {}

  async list(game: string): Promise<LeaderboardEntry[]> {
    const raw = await redisCommand<string | null>(this.config, [
      'GET',
      this.options.keyFor(game),
    ]);
    return parseEntries(raw, game);
  }

  async listAll(): Promise<Record<string, LeaderboardEntry[]>> {
    const games = Array.from(VALID_GAME_IDS);
    const values = await redisCommand<(string | null)[]>(this.config, [
      'MGET',
      ...games.map(this.options.keyFor),
    ]);
    const out: Record<string, LeaderboardEntry[]> = {};
    games.forEach((g, i) => {
      const entries = parseEntries(values[i], g);
      if (entries.length > 0) out[g] = entries;
    });
    return out;
  }

  async submit(
    game: string,
    entry: LeaderboardEntry,
  ): Promise<{ entries: LeaderboardEntry[]; rank: number | null }> {
    const key = this.options.keyFor(game);
    for (let attempt = 0; attempt < 8; attempt++) {
      const raw = await redisCommand<string | null>(this.config, ['GET', key]);
      const current = parseEntries(raw, game);
      const next = submitTo(current, game, entry, this.options.keepBest);
      if (next.entries === current) return next;
      const saved = await redisCommand<number>(this.config, [
        'EVAL',
        REPLACE_ENTRIES,
        1,
        key,
        raw ?? '',
        JSON.stringify(next.entries),
        this.options.ttlSeconds ?? 0,
      ]);
      if (saved === 1) return next;
    }
    throw new Error('Concurrent leaderboard updates exceeded retry limit');
  }

  async clear(game: string): Promise<void> {
    await redisCommand<number>(this.config, ['DEL', this.options.keyFor(game)]);
  }
}

class MemoryLeaderboardStore implements LeaderboardStore {
  private map: Map<string, LeaderboardEntry[]>;

  constructor(private options: BoardOptions) {
    const g = globalThis as unknown as {
      __leaderboard?: Map<string, LeaderboardEntry[]>;
    };
    this.map = g.__leaderboard ??= new Map();
  }

  async list(game: string): Promise<LeaderboardEntry[]> {
    return (this.map.get(this.options.keyFor(game)) ?? []).map((e) => ({
      ...e,
    }));
  }

  async listAll(): Promise<Record<string, LeaderboardEntry[]>> {
    const out: Record<string, LeaderboardEntry[]> = {};
    for (const game of VALID_GAME_IDS) {
      const entries = await this.list(game);
      if (entries.length > 0) out[game] = entries;
    }
    return out;
  }

  async submit(
    game: string,
    entry: LeaderboardEntry,
  ): Promise<{ entries: LeaderboardEntry[]; rank: number | null }> {
    const key = this.options.keyFor(game);
    const next = submitTo(
      this.map.get(key) ?? [],
      game,
      entry,
      this.options.keepBest,
    );
    this.map.set(key, next.entries);
    return next;
  }

  async clear(game: string): Promise<void> {
    this.map.delete(this.options.keyFor(game));
  }
}

export function getLeaderboardStore(
  options = classic,
): LeaderboardStore | null {
  const config = getRedisConfig();
  if (config) return new RedisLeaderboardStore(config, options);
  return process.env.NODE_ENV === 'production'
    ? null
    : new MemoryLeaderboardStore(options);
}

export function getDailyLeaderboardStore(day: string, version: number) {
  return getLeaderboardStore({
    keyFor: (game) => `lb:${game}:daily:v${version}:${day}`,
    keepBest: true,
    ttlSeconds: 48 * 60 * 60,
  });
}
