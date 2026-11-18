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

const keyFor = (game: string) => `lb:${game}`;

const REPLACE_ENTRIES = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
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
) {
  const entries = current.some(({ id }) => id === entry.id)
    ? current
    : sortEntries([...current, entry], game);
  const idx = entries.findIndex(({ id }) => id === entry.id);
  return { entries, rank: idx === -1 ? null : idx + 1 };
}

class RedisLeaderboardStore implements LeaderboardStore {
  constructor(private config: RedisConfig) {}

  async list(game: string): Promise<LeaderboardEntry[]> {
    const raw = await redisCommand<string | null>(this.config, [
      'GET',
      keyFor(game),
    ]);
    return parseEntries(raw, game);
  }

  async listAll(): Promise<Record<string, LeaderboardEntry[]>> {
    const games = Array.from(VALID_GAME_IDS);
    const values = await redisCommand<(string | null)[]>(this.config, [
      'MGET',
      ...games.map(keyFor),
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
    const key = keyFor(game);
    for (let attempt = 0; attempt < 8; attempt++) {
      const raw = await redisCommand<string | null>(this.config, ['GET', key]);
      const current = parseEntries(raw, game);
      const next = submitTo(current, game, entry);
      if (next.entries === current) return next;
      const saved = await redisCommand<number>(this.config, [
        'EVAL',
        REPLACE_ENTRIES,
        1,
        key,
        raw ?? '',
        JSON.stringify(next.entries),
      ]);
      if (saved === 1) return next;
    }
    throw new Error('Concurrent leaderboard updates exceeded retry limit');
  }

  async clear(game: string): Promise<void> {
    await redisCommand<number>(this.config, ['DEL', keyFor(game)]);
  }
}

class MemoryLeaderboardStore implements LeaderboardStore {
  private map: Map<string, LeaderboardEntry[]>;

  constructor() {
    const g = globalThis as unknown as {
      __leaderboard?: Map<string, LeaderboardEntry[]>;
    };
    this.map = g.__leaderboard ??= new Map();
  }

  async list(game: string): Promise<LeaderboardEntry[]> {
    return (this.map.get(game) ?? []).map((e) => ({ ...e }));
  }

  async listAll(): Promise<Record<string, LeaderboardEntry[]>> {
    const out: Record<string, LeaderboardEntry[]> = {};
    for (const [game, entries] of this.map.entries()) {
      if (entries.length > 0) {
        out[game] = entries.map((e) => ({ ...e }));
      }
    }
    return out;
  }

  async submit(
    game: string,
    entry: LeaderboardEntry,
  ): Promise<{ entries: LeaderboardEntry[]; rank: number | null }> {
    const next = submitTo(this.map.get(game) ?? [], game, entry);
    this.map.set(game, next.entries);
    return next;
  }

  async clear(game: string): Promise<void> {
    this.map.delete(game);
  }
}

export function getLeaderboardStore(): LeaderboardStore | null {
  const config = getRedisConfig();
  if (config) return new RedisLeaderboardStore(config);
  return process.env.NODE_ENV === 'production'
    ? null
    : new MemoryLeaderboardStore();
}
