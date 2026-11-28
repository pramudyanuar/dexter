import type { Level } from '@/features/games/logic/minesweeper';
import {
  LeaderboardEntry,
  sortEntries,
  VALID_GAME_IDS,
} from '@/features/leaderboard/types';
import {
  getSupabaseState,
  type SupabaseState,
} from '@/integrations/supabase/state';

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

class SupabaseLeaderboardStore implements LeaderboardStore {
  constructor(
    private readonly state: SupabaseState,
    private readonly options: BoardOptions,
  ) {}

  async list(game: string) {
    return sortEntries(
      (await this.state.get<LeaderboardEntry[]>(this.options.keyFor(game))) ??
        [],
      game,
    );
  }

  async listAll() {
    const games = [...VALID_GAME_IDS];
    const boards = await this.state.getMany<LeaderboardEntry[]>(
      games.map(this.options.keyFor),
    );
    return Object.fromEntries(
      games.flatMap((game, index) => {
        const board = boards[index];
        return board?.length ? [[game, sortEntries(board, game)]] : [];
      }),
    );
  }

  submit(game: string, entry: LeaderboardEntry) {
    const key = this.options.keyFor(game);
    return this.state.transact([key], async (tx) => {
      const current = sortEntries(
        (await tx.read<LeaderboardEntry[]>(key))?.value ?? [],
        game,
      );
      const next = submitTo(current, game, entry, this.options.keepBest);
      if (next.entries !== current) {
        const ttl = this.options.ttlSeconds;
        tx.set(key, next.entries, ttl ? Date.now() + ttl * 1000 : null);
      }
      return next;
    });
  }

  clear(game: string) {
    const key = this.options.keyFor(game);
    return this.state.transact([key], (tx) => tx.delete(key));
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
  const state = getSupabaseState('leaderboard');
  if (state) return new SupabaseLeaderboardStore(state, options);
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

export function getMinesLeaderboardStore(level: Level) {
  return getLeaderboardStore({ keyFor: (game) => `lb:${game}:${level}` });
}
