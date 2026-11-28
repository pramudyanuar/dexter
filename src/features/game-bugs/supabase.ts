import 'server-only';

import type {
  BugReport,
  BugReportAction,
  BugReportTarget,
} from '@/features/game-bugs/types';
import { getSupabaseAdmin } from '@/integrations/supabase/admin';

type StoredReport = Omit<BugReport, 'at' | 'done'>;
type ReportRow = Omit<BugReport, 'gameTitle' | 'playerName'> & {
  game_title: string;
  player_name: string | null;
};

export function getSupabaseBugReportStore() {
  const client = getSupabaseAdmin();
  if (!client) return null;

  return {
    async save(report: StoredReport) {
      const { error } = await client
        .from('game_bug_reports')
        .upsert(
          {
            id: report.id,
            game: report.game,
            game_title: report.gameTitle,
            pathname: report.pathname,
            description: report.description,
            player_name: report.playerName ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        )
        .abortSignal(AbortSignal.timeout(4000));
      if (error) throw error;
    },
    async list(offset: number, count: number): Promise<BugReport[]> {
      const { data, error } = await client
        .from('game_bug_reports')
        .select(
          'id, game, game_title, pathname, description, player_name, at, done',
        )
        .order('at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + count - 1)
        .abortSignal(AbortSignal.timeout(4000))
        .overrideTypes<ReportRow[], { merge: false }>();
      if (error) throw error;
      return data.map(({ game_title, player_name, ...report }) => ({
        ...report,
        gameTitle: game_title,
        ...(player_name !== null && { playerName: player_name }),
      }));
    },
    async change({ id, at }: BugReportTarget, action: BugReportAction) {
      const table = client.from('game_bug_reports');
      const mutation =
        action === 'delete'
          ? table.delete()
          : table.update({ done: action === 'done' });
      const { data, error } = await mutation
        .eq('id', id)
        .eq('at', at)
        .select('id')
        .abortSignal(AbortSignal.timeout(4000));
      if (error) throw error;
      return data.length > 0;
    },
  };
}
