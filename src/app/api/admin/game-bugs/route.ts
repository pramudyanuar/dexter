import { changeBugReport } from '@/lib/game-bugs/change';
import { getBugReportStore } from '@/lib/game-bugs/store';
import {
  type AdminBugReport,
  BUG_REPORT_PAGE_SIZE,
  formatRoomBugReport,
} from '@/lib/game-bugs/types';
import { isAdminAuthed } from '@/lib/rooms/admin-auth';
import { BUG_REPORT_KEEP } from '@/lib/rooms/bug-reports';
import { getRoomStore } from '@/lib/rooms/store';

const headers = { 'Cache-Control': 'no-store' };

async function listReports(offset: number): Promise<AdminBugReport[]> {
  const store = getBugReportStore();
  const roomStore = getRoomStore();
  if (!store || !roomStore)
    throw new Error('Bug report storage is unavailable');

  // Room reports can shift a general report by at most BUG_REPORT_KEEP places.
  const start = Math.max(0, offset - BUG_REPORT_KEEP);
  const skip = offset - start;
  const count = skip + BUG_REPORT_PAGE_SIZE + 1;
  const [general, snapshots] = await Promise.all([
    store.list(start, count),
    roomStore.listBugReports(),
  ]);
  const roomReports = snapshots.map(formatRoomBugReport);
  return [...general, ...roomReports]
    .sort((a, b) => b.at - a.at)
    .slice(skip, count);
}

export async function GET(req: Request) {
  if (!isAdminAuthed(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const params = new URL(req.url).searchParams;
  const offset = Number(params.get('offset') ?? 0);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > Number.MAX_SAFE_INTEGER - BUG_REPORT_PAGE_SIZE - 1
  ) {
    return Response.json(
      { error: 'Halaman tidak valid.' },
      { status: 400, headers },
    );
  }

  try {
    const reports = await listReports(offset);
    return Response.json(
      {
        reports: reports.slice(0, BUG_REPORT_PAGE_SIZE),
        hasMore: reports.length > BUG_REPORT_PAGE_SIZE,
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: 'Penyimpanan laporan bug sedang tidak tersedia.' },
      { status: 503, headers },
    );
  }
}

function changeReport(req: Request, deleting: boolean) {
  if (!isAdminAuthed(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  return changeBugReport(req, deleting);
}

export function PATCH(req: Request) {
  return changeReport(req, false);
}

export function DELETE(req: Request) {
  return changeReport(req, true);
}
