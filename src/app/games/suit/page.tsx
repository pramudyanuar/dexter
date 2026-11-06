'use client';

import * as React from 'react';

import { Pick, PICKS, SuitView } from '@/lib/games/suit';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import RoomLobby from '@/components/games/RoomLobby';

const SHAPE: Record<Pick, { icon: string; label: string }> = {
  batu: { icon: '✊', label: 'batu' },
  gunting: { icon: '✌️', label: 'gunting' },
  kertas: { icon: '✋', label: 'kertas' },
};

function Suit() {
  const r = useRoom<SuitView>('suit');

  if (!r.session) {
    return (
      <RoomLobby
        command='suit --online'
        blurb='# Batu, gunting, kertas untuk dua pemain di device berbeda. Siapa yang menang dua ronde lebih dulu, menang.'
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
  const opponent = 1 - you;
  const over = room?.status === 'over';

  const last = state?.last;
  const lastText = last
    ? last.winner === null
      ? 'Seri, ronde diulang.'
      : last.winner === you
        ? 'Kamu menang ronde itu.'
        : 'Lawan menang ronde itu.'
    : null;

  let status: React.ReactNode = 'Menghubungkan…';
  if (room?.status === 'waiting') status = 'Menunggu lawan bergabung…';
  else if (over) {
    status =
      state?.winner === you ? (
        <span className='text-accent'>Kamu menang pertandingan!</span>
      ) : (
        <span className='text-err'>Kamu kalah pertandingan.</span>
      );
  } else if (state?.myPick)
    status = <span className='text-mute'>Menunggu lawan memilih…</span>;
  else if (state) status = <span className='text-accent'>Pilih sekarang</span>;

  return (
    <>
      <RoomBar
        code={r.session.code}
        share={room?.status === 'waiting'}
        onLeave={r.leave}
      />

      {state && (
        <>
          <div className='mb-1 flex items-center justify-center gap-6 text-lg'>
            <span>
              kamu <span className='text-accent'>{state.scores[you]}</span>
            </span>
            <span className='text-mute'>-</span>
            <span>
              <span className='text-hash'>{state.scores[opponent]}</span> lawan
            </span>
          </div>
          <p className='mb-4 text-center text-xs text-mute'>
            ronde {over ? state.round - 1 : state.round} · menang {state.target}{' '}
            ronde dulu
          </p>
        </>
      )}

      <p className='mb-4 text-center text-sm' aria-live='polite'>
        {status}
      </p>

      {room?.status !== 'waiting' && state && (
        <div className='grid grid-cols-3 gap-2'>
          {PICKS.map((pick) => {
            const chosen = state.myPick === pick;
            return (
              <button
                key={pick}
                type='button'
                data-pick={pick}
                aria-pressed={chosen}
                disabled={over || !!state.myPick || r.busy}
                onClick={() => r.move({ pick })}
                className={`flex flex-col items-center gap-1 rounded-sm border py-5 text-3xl transition ${
                  chosen
                    ? 'border-accent bg-accent/15'
                    : 'border-line bg-card enabled:hover:border-accent'
                } disabled:cursor-default`}
              >
                {SHAPE[pick].icon}
                <span className='text-xs'>{SHAPE[pick].label}</span>
              </button>
            );
          })}
        </div>
      )}

      {last && (
        <div className='mt-5 text-center' data-testid='last-round'>
          <p className='text-xs text-mute'>ronde sebelumnya</p>
          <p className='mt-1 text-2xl'>
            <span title='kamu'>{SHAPE[last.picks[you]].icon}</span>
            <span className='mx-3 text-sm text-mute'>vs</span>
            <span title='lawan'>{SHAPE[last.picks[opponent]].icon}</span>
          </p>
          <p className='mt-1 text-sm'>
            {last.picks[you]} lawan {last.picks[opponent]}. {lastText}
          </p>
        </div>
      )}

      {over && (
        <button
          type='button'
          onClick={r.rematch}
          disabled={r.busy}
          className='mt-5 self-center text-xs text-info hover:underline'
        >
          [main lagi]
        </button>
      )}

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}

      <p className='mt-auto pt-4 text-center text-xs text-mute'>
        Pilihanmu tersembunyi sampai lawan juga memilih. Room hilang sendiri
        setelah 2 jam.
      </p>
    </>
  );
}

export default function SuitPage() {
  const mounted = useMounted();

  return (
    <GameShell name='suit' wide>
      {mounted ? <Suit /> : null}
    </GameShell>
  );
}
