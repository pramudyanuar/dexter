import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import type {
  BugReport,
  BugReportAction,
  BugReportTarget,
} from '@/lib/game-bugs/types';
import { getRedisConfig, redisCommand } from '@/lib/upstash';

const KEY = 'game-bug-reports';
const DONE_KEY = `${KEY}:done`;
const localDirectory = () =>
  join(/*turbopackIgnore: true*/ process.cwd(), '.data', KEY);

type StoredReport = Omit<BugReport, 'at' | 'done'>;

// Match the existing immutable Redis member using its timestamp and ID.
const CHANGE_REPORT = `
local members = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[2], ARGV[2])
for _, member in ipairs(members) do
  if cjson.decode(member).id == ARGV[1] then
    if ARGV[3] == 'delete' then redis.call('ZREM', KEYS[1], member) end
    if ARGV[3] == 'done' then
      redis.call('HSET', KEYS[2], ARGV[1], '1')
    else
      redis.call('HDEL', KEYS[2], ARGV[1])
    end
    return 1
  end
end
return 0
`;

function ignoreMissing(error: NodeJS.ErrnoException) {
  if (error.code !== 'ENOENT') throw error;
  return null;
}

export function getBugReportStore() {
  const redis = getRedisConfig();
  if (redis) {
    return {
      async save(report: StoredReport) {
        await redisCommand<number>(redis, [
          'ZADD',
          KEY,
          'NX',
          Date.now(),
          JSON.stringify(report),
        ]);
      },
      async list(offset: number, count: number): Promise<BugReport[]> {
        const rows = await redisCommand<string[]>(redis, [
          'ZREVRANGE',
          KEY,
          offset,
          offset + count - 1,
          'WITHSCORES',
        ]);
        const reports: Omit<BugReport, 'done'>[] = [];
        for (let index = 0; index < rows.length; index += 2) {
          reports.push({
            ...JSON.parse(rows[index]),
            at: Number(rows[index + 1]),
          });
        }
        if (!reports.length) return [];
        const done = await redisCommand<(string | null)[]>(redis, [
          'HMGET',
          DONE_KEY,
          ...reports.map(({ id }) => id),
        ]);
        return reports.map((report, index) => ({
          ...report,
          done: done[index] === '1',
        }));
      },
      async change({ id, at }: BugReportTarget, action: BugReportAction) {
        const changed = await redisCommand<number>(redis, [
          'EVAL',
          CHANGE_REPORT,
          2,
          KEY,
          DONE_KEY,
          id,
          at,
          action,
        ]);
        return changed === 1;
      },
    };
  }
  if (process.env.NODE_ENV === 'production') return null;

  return {
    async save(report: StoredReport) {
      const dir = localDirectory();
      await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
      const temp = join(dir, `${randomUUID()}.tmp`);
      try {
        await writeFile(
          /*turbopackIgnore: true*/ temp,
          JSON.stringify({ ...report, at: Date.now() }),
          {
            flag: 'wx',
            flush: true,
          },
        );
        await rename(
          /*turbopackIgnore: true*/ temp,
          join(dir, `${report.id}.json`),
        );
      } finally {
        await rm(/*turbopackIgnore: true*/ temp, { force: true });
      }
    },
    async list(offset: number, count: number): Promise<BugReport[]> {
      const dir = localDirectory();
      const files =
        (await readdir(/*turbopackIgnore: true*/ dir).catch(ignoreMissing)) ??
        [];
      const names = new Set(files);
      // shortcut: local reads scan the report files, use Redis for larger collections.
      const reports = await Promise.all(
        files
          .filter((file) => file.endsWith('.json'))
          .map(async (file) => {
            const path = join(dir, file);
            const raw = await readFile(
              /*turbopackIgnore: true*/ path,
              'utf8',
            ).catch(ignoreMissing);
            if (raw === null) return null;
            const report = JSON.parse(raw) as Omit<BugReport, 'done'>;
            return { ...report, done: names.has(`${report.id}.done`) };
          }),
      );
      return reports
        .filter((report): report is BugReport => report !== null)
        .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id))
        .slice(offset, offset + count);
    },
    async change({ id, at }: BugReportTarget, action: BugReportAction) {
      const dir = localDirectory();
      const report = join(dir, `${id}.json`);
      const done = join(dir, `${id}.done`);
      const raw = await readFile(
        /*turbopackIgnore: true*/ report,
        'utf8',
      ).catch(ignoreMissing);
      if (raw === null || JSON.parse(raw).at !== at) return false;

      if (action === 'delete') {
        const removed = await unlink(/*turbopackIgnore: true*/ report).catch(
          ignoreMissing,
        );
        await rm(/*turbopackIgnore: true*/ done, { force: true });
        return removed !== null;
      }
      if (action === 'done') {
        await writeFile(/*turbopackIgnore: true*/ done, '', { flush: true });
      } else {
        await rm(/*turbopackIgnore: true*/ done, { force: true });
      }
      return true;
    },
  };
}
