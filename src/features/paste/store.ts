import { createHash } from 'node:crypto';

import { MAX_MEMOS, PasteMemo } from '@/features/paste/types';
import {
  getSupabaseState,
  type SupabaseState,
} from '@/integrations/supabase/state';

type MemoChange = (current: PasteMemo[]) => PasteMemo[];

export interface PasteStore {
  list(code: string): Promise<PasteMemo[]>;
  update(code: string, change: MemoChange): Promise<PasteMemo[]>;
}

function keyFor(code: string): string {
  return createHash('sha256').update(`paste:${code}`).digest('hex');
}

function pruneExpired(memos: PasteMemo[], now = Date.now()): PasteMemo[] {
  return memos.filter((memo) => memo.expiresAt > now).slice(0, MAX_MEMOS);
}

class SupabasePasteStore implements PasteStore {
  constructor(private readonly state: SupabaseState) {}

  async list(code: string) {
    return pruneExpired(
      (await this.state.get<PasteMemo[]>(keyFor(code))) ?? [],
    );
  }

  update(code: string, change: MemoChange) {
    const key = keyFor(code);
    return this.state.transact([key], async (tx) => {
      const current = (await tx.read<PasteMemo[]>(key))?.value ?? [];
      const active = pruneExpired(change(pruneExpired(current)));
      if (active.length) {
        tx.set(
          key,
          active,
          Math.max(...active.map(({ expiresAt }) => expiresAt)),
        );
      } else if (current.length) {
        tx.delete(key);
      }
      return active;
    });
  }
}

class MemoryPasteStore implements PasteStore {
  private rooms: Map<string, PasteMemo[]>;

  constructor() {
    const g = globalThis as unknown as {
      __pasteRooms?: Map<string, PasteMemo[]>;
    };
    this.rooms = g.__pasteRooms ??= new Map();
  }

  async list(code: string): Promise<PasteMemo[]> {
    const key = keyFor(code);
    const active = pruneExpired(this.rooms.get(key) ?? []);
    if (active.length === 0) this.rooms.delete(key);
    else this.rooms.set(key, active);
    return active.map((memo) => ({ ...memo }));
  }

  async update(code: string, change: MemoChange) {
    const key = keyFor(code);
    const current = pruneExpired(this.rooms.get(key) ?? []).map((memo) => ({
      ...memo,
    }));
    const active = pruneExpired(change(current));
    if (active.length)
      this.rooms.set(
        key,
        active.map((memo) => ({ ...memo })),
      );
    else this.rooms.delete(key);
    return active;
  }
}

export function getPasteStore(): PasteStore | null {
  const state = getSupabaseState('paste');
  if (state) return new SupabasePasteStore(state);
  return process.env.NODE_ENV === 'production' ? null : new MemoryPasteStore();
}
