'use client';

import * as React from 'react';

import type { Dir } from '@/lib/games/snake';
import {
  DUEL_ROUND_MS,
  DUEL_TICK_MS,
  initialArena,
  SEATS,
} from '@/lib/games/snake-duel';
import { callRoom } from '@/lib/rooms/room-request';
import {
  DUEL_ROOMS_URL,
  DuelMove,
  DuelPoll,
  DuelSession,
  DuelView,
} from '@/lib/snake-duel/protocol';

import { useRemainingMs } from '@/components/games/Countdown';
import RoomBar from '@/components/games/RoomBar';
import { SnakePad, useSnakeKeys } from '@/components/games/snake/controls';
import SnakeBoard from '@/components/games/snake/SnakeBoard';

const waitingArena = initialArena(0);
const button =
  'min-h-11 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent disabled:opacity-40';

type Connection = 'connecting' | 'online' | 'retrying' | 'closed';
const POLL_MS = 1000;

export default function SnakeDuelRoom({
  session,
  onExit,
}: {
  session: DuelSession;
  onExit: () => void;
}) {
  const [snapshot, setSnapshot] = React.useState<{
    room: DuelView;
    receivedAt: number;
  } | null>(null);
  const [connection, setConnection] = React.useState<Connection>('connecting');
  const [attempt, setAttempt] = React.useState(0);
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const seq = React.useRef(0);
  const pendingMove = React.useRef<DuelMove | null>(null);
  const pollNow = React.useRef<(() => void) | null>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const { code, token } = session;
  const path = `${DUEL_ROOMS_URL}/${code}`;
  const room = snapshot?.room;
  const round = room?.round;
  const phase = round?.phase;
  const countdownMs =
    round?.phase === 'countdown' && snapshot
      ? round.nextAt - snapshot.room.now
      : 0;
  const remaining = useRemainingMs(
    countdownMs > 0 && snapshot ? snapshot.receivedAt + countdownMs : null,
  );
  const arena = round?.arena ?? waitingArena;
  const online = connection === 'online';
  const playing = online && phase === 'playing';
  const myPlayer = room?.players[session.seat];
  const bothReady = room?.players.every(
    (player) => player?.online && player.ready,
  );

  React.useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let polling = false;
    let stopped = false;
    let nextPollAt = 0;
    let retrySince: number | undefined;
    let current: DuelView | null = null;

    async function poll() {
      if (polling || stopped || controller.signal.aborted) return;
      polling = true;
      window.clearTimeout(timer);
      const started = performance.now();
      const move = pendingMove.current;
      pendingMove.current = null;
      let delay = POLL_MS;

      try {
        const data: DuelPoll = await callRoom(
          `${path}?v=${current?.version ?? 0}`,
          {
            token,
            body: move ? { action: 'move', move } : undefined,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(5000),
            ]),
          },
        );
        if (controller.signal.aborted) return;
        if (retrySince !== undefined) setNotice('');
        retrySince = undefined;
        setConnection('online');
        if (data.changed) {
          current = data.room;
          setSnapshot({ room: current, receivedAt: Date.now() });
        }
        const round = current?.round;
        if (round?.phase === 'playing') {
          // A turn sent between polls keeps the next board update on schedule.
          delay =
            move && nextPollAt > started ? nextPollAt - started : DUEL_TICK_MS;
        }
        if (round?.phase === 'countdown' && current)
          delay = Math.max(
            DUEL_TICK_MS,
            Math.min(POLL_MS, round.nextAt - current.now),
          );
        nextPollAt = started + delay;
        delay = pendingMove.current
          ? 0
          : Math.max(0, nextPollAt - performance.now());
      } catch (error) {
        if (controller.signal.aborted) return;
        const { status, message } = error as Error & { status?: number };
        retrySince ??= Date.now();
        if (
          status === 403 ||
          status === 404 ||
          Date.now() - retrySince > 20_000
        ) {
          stopped = true;
          setNotice(message);
          setConnection('closed');
        } else {
          setConnection('retrying');
        }
      } finally {
        polling = false;
        if (!stopped && !controller.signal.aborted)
          timer = window.setTimeout(poll, delay);
      }
    }

    pollNow.current = poll;
    timer = window.setTimeout(poll, 0);
    document.addEventListener('visibilitychange', poll);
    return () => {
      controller.abort();
      pollNow.current = null;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [path, token, attempt]);

  function steer(dir: Dir) {
    if (!playing || !round) return false;
    // Keep input ordering after a reload, while the previous input may still exist.
    seq.current = Math.max(Date.now(), seq.current + 1);
    pendingMove.current = { dir, roundId: round.id, seq: seq.current };
    pollNow.current?.();
    return true;
  }

  async function ready(value: boolean) {
    setBusy(true);
    setNotice('');
    try {
      await callRoom(path, {
        token,
        body: { action: 'ready', ready: value },
        signal: AbortSignal.timeout(5000),
      });
      if (value) boardRef.current?.focus({ preventScroll: true });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    if (!online) return onExit();
    setBusy(true);
    void callRoom(path, {
      token,
      body: { action: 'leave' },
      signal: AbortSignal.timeout(1500),
    })
      .catch(() => undefined)
      .finally(onExit);
  }

  useSnakeKeys(steer);

  const countdown = Math.max(
    1,
    Math.ceil(Math.min(countdownMs, remaining) / 1000),
  );
  const seconds = Math.max(
    0,
    Math.ceil((DUEL_ROUND_MS - arena.tick * DUEL_TICK_MS) / 1000),
  );
  let status = 'Menunggu lawan…';
  if (connection === 'connecting') status = 'Menyambungkan ke arena…';
  if (connection === 'retrying') status = 'Menyambungkan ulang…';
  if (connection === 'closed') status = 'Koneksi arena berakhir.';
  if (online && phase === 'countdown') status = `Mulai dalam ${countdown}`;
  if (online && phase === 'paused')
    status = 'Jeda · menunggu pemain tersambung kembali';
  if (online && phase === 'over' && arena.result) {
    status =
      arena.result.reason === 'cancelled'
        ? 'Ronde batal.'
        : arena.result.winner === null
          ? 'Seri.'
          : arena.result.winner === session.seat
            ? 'Kamu menang!'
            : 'Lawan menang.';
  }
  if (online && !round && room?.players.every(Boolean))
    status = 'Tekan Siap untuk mulai.';

  return (
    <section aria-label='Duel Snake' className='space-y-3'>
      <RoomBar code={code} share onLeave={leave} leaveDisabled={busy} />

      <div className='grid grid-cols-2 gap-2'>
        {SEATS.map((seat) => {
          const player = room?.players[seat];
          return (
            <div
              key={seat}
              className={`min-w-0 rounded-lg border border-line bg-card p-3 text-sm ${seat === session.seat ? 'text-accent' : 'text-info'}`}
            >
              <p className='truncate font-semibold'>
                {player?.name ?? 'Kursi kosong'}
                {seat === session.seat && player ? ' (kamu)' : ''}
              </p>
              <p className='text-xs text-mute'>
                {player?.online
                  ? player.ready
                    ? 'Siap'
                    : 'Terhubung'
                  : player
                    ? 'Terputus'
                    : 'Menunggu'}{' '}
                · {arena.snakes[seat].score} apel
              </p>
            </div>
          );
        })}
      </div>

      <div className='flex items-center justify-between gap-2 text-sm'>
        <span className='text-mute'>{seconds} dtk</span>
        {online && (!phase || phase === 'over') && (
          <button
            type='button'
            className={button}
            disabled={busy}
            onClick={() => ready(bothReady || !myPlayer?.ready)}
          >
            {bothReady
              ? 'Coba mulai'
              : myPlayer?.ready
                ? 'Batal siap'
                : phase === 'over'
                  ? 'Siap rematch'
                  : 'Siap'}
          </button>
        )}
      </div>

      <SnakeBoard
        boardRef={boardRef}
        snakes={arena.snakes.map((snake, seat) => ({
          ...snake,
          opponent: seat !== session.seat,
        }))}
        food={arena.food}
        active={playing}
        onSwipe={steer}
      >
        {!playing && (
          <div className='absolute inset-0 grid place-items-center rounded-[inherit] bg-paper/80 p-4 text-center'>
            <p role='status' className='font-semibold'>
              {status}
            </p>
          </div>
        )}
      </SnakeBoard>
      <SnakePad onDirection={steer} disabled={!playing} />
      {connection === 'closed' && (
        <button
          type='button'
          className={button}
          onClick={() => {
            setConnection('connecting');
            setNotice('');
            setAttempt((n) => n + 1);
          }}
        >
          Sambung ulang
        </button>
      )}
      {notice && (
        <p role='alert' className='text-sm text-err'>
          {notice}
        </p>
      )}
      <p className='text-center text-xs text-mute'>
        Panah, WASD, atau geser untuk belok.
      </p>
    </section>
  );
}
