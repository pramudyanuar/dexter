'use client';

import * as React from 'react';

import { COLS, emptyBoard, ROWS } from '@/lib/games/connect4';
import type { Connect4State } from '@/lib/games/connect4-online';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import RoomLobby from '@/components/games/RoomLobby';

// seat 0 created the room, seat 1 joined it
const DISC = ['bg-accent', 'bg-hash'] as const;
const DISC_FX = [
  'radial-gradient(circle at 32% 30%, #b6f5bd, #2da44e 55%, #116329)',
  'radial-gradient(circle at 32% 30%, #fff1b0, #e3b341 55%, #8a6500)',
] as const;
const NAME = ['hijau', 'kuning'] as const;

function Connect4() {
  const r = useRoom<Connect4State>('connect4');

  if (!r.session) {
    return (
      <RoomLobby
        command='connect4 --online'
        blurb='# Empat berjajar untuk dua pemain di device berbeda. Satu membuat room, yang lain memasukkan kodenya.'
        busy={r.busy}
        error={r.error}
        onCreate={r.create}
        onJoin={r.join}
      />
    );
  }

  const { room } = r;
  const you = r.session.you;
  const state = room?.state ?? null;
  const board = state?.board ?? emptyBoard();
  const myTurn = room?.status === 'playing' && state?.turn === you;
  const winning = new Set(
    (state?.line ?? []).map(([row, col]) => `${row},${col}`),
  );

  let status: React.ReactNode = 'Menghubungkan…';
  if (room?.status === 'waiting') status = 'Menunggu lawan bergabung…';
  else if (room?.status === 'playing') {
    status = myTurn ? (
      <span className='text-accent'>Giliranmu</span>
    ) : (
      <span className='text-mute'>Giliran lawan…</span>
    );
  } else if (state?.status === 'won') {
    status =
      state.winner === you ? (
        <span className='text-accent'>Kamu menang!</span>
      ) : (
        <span className='text-err'>Kamu kalah.</span>
      );
  } else if (state?.status === 'draw') status = 'Seri.';

  return (
    <>
      <RoomBar
        code={r.session.code}
        share={room?.status === 'waiting'}
        onLeave={r.leave}
        right={
          <span className='text-mute'>
            kamu:{' '}
            <span
              className={`${DISC[you]} inline-block size-2.5 rounded-full align-middle`}
            />{' '}
            {NAME[you]}
          </span>
        }
      />

      {state?.status === 'won' && state.winner === you && <Confetti />}

      <p
        key={`${room?.status}-${state?.turn}-${state?.status}`}
        className='a-slide-up mb-3 text-center text-sm'
        aria-live='polite'
      >
        {status}
      </p>

      <div
        role='grid'
        aria-label='Papan Connect Four'
        className='grid grid-cols-7 gap-1.5 rounded-xl border-2 border-info/40 bg-info/15 p-2 shadow-lg'
      >
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            type='button'
            aria-label={`Kolom ${c + 1}`}
            disabled={!myTurn || r.busy}
            onClick={() => r.move({ col: c })}
            className={`group flex flex-col gap-1.5 rounded-md transition-colors ${
              myTurn && !r.busy
                ? 'cursor-pointer hover:bg-white/15'
                : 'cursor-default'
            }`}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const owner = board[row][c];
              return (
                <span
                  key={row}
                  role='gridcell'
                  data-owner={owner}
                  style={
                    {
                      '--from': `-${(row + 1) * 112}%`,
                      ...(owner ? { background: DISC_FX[owner - 1] } : {}),
                    } as React.CSSProperties
                  }
                  className={`aspect-square w-full rounded-full ${
                    owner
                      ? 'a-drop shadow-[inset_0_-3px_6px_rgb(0_0_0/0.35),0_1px_2px_rgb(0_0_0/0.3)]'
                      : 'bg-paper shadow-[inset_0_3px_6px_rgb(0_0_0/0.35)] group-enabled:group-hover:bg-paper/70'
                  } ${winning.has(`${row},${c}`) ? 'a-bob ring-4 ring-ink' : ''}`}
                />
              );
            })}
          </button>
        ))}
      </div>

      {room?.status === 'over' && (
        <button
          type='button'
          onClick={r.rematch}
          disabled={r.busy}
          className='mt-4 self-center text-xs text-info hover:underline'
        >
          [main lagi]
        </button>
      )}

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}

      <p className='mt-auto pt-4 text-center text-xs text-mute'>
        Satukan empat cakram dalam satu garis. Room hilang sendiri setelah 2
        jam.
      </p>
    </>
  );
}

export default function Connect4Page() {
  // the lobby reads the URL and localStorage, so wait for the browser
  const mounted = useMounted();

  return (
    <GameShell name='connect4' wide>
      {mounted ? <Connect4 /> : null}
    </GameShell>
  );
}
