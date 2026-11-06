'use client';

import * as React from 'react';

import { COLS, emptyBoard, ROWS } from '@/lib/games/connect4';
import type { Connect4State } from '@/lib/games/connect4-online';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import RoomLobby from '@/components/games/RoomLobby';

// seat 0 created the room, seat 1 joined it
const DISC = ['bg-accent', 'bg-hash'] as const;
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

      <p className='mb-3 text-center text-sm' aria-live='polite'>
        {status}
      </p>

      <div
        role='grid'
        aria-label='Papan Connect Four'
        className='grid grid-cols-7 gap-1.5 rounded-sm border border-line bg-card p-2'
      >
        {Array.from({ length: COLS }, (_, c) => (
          <button
            key={c}
            type='button'
            aria-label={`Kolom ${c + 1}`}
            disabled={!myTurn || r.busy}
            onClick={() => r.move({ col: c })}
            className={`flex flex-col gap-1.5 rounded-sm ${
              myTurn && !r.busy
                ? 'cursor-pointer hover:bg-line/50'
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
                  className={`aspect-square w-full rounded-full ${
                    owner ? DISC[owner - 1] : 'bg-paper'
                  } ${winning.has(`${row},${c}`) ? 'ring-2 ring-ink' : ''}`}
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
