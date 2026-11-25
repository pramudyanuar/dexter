import { getBugReportStore } from '@/lib/game-bugs/store';
import { BUG_REPORT_PAGE_SIZE } from '@/lib/game-bugs/types';
import { readJson } from '@/lib/read-json';
import { isAdminAuthed } from '@/lib/rooms/admin-auth';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  if (!isAdminAuthed(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const offset = Number(new URL(req.url).searchParams.get('offset') ?? 0);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > Number.MAX_SAFE_INTEGER - BUG_REPORT_PAGE_SIZE
  ) {
    return Response.json(
      { error: 'Halaman tidak valid.' },
      { status: 400, headers },
    );
  }

  try {
    const store = getBugReportStore();
    if (!store) throw new Error('Bug report storage is unavailable');
    const reports = await store.list(offset, BUG_REPORT_PAGE_SIZE + 1);
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

async function changeReport(req: Request, deleting: boolean) {
  if (!isAdminAuthed(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  const params = new URL(req.url).searchParams;
  const id = params.get('id') ?? '';
  const at = Number(params.get('at'));
  if (!/^[a-f0-9]{64}$/.test(id) || !Number.isSafeInteger(at) || at <= 0) {
    return Response.json(
      { error: 'Laporan bug tidak valid.' },
      { status: 400, headers },
    );
  }
  const body = deleting
    ? null
    : ((await readJson(req, 1024)) as { done?: unknown } | null);
  if (!deleting && typeof body?.done !== 'boolean') {
    return Response.json(
      { error: 'Status laporan tidak valid.' },
      { status: 400, headers },
    );
  }

  try {
    const store = getBugReportStore();
    if (!store) throw new Error('Bug report storage is unavailable');
    const action = deleting ? 'delete' : body?.done ? 'done' : 'reopen';
    if (!(await store.change({ id, at }, action))) {
      return Response.json(
        { error: 'Laporan bug sudah tidak ada.' },
        { status: 404, headers },
      );
    }
    return new Response(null, { status: 204, headers });
  } catch {
    return Response.json(
      { error: 'Perubahan laporan belum tersimpan. Coba lagi.' },
      { status: 503, headers },
    );
  }
}

export function PATCH(req: Request) {
  return changeReport(req, false);
}

export function DELETE(req: Request) {
  return changeReport(req, true);
}
