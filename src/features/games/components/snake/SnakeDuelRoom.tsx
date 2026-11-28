'use client';

import * as React from 'react';

import {
  SnakePad,
  useSnakeKeys,
} from '@/features/games/components/snake/controls';
import SnakeBoard from '@/features/games/components/snake/SnakeBoard';
import { Dir, OPPOSITE } from '@/features/games/logic/snake';
import {
  DUEL_ROUND_MS,
  DUEL_TICK_MS,
  initialArena,
  Pair,
  pairOf,
  projectArenaStep,
  Seat,
  SEATS,
} from '@/features/games/logic/snake-duel';
import {
  advanceDuel,
  DUEL_FRAME_MS,
  DuelFrame,
  duelFrame,
  DuelMatch,
  queueDuelTurn,
  readyDuel,
} from '@/features/snake-duel/match';
import { DuelMessage, readDuelMessage } from '@/features/snake-duel/messages';

const waitingArena = initialArena(0);
const waitingMatch: DuelMatch = { ready: [false, false], round: null };
const HEARTBEAT_MS = 1000;
const PEER_TIMEOUT_MS = 5500;
const button =
  'min-h-11 rounded-lg border border-line px-3 text-sm font-medium hover:border-accent disabled:opacity-40';

function sameStep(a: DuelFrame['round'], b: DuelFrame['round']) {
  return (
    a?.id === b?.id && a?.phase === b?.phase && a?.arena.tick === b?.arena.tick
  );
}

