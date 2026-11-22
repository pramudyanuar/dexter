'use client';

import * as React from 'react';

import type { Dir } from '@/lib/games/snake';
import {
  DUEL_ROUND_MS,
  DUEL_TICK_MS,
  initialArena,
  SEATS,
} from '@/lib/games/snake-duel';
import {
  DUEL_SOCKET_URL,
  DuelEvent,
  DuelSession,
  DuelView,
} from '@/lib/snake-duel/protocol';

import RoomBar from '@/components/games/RoomBar';
import { SnakePad, useSnakeKeys } from '@/components/games/snake/controls';
import SnakeBoard from '@/components/games/snake/SnakeBoard';

const waitingArena = initialArena(0);
const button =
  'min-h-11 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent disabled:opacity-40';

type Connection = 'connecting' | 'online' | 'retrying' | 'closed';

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
  const [left, setLeft] = React.useState(false);
  const [now, setNow] = React.useState(Date.now);
  const socket = React.useRef<WebSocket | null>(null);
  const seq = React.useRef(0);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const exit = React.useEffectEvent(onExit);
  const room = snapshot?.room;
  const round = room?.round;
  const phase = round?.phase;
  const arena = round?.arena ?? waitingArena;
  const online = connection === 'online';
  const playing = online && phase === 'playing';
  const myPlayer = room?.players[session.seat];
  const bothReady = room?.players.every(
    (player) => player?.online && player.ready,
  );

  React.useEffect(() => {
    let disposed = false;
    let retry: number | undefined;
    let delay = 250;
    let retrySince: number | undefined;

    function connect() {
      const url = new URL(DUEL_SOCKET_URL, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('room', session.code);
      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        if (!disposed)
          ws.send(
            JSON.stringify({
              type: 'hello',
              seat: session.seat,
              token: session.token,
            }),
          );
      };
      ws.onmessage = ({ data }) => {
        if (disposed || typeof data !== 'string') return;
        let event: DuelEvent;
        try {
          event = JSON.parse(data) as DuelEvent;
        } catch {
          return;
        }
        if (event.type === 'left') {
          exit();
        } else if (event.type === 'notice') {
          setNotice(event.message);
        } else if (event.type === 'state') {
          delay = 250;
          retrySince = undefined;
          const receivedAt = Date.now();
          setConnection('online');
          setSnapshot((current) =>
            current && current.room.version > event.room.version
              ? current
              : { room: event.room, receivedAt },
          );
        }
      };
      ws.onclose = ({ code }) => {
        if (disposed) return;
        retrySince ??= Date.now();
        if (
          code === 1000 ||
          code === 1008 ||
          Date.now() - retrySince > 20_000
        ) {
          setConnection('closed');
          return;
        }
        setConnection('retrying');
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 2000);
      };
    }

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      socket.current?.close();
    };
  }, [session, attempt]);

  React.useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  React.useEffect(() => {
    if (!left) return;
    const timer = window.setTimeout(() => exit(), 1500);
    return () => window.clearTimeout(timer);
  }, [left]);

  function send(event: object) {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(event));
    return true;
  }

  function steer(dir: Dir) {
    if (!playing || !round) return false;
    return send({ type: 'turn', dir, roundId: round.id, seq: ++seq.current });
  }

  function ready(value: boolean) {
    setNotice('');
    if (send({ type: 'ready', ready: value }) && value) {
      boardRef.current?.focus({ preventScroll: true });
    }
  }

  useSnakeKeys(steer);

  const countdown =
    snapshot && round
      ? Math.max(
          1,
          Math.ceil(
            (round.nextAt -
              snapshot.room.now -
              Math.max(0, now - snapshot.receivedAt)) /
              1000,
          ),
        )
      : 3;
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
      <RoomBar
        code={session.code}
        share
        leaveDisabled={left}
        onLeave={() => {
          if (online && send({ type: 'leave' })) setLeft(true);
          else onExit();
        }}
      />

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
