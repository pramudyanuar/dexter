import { getBugReportStore } from '@/lib/game-bugs/store';
import { readJson } from '@/lib/read-json';
import { ROOM_BUG_REPORT_ID } from '@/lib/rooms/bug-reports';
import { getRoomStore } from '@/lib/rooms/store';

const headers = { 'Cache-Control': 'no-store' };

export async function changeBugReport(req: Request, deleting: boolean) {
  const params = new URL(req.url).searchParams;
  const roomReports = params.get('source') === 'room';
  const id = params.get('id') ?? '';
  const at = Number(params.get('at'));
  const idPattern = roomReports ? ROOM_BUG_REPORT_ID : /^[a-f0-9]{64}$/;
  if (!idPattern.test(id) || !Number.isSafeInteger(at) || at <= 0) {
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
    const action = deleting ? 'delete' : body?.done ? 'done' : 'reopen';
    let changed: boolean;
    if (roomReports) {
      const store = getRoomStore();
      if (!store) throw new Error('Room storage is unavailable');
      changed = await store.changeBugReport({ id, at }, action);
    } else {
      const store = getBugReportStore();
      if (!store) throw new Error('Bug report storage is unavailable');
      changed = await store.change({ id, at }, action);
    }
    if (!changed) {
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
