import { upgradeWebSocket } from '@vercel/functions';

import { CODE_PATTERN, normalizeCode } from '@/lib/rooms/code-format';
import { duelFailure } from '@/lib/snake-duel/http';
import { serveDuelSocket } from '@/lib/snake-duel/socket';
import { DuelError, getDuelStore } from '@/lib/snake-duel/store';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const store = getDuelStore();
    const url = new URL(request.url);
    const code = normalizeCode(url.searchParams.get('room') ?? '');
    const origin = request.headers.get('origin');
    const host = request.headers.get('host') ?? url.host;
    if (!CODE_PATTERN.test(code))
      throw new DuelError('Kode room tidak valid.', 400);
    if (origin !== `https://${host}` && origin !== `http://${host}`) {
      throw new DuelError('Origin koneksi tidak valid.', 403);
    }
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      throw new DuelError('Koneksi WebSocket diperlukan.', 426);
    }
    return await upgradeWebSocket((ws) => serveDuelSocket(ws, store, code), {
      maxPayload: 1024,
    });
  } catch (error) {
    return duelFailure(error);
  }
}
