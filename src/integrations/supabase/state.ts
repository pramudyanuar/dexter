import 'server-only';

import { getSupabaseAdmin } from '@/integrations/supabase/admin';

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type Row = {
  key: string;
  revision: string | null;
  value: string | null;
  expires_at: number | null;
};

type Transaction = {
  read<T>(key: string): Promise<{ value: T; expiresAt: number | null } | null>;
  set(key: string, value: unknown, expiresAt?: number | null): void;
  delete(key: string): void;
};

export class SupabaseState {
  constructor(
    private readonly client: Admin,
    private readonly scope: string,
  ) {}

  private query<Columns extends string>(columns: Columns) {
    return this.client
      .from('dexter_state')
      .select(columns)
      .eq('scope', this.scope)
      .or(`expires_at.is.null,expires_at.gt.${Date.now()}`);
  }

  private async rows(keys: string[]) {
    const { data, error } = await this.query('key, revision, value, expires_at')
      .in('key', keys)
      .abortSignal(AbortSignal.timeout(4000))
      .overrideTypes<Row[], { merge: false }>();
    if (error) throw error;
    return data;
  }

  async get<T>(key: string) {
    return (await this.getMany<T>([key]))[0];
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    if (!keys.length) return [];
    const rows = new Map(
      (await this.rows(keys)).map((row) => [row.key, row.value]),
    );
    return keys.map((key) => {
      const value = rows.get(key);
      return value == null ? null : (JSON.parse(value) as T);
    });
  }

  async keys(prefix = ''): Promise<string[]> {
    const result: string[] = [];
    for (;;) {
      const query = this.query('key')
        .like('key', `${prefix}%`)
        .order('key')
        .limit(500)
        .abortSignal(AbortSignal.timeout(4000));
      const last = result.at(-1);
      if (last !== undefined) query.gt('key', last);
      const { data, error } = await query;
      if (error) throw error;
      result.push(...data.map(({ key }) => key as string));
      if (data.length < 500) return result;
    }
  }

  async newestKeys(prefix: string, limit: number) {
    const { data, error } = await this.query('key')
      .like('key', `${prefix}%`)
      .order('expires_at', { ascending: false, nullsFirst: false })
      .order('key', { ascending: false })
      .limit(limit)
      .abortSignal(AbortSignal.timeout(4000));
    if (error) throw error;
    return data.map(({ key }) => key as string);
  }

  async transact<T>(
    keys: string[],
    operation: (tx: Transaction) => T | Promise<T>,
  ): Promise<T> {
    const load = (keys: string[]) => this.rows(keys);
    for (let attempt = 0; attempt < 8; attempt++) {
      const read = new Map<string, Row>(
        keys.map((key) => [
          key,
          { key, revision: null, value: null, expires_at: null },
        ]),
      );
      for (const row of await this.rows(keys)) read.set(row.key, row);
      const writes = new Map<string, Pick<Row, 'value' | 'expires_at'>>();
      const stage = (
        key: string,
        value: string | null,
        expires_at: number | null,
      ) => {
        if (!read.has(key))
          throw new Error(`State key must be read before writing: ${key}`);
        writes.set(key, { value, expires_at });
      };
      const result = await operation({
        async read<V>(key: string) {
          if (!read.has(key)) {
            read.set(
              key,
              (await load([key]))[0] ?? {
                key,
                revision: null,
                value: null,
                expires_at: null,
              },
            );
          }
          const row = read.get(key)!;
          if (row.value === null) return null;
          return {
            value: JSON.parse(row.value) as V,
            expiresAt: row.expires_at,
          };
        },
        set: (key, value, expiration = null) =>
          stage(key, JSON.stringify(value), expiration),
        delete: (key) => stage(key, null, null),
      });
      if (!writes.size) return result;
      const changes = [...read.values()].map(({ key, revision }) => ({
        key,
        revision,
        write: writes.has(key),
        ...writes.get(key),
      }));
      const { data, error } = await this.client
        .rpc('dexter_commit_state', {
          state_scope: this.scope,
          changes,
        })
        .abortSignal(AbortSignal.timeout(4000));
      if (error) throw error;
      if (data === true) return result;
    }
    throw new Error(
      `Concurrent updates exceeded retry limit for ${this.scope}`,
    );
  }

  set(key: string, value: unknown, expiresAt?: number) {
    return this.transact([key], (tx) => tx.set(key, value, expiresAt));
  }
}

export function getSupabaseState(scope: string) {
  const client = getSupabaseAdmin();
  return client ? new SupabaseState(client, scope) : null;
}
