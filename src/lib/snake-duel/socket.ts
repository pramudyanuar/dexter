import type { RawData, WebSocket } from 'ws';
import { z } from 'zod';

import { DUEL_TICK_MS } from '@/lib/games/snake-duel';
import { newToken } from '@/lib/rooms/codes';
import {
  DuelEvent,
  DuelSession,
  DuelView,
  TOKEN_PATTERN,
} from '@/lib/snake-duel/protocol';
import { absentSince, advanceRound, roomView } from '@/lib/snake-duel/room';
import { DUEL_UNAVAILABLE, DuelError, DuelStore } from '@/lib/snake-duel/store';

const message = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    seat: z.union([z.literal(0), z.literal(1)]),
    token: z.string().regex(TOKEN_PATTERN),
  }),
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({
    type: z.literal('turn'),
    roundId: z.string().regex(TOKEN_PATTERN),
    seq: z.int().positive().max(1_000_000),
    dir: z.enum(['up', 'right', 'down', 'left']),
  }),
  z.object({ type: z.literal('leave') }),
]);

const PING_MS = 2000;
const FOLLOW_MS = 400;

function readMessage(data: RawData) {
  const bytes = Array.isArray(data)
    ? Buffer.concat(data)
    : data instanceof ArrayBuffer
      ? Buffer.from(data)
      : data;
  if (bytes.length > 1024) return null;
  try {
    const parsed = message.safeParse(JSON.parse(bytes.toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serveDuelSocket(ws: WebSocket, store: DuelStore, code: string) {
  const connection = newToken();
  const subscription = new AbortController();
  let session: DuelSession | null = null;
  let view: DuelView | null = null;
  let lastUpdate = 0;
  let lastTurn = 0;
  let clock: ReturnType<typeof setTimeout> | undefined;
  let ticking = false;
  let leader = false;
  let pendingControl = false;
  let attaching = false;
  let pongPending = false;
  let closed = false;

  function send(event: DuelEvent) {
    if (ws.readyState !== ws.OPEN) return;
    if (ws.bufferedAmount > 256 * 1024) {
      ws.close(1013, 'Sambungkan ulang');
      return;
    }
    ws.send(JSON.stringify(event));
  }

  function report(error: unknown) {
    if (closed) return;
    if (error instanceof DuelError) {
      send({ type: 'notice', message: error.message });
      if (error.status === 403 || error.status === 404)
        ws.close(1008, 'Kursi berakhir');
    } else {
      send({ type: 'notice', message: DUEL_UNAVAILABLE });
      ws.close(1013, 'Sambungkan ulang');
    }
  }

  function schedule() {
    const round = view?.round;
    if (clock || ticking || closed || !round || round.phase === 'over') return;
    const delay = !leader
      ? FOLLOW_MS
      : round.phase === 'paused'
        ? 250
        : Math.max(8, Math.min(350, round.nextAt - Date.now()));
    clock = setTimeout(() => {
      clock = undefined;
      ticking = true;
      void advance()
        .catch(report)
        .finally(() => {
          ticking = false;
          schedule();
        });
    }, delay);
  }

  function receive(room: DuelView) {
    if (closed || room.code !== code || (view && room.version <= view.version))
      return;
    view = room;
    lastUpdate = Date.now();
    send({ type: 'state', room });
    if (room.round?.phase === 'over' && leader) {
      leader = false;
      void store.updateLease(code, connection, false).catch(report);
    }
    schedule();
  }

  async function advance() {
    if (closed || !session || !view?.round || view.round.phase === 'over')
      return;
    if (!leader) {
      if (Date.now() - lastUpdate < FOLLOW_MS - 20) return;
      leader = await store.claimLease(code, connection);
      if (!leader) return;
    }

    const frame = await store.readFrame(code);
    if (closed) return;
    if (!frame) throw new DuelError('Room sudah kedaluwarsa.', 404);
    if (
      frame.presence[session.seat]?.id !== connection ||
      absentSince(frame.presence[session.seat], Date.now()) !== null
    ) {
      throw new DuelError('Kursi ini sudah tidak tersedia.', 403);
    }
    const round = frame.room.round;
    if (!round || round.phase === 'over') {
      receive(roomView(frame.room, frame.presence, Date.now()));
      return;
    }

    const now = Date.now();
    const next = advanceRound(round, frame.presence, frame.input, now);
    if (next === round) {
      leader = await store.updateLease(code, connection, true);
      return;
    }
    const room = { ...frame.room, round: next };
    const saved = await store.commit(frame, room, now, connection);
    if (saved === -1) leader = false;
    if (saved === 1)
      receive(
        roomView({ ...room, version: room.version + 1 }, frame.presence, now),
      );
  }

  async function attach(seat: DuelSession['seat'], token: string) {
    const member = { code, seat, token };
    const room = await store.attach(member, connection);
    if (closed) {
      await store.detach(code, seat, connection);
      return;
    }
    session = member;
    clearTimeout(authTimeout);
    receive(room);
    void store
      .subscribe(code, subscription.signal, receive)
      .then(() => {
        if (!subscription.signal.aborted)
          report(new Error('Subscription ended'));
      })
      .catch((error) => {
        if (!subscription.signal.aborted) report(error);
      });
  }

  async function pulse() {
    if (!session || closed) return;
    if (
      !(await store.updatePresence(code, session.seat, connection, 'pulse'))
    ) {
      throw new DuelError('Koneksi kursi digantikan.', 403);
    }
    if (Date.now() - lastUpdate >= PING_MS - 100) {
      const frame = await store.readFrame(code);
      if (!frame) throw new DuelError('Room sudah kedaluwarsa.', 404);
      receive(roomView(frame.room, frame.presence, Date.now()));
    }
  }

  const authTimeout = setTimeout(
    () => ws.close(1008, 'Autentikasi diperlukan'),
    5000,
  );
  const ping = setInterval(() => {
    if (pongPending) {
      ws.terminate();
    } else if (ws.readyState === ws.OPEN) {
      pongPending = true;
      ws.ping();
    }
  }, PING_MS);
  const recycle = setTimeout(() => ws.close(1012, 'Sambungkan ulang'), 270_000);

  ws.on('error', () => ws.terminate());
  ws.on('pong', () => {
    pongPending = false;
    void pulse().catch(report);
  });
  ws.on('close', () => {
    closed = true;
    subscription.abort();
    clearTimeout(authTimeout);
    clearTimeout(recycle);
    clearTimeout(clock);
    clearInterval(ping);
    if (session)
      void store.detach(code, session.seat, connection).catch(() => undefined);
  });
  ws.on('message', (data, binary) => {
    const input = binary ? null : readMessage(data);
    if (!input || closed) return;
    if (!session) {
      if (input.type === 'hello' && !attaching) {
        attaching = true;
        void attach(input.seat, input.token).catch(report);
      }
      return;
    }

    if (input.type === 'turn') {
      const now = Date.now();
      if (
        view?.round?.id !== input.roundId ||
        view.round.phase !== 'playing' ||
        now - lastTurn < DUEL_TICK_MS - 10
      )
        return;
      lastTurn = now;
      void store
        .writeInput(code, session.seat, {
          player: connection,
          roundId: input.roundId,
          seq: input.seq,
          dir: input.dir,
        })
        .catch(report);
    } else if (!pendingControl && input.type !== 'hello') {
      pendingControl = true;
      const operation =
        input.type === 'ready'
          ? store.ready(session, connection, input.ready)
          : store.leave(session, connection).then(() => {
              send({ type: 'left' });
              ws.close(1000, 'Keluar');
            });
      void operation.catch(report).finally(() => {
        pendingControl = false;
      });
    }
  });
}
