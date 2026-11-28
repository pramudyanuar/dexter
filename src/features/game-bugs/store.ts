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

import { getSupabaseBugReportStore } from '@/features/game-bugs/supabase';
import type {
  BugReport,
  BugReportAction,
  BugReportTarget,
} from '@/features/game-bugs/types';

const KEY = 'game-bug-reports';
const localDirectory = () =>
  join(/*turbopackIgnore: true*/ process.cwd(), '.data', KEY);

type StoredReport = Omit<BugReport, 'at' | 'done'>;

function ignoreMissing(error: NodeJS.ErrnoException) {
  if (error.code !== 'ENOENT') throw error;
  return null;
}

export function getBugReportStore() {
  const supabase = getSupabaseBugReportStore();
  if (supabase) return supabase;

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
      // shortcut: local reads scan the report files, use Supabase for larger collections.
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
