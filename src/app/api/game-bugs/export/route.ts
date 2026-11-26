import { getBugReportStore } from '@/lib/game-bugs/store';
import {
  BUG_REPORT_PAGE_SIZE,
  type BugReport,
  formatRoomBugReport,
} from '@/lib/game-bugs/types';
import { getRoomStore } from '@/lib/rooms/store';

const headers = { 'Cache-Control': 'no-store' };
const encoder = new TextEncoder();

function encodeReport(
  { id, game, gameTitle, pathname, description, at, done }: BugReport,
  source: 'game' | 'room',
) {
  return encoder.encode(
    JSON.stringify({
      id,
      source,
      game,
      gameTitle,
      pathname,
      description,
      at,
      status: done ? 'done' : 'open',
    }) + '\n',
  );
}

export async function GET() {
  try {
    const store = getBugReportStore();
    const roomStore = getRoomStore();
    if (!store || !roomStore) throw new Error('Bug report storage unavailable');

    const readPage = (offset: number) =>
      store.list(offset, BUG_REPORT_PAGE_SIZE);
    const [firstPage, rooms] = await Promise.all([
      readPage(0),
      roomStore.listBugReports(),
    ]);

    async function* reportLines() {
      for (const room of rooms) {
        yield encodeReport(formatRoomBugReport(room), 'room');
      }
      let page = firstPage;
      let offset = 0;
      for (;;) {
        for (const report of page) yield encodeReport(report, 'game');
        if (page.length < BUG_REPORT_PAGE_SIZE) return;
        offset += page.length;
        page = await readPage(offset);
      }
    }

    const lines = reportLines();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await lines.next();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      async cancel() {
        await lines.return();
      },
    });
    return new Response(stream, {
      headers: { ...headers, 'Content-Type': 'application/x-ndjson' },
    });
  } catch {
    return Response.json(
      { error: 'Penyimpanan laporan bug sedang tidak tersedia.' },
      { status: 503, headers },
    );
  }
}