export default function SnakeDuelRoom({
  seat,
  names,
  peer,
  channel,
  onExit,
}: {
  seat: Seat;
  names: Pair<string>;
  peer: RTCPeerConnection;
  channel: RTCDataChannel;
  onExit: () => void;
}) {
  const match = React.useRef(waitingMatch);
  const [snapshot, setSnapshot] = React.useState(() => ({
    frame: duelFrame(waitingMatch, 0),
    receivedAt: 0,
    durationMs: DUEL_TICK_MS,
    previous: null as DuelFrame['round'],
  }));
  const [peerLeft, setPeerLeft] = React.useState(false);
  const [localTurn, setLocalTurn] = React.useState<{
    id: number;
    tick: number;
    dir: Dir;
  } | null>(null);
  const boardRef = React.useRef<HTMLDivElement>(null);
  const { frame } = snapshot;
  const round = frame.round;
  const phase = round?.phase;
  const arena = round?.arena ?? waitingArena;
  const playing = !peerLeft && phase === 'playing';

  const receive = React.useCallback((next: DuelFrame) => {
    const at = Date.now();
    setSnapshot((current) => {
      const before = current.frame.round;
      const after = next.round;
      const same = current.receivedAt !== 0 && sameStep(before, after);
      if (
        same &&
        next.ready.every(
          (ready, player) => ready === current.frame.ready[player],
        ) &&
        after?.turns[0] === before?.turns[0] &&
        after?.turns[1] === before?.turns[1] &&
        (after?.phase !== 'countdown' ||
          Math.ceil(after.stepInMs / 1000) ===
            Math.ceil((before?.stepInMs ?? 0) / 1000))
      )
        return current;

      return {
        frame: next,
        receivedAt: same ? current.receivedAt : at,
        durationMs: same
          ? current.durationMs
          : Math.max(
              1,
              Math.min(DUEL_TICK_MS, after?.stepInMs ?? DUEL_TICK_MS),
            ),
        previous: same
          ? current.previous
          : before?.id === after?.id
            ? before
            : null,
      };
    });
  }, []);

  const send = React.useCallback(
    (message: DuelMessage) => {
      if (channel.readyState !== 'open') return false;
      try {
        channel.send(JSON.stringify(message));
        return true;
      } catch {
        return false;
      }
    },
    [channel],
  );

  const publish = React.useCallback(
    (now: number, force = false) => {
      const frame = duelFrame(match.current, now);
      receive(frame);
      if (force || channel.bufferedAmount === 0) send({ type: 'state', frame });
    },
    [channel, receive, send],
  );

  const markReady = React.useCallback(
    (player: Seat, value: boolean) => {
      const now = Date.now();
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      match.current = readyDuel(match.current, player, value, seed, now);
      publish(now, true);
    },
    [publish],
  );

  React.useEffect(() => {
    let heardAt = Date.now();
    let pulseAt = 0;
    let stopped = false;

    function end() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      setPeerLeft(true);
      peer.close();
    }

    function onMessage(event: MessageEvent) {
      if (stopped) return;
      const message = readDuelMessage(event.data);
      if (!message) return;
      heardAt = Date.now();
      if (message.type === 'leave') end();
      else if (seat === 1 && message.type === 'state') receive(message.frame);
      else if (seat === 0 && message.type === 'ready')
        markReady(1, message.ready);
      else if (seat === 0 && message.type === 'turn') {
        const next = queueDuelTurn(match.current, 1, message.id, message.dir);
        if (next !== match.current) {
          match.current = next;
          publish(heardAt);
        }
      }
    }

    function clock() {
      if (stopped) return;
      const now = Date.now();
      if (now - heardAt > PEER_TIMEOUT_MS || channel.readyState !== 'open') {
        end();
        return;
      }
      const pulse = now - pulseAt >= HEARTBEAT_MS;
      if (pulse) pulseAt = now;
      if (seat === 0) {
        const before = match.current;
        const next = advanceDuel(before, now);
        match.current = next;
        if (
          next !== before ||
          pulse ||
          (next.round && next.round.phase !== 'over')
        ) {
          publish(now, pulse || next.round?.phase !== before.round?.phase);
        }
      } else if (pulse) send({ type: 'ping' });
    }

    function pageHide() {
      send({ type: 'leave' });
      peer.close();
    }

    channel.addEventListener('message', onMessage);
    channel.addEventListener('close', end);
    window.addEventListener('pagehide', pageHide);
    const timer = window.setInterval(clock, DUEL_FRAME_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', pageHide);
      channel.removeEventListener('message', onMessage);
      channel.removeEventListener('close', end);
    };
  }, [channel, markReady, peer, publish, receive, seat, send]);

  function steer(dir: Dir) {
    if (!playing || !round) return false;
    if (seat === 0) {
      match.current = queueDuelTurn(match.current, seat, round.id, dir);
      publish(Date.now());
      return true;
    }
    if (!send({ type: 'turn', id: round.id, dir })) return false;
    const heading = arena.snakes[seat].dir;
    if (dir !== heading && dir !== OPPOSITE[heading]) {
      setLocalTurn((current) =>
        current?.id === round.id && current.tick === arena.tick
          ? current
          : { id: round.id, tick: arena.tick, dir },
      );
    }
    return true;
  }

  function ready(value: boolean) {
    if (seat === 0) markReady(seat, value);
    else if (!send({ type: 'ready', ready: value })) return;
    boardRef.current?.focus({ preventScroll: true });
  }

  useSnakeKeys(steer);

  const previous = snapshot.previous;
  const predicted =
    playing && round
      ? projectArenaStep(
          arena,
          pairOf((player) =>
            player === seat &&
            localTurn?.id === round.id &&
            localTurn.tick === arena.tick
              ? (round.turns[player] ?? localTurn.dir)
              : round.turns[player],
          ),
        ).snakes
      : null;
  const motion = playing ? snapshot : undefined;
  const seconds = Math.max(
    0,
    Math.ceil((DUEL_ROUND_MS - arena.tick * DUEL_TICK_MS) / 1000),
  );
  let status = 'Tekan Siap untuk mulai.';
  if (peerLeft) status = 'Lawan keluar. Duel selesai.';
  else if (round?.phase === 'countdown')
    status = `Mulai dalam ${Math.max(1, Math.ceil(round.stepInMs / 1000))}`;
  else if (round?.phase === 'over' && arena.result) {
    status =
      arena.result.winner === null
        ? 'Seri.'
        : arena.result.winner === seat
          ? 'Kamu menang!'
          : 'Lawan menang.';
  }

  return (
    <section
      aria-label='Duel Snake'
      className='mx-auto max-w-[30rem] space-y-3'
    >
      <div className='flex items-center justify-between gap-2 text-sm'>
        <span className='text-mute'>{seconds} dtk</span>
        <div className='flex gap-2'>
          {!peerLeft && (!phase || phase === 'over') && (
            <button
              type='button'
              className={button}
              disabled={seat === 1 && snapshot.receivedAt === 0}
              onClick={() => ready(!frame.ready[seat])}
            >
              {frame.ready[seat]
                ? 'Batal siap'
                : phase === 'over'
                  ? 'Siap rematch'
                  : 'Siap'}
            </button>
          )}
          <button
            type='button'
            className={button}
            onClick={() => {
              send({ type: 'leave' });
              onExit();
            }}
          >
            {peerLeft ? 'Kembali ke lobi' : 'Keluar duel'}
          </button>
        </div>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        {SEATS.map((player) => (
          <div
            key={player}
            className={`min-w-0 rounded-lg border border-line bg-card p-3 text-sm ${player === seat ? 'text-accent' : 'text-info'}`}
          >
            <p className='truncate font-semibold'>
              {names[player]}
              {player === seat ? ' (kamu)' : ''}
            </p>
            <p className='text-xs text-mute'>
              {frame.ready[player] ? 'Siap · ' : ''}
              {arena.snakes[player].score} apel
            </p>
          </div>
        ))}
      </div>
      <SnakeBoard
        boardRef={boardRef}
        snakes={arena.snakes.map((snake, player) => {
          const opponent = player !== seat;
          const target = predicted?.[player];
          const last =
            opponent && previous && previous.arena.tick + 1 === arena.tick
              ? previous.arena.snakes[player].snake
              : undefined;
          return {
            ...snake,
            opponent,
            slide: target
              ? { from: snake.snake, to: target.snake, dir: target.dir }
              : undefined,
            catchUp: last
              ? { from: last, to: snake.snake, dir: snake.dir }
              : undefined,
          };
        })}
        motion={motion}
        food={arena.food}
        onSwipe={steer}
      >
        {!playing && (
          <div className='pointer-events-none absolute inset-0 grid place-items-center p-4 text-center'>
            <p
              role='status'
              className='border border-line-strong bg-paper px-5 py-3 font-semibold'
            >
              {status}
            </p>
          </div>
        )}
      </SnakeBoard>
      <SnakePad onDirection={steer} disabled={!playing} />
      <p className='text-center text-xs text-mute'>
        Panah, WASD, atau geser untuk belok.
      </p>
    </section>
  );
}
