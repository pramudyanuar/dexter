import { getBugReportStore } from '@/lib/game-bugs/store';
import {
  type AdminBugReport,
  BUG_REPORT_PAGE_SIZE,
} from '@/lib/game-bugs/types';
import { readJson } from '@/lib/read-json';
import { isAdminAuthed } from '@/lib/rooms/admin-auth';
import { ROOM_BUG_REPORT_ID } from '@/lib/rooms/bug-reports';
import { getRoomStore } from '@/lib/rooms/store';

import { GAME_PAGES } from '@/constant/games';

const headers = { 'Cache-Control': 'no-store' };

async function listReports(
  offset: number,
  roomReports: boolean,
): Promise<AdminBugReport[]> {
  const count = BUG_REPORT_PAGE_SIZE + 1;
  if (roomReports) {
    const store = getRoomStore();
    if (!store) throw new Error('Room storage is unavailable');
    return (await store.listBugReports())
      .slice(offset, offset + count)
      .map((snapshot) => {
        const { room, id, description, submittedAt, playerName, done } =
          snapshot;
        const game = GAME_PAGES.find(({ id }) => id === room.game);
        return {
          id,
          game: room.game,
          gameTitle: game?.title ?? room.game,
          pathname: game?.href ?? `/games/${room.game}`,
          description,
          playerName,
          at: submittedAt,
          done: done ?? false,
          snapshot,
        };
      });
  }
  const store = getBugReportStore();
  if (!store) throw new Error('Bug report storage is unavailable');
  return store.list(offset, count);
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
    const reports = await listReports(offset, params.get('source') === 'room');
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

export function PATCH(req: Request) {
  return changeReport(req, false);
}

export function DELETE(req: Request) {
  return changeReport(req, true);
}
