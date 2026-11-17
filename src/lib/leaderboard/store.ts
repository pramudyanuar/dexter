import {
  LeaderboardEntry,
  sortEntries,
  VALID_GAME_IDS,
} from '@/lib/leaderboard/types';

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

class RedisLeaderboardStore implements LeaderboardStore {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async command(args: (string | number)[]) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      throw new Error(json?.error ?? `Redis HTTP ${res.status}`);
    }
    return json?.result;
  }

  async list(game: string): Promise<LeaderboardEntry[]> {
    const raw = await this.command(['GET', keyFor(game)]);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as LeaderboardEntry[];
      return Array.isArray(parsed) ? sortEntries(parsed, game) : [];
    } catch {
      return [];
    }
  }

  async listAll(): Promise<Record<string, LeaderboardEntry[]>> {
    const games = Array.from(VALID_GAME_IDS);
    const lists = await Promise.all(games.map((g) => this.list(g)));
    const out: Record<string, LeaderboardEntry[]> = {};
    games.forEach((g, i) => {
      if (lists[i].length > 0) out[g] = lists[i];
    });
    return out;
  }

  async submit(
    game: string,
    entry: LeaderboardEntry,
  ): Promise<{ entries: LeaderboardEntry[]; rank: number | null }> {
    const current = await this.list(game);
    const next = sortEntries([...current, entry], game);
    await this.command(['SET', keyFor(game), JSON.stringify(next)]);
    const idx = next.findIndex((e) => e.id === entry.id);
    return { entries: next, rank: idx === -1 ? null : idx + 1 };
  }

  async clear(game: string): Promise<void> {
    await this.command(['DEL', keyFor(game)]);
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
    const current = await this.list(game);
    const next = sortEntries([...current, entry], game);
    this.map.set(game, next);
    const idx = next.findIndex((e) => e.id === entry.id);
    return { entries: next, rank: idx === -1 ? null : idx + 1 };
  }

  async clear(game: string): Promise<void> {
    this.map.delete(game);
  }
}

export function getLeaderboardStore(): LeaderboardStore | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) return new RedisLeaderboardStore(url, token);
  return process.env.NODE_ENV === 'production'
    ? null
    : new MemoryLeaderboardStore();
}
