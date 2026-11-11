'use client';

import * as React from 'react';

import { Pick, PICKS, SuitView } from '@/lib/games/suit';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import RoomBar from '@/components/games/RoomBar';
import { NameEditor, PlayerStrip } from '@/components/games/RoomGate';
import RoomLobby from '@/components/games/RoomLobby';

const LABEL: Record<Pick, string> = {
  batu: 'batu',
  gunting: 'gunting',
  kertas: 'kertas',
};

/** Monochrome rock / scissors / paper marks, drawn as SVG so they scale cleanly. */
function ShapeIcon({ pick, className }: { pick: Pick; className?: string }) {
  const common = {
    viewBox: '0 0 48 48',
    className,
    'aria-hidden': true as const,
  };
  if (pick === 'batu') {
    return (
      <svg {...common} fill='currentColor'>
        <path d='M24 8c8 0 14 6 14 14.5C38 32 31.5 40 24 40S10 32 10 22.5C10 14 16 8 24 8Z' />
      </svg>
    );
  }
  if (pick === 'gunting') {
    return (
      <svg
        {...common}
        fill='none'
        stroke='currentColor'
        strokeWidth={3}
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <circle cx='12' cy='34' r='5' />
        <circle cx='12' cy='14' r='5' />
        <path d='M16 31 40 11M16 17l24 20' />
      </svg>
    );
  }
  return (
    <svg
      {...common}
      fill='none'
      stroke='currentColor'
      strokeWidth={3}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M14 9h14l6 6v24H14z' />
      <path d='M28 9v6h6' />
    </svg>
  );
}

/** Seconds each player gets to choose before a random pick is made for them. */
const PICK_SECONDS = 10;

/** Shrinking bar + number. Calls onExpire once when time runs out. */
function RoundTimer({
  roundKey,
  onExpire,
}: {
  roundKey: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = React.useState(PICK_SECONDS);
  const expire = React.useRef(onExpire);
  React.useEffect(() => {
    expire.current = onExpire;
  });

  React.useEffect(() => {
    const end = Date.now() + PICK_SECONDS * 1000;
    const timer = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      setLeft(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(timer);
        expire.current();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [roundKey]);

  const urgent = left <= 3;
  return (
    <div className='mb-4' data-testid='round-timer'>
      <div className='h-2 overflow-hidden rounded-full bg-line'>
        <div
          key={roundKey}
          className={`h-full rounded-full ${urgent ? 'bg-err' : 'bg-accent'}`}
          style={{
            width: '100%',
            animation: `suit-shrink ${PICK_SECONDS}s linear forwards`,
          }}
        />
      </div>
      <p
        className={`mt-1 text-center text-xs ${
          urgent ? 'a-tick font-bold text-err' : 'text-mute'
        }`}
      >
        {left} detik
      </p>
    </div>
  );
}

/** Two shaking fists, then the real hand pops out. */
function Hand({ pick, delay = 0 }: { pick: Pick; delay?: number }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setShown(true), 700 + delay);
    return () => clearTimeout(t);
  }, [delay]);
  return shown ? (
    <ShapeIcon pick={pick} className='a-reveal inline-block size-12' />
  ) : (
    <span
      className='a-fist inline-block'
      style={{ animationDelay: `${delay}ms` }}
    >
      <ShapeIcon pick='batu' className='size-12' />
    </span>
  );
}

function Suit() {
  const r = useRoom<SuitView>('suit');

  if (!r.session) {
    return (
      <RoomLobby
        blurb='# Batu, gunting, kertas untuk dua pemain di device berbeda. Siapa yang menang dua ronde lebih dulu, menang.'
        busy={r.busy}
        error={r.error}
        name={r.name}
        onName={r.setName}
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

      {room && (
        <PlayerStrip names={room.names} joined={room.joined} you={you} />
      )}
      {room?.status === 'waiting' && <NameEditor r={r} />}

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

      {over && state?.winner === you && <Confetti />}

      <p
        key={`${over}-${state?.myPick}-${state?.round}`}
        className='a-slide-up mb-4 text-center text-sm'
        aria-live='polite'
      >
        {status}
      </p>

      {room?.status === 'playing' && state && !state.myPick && (
        <RoundTimer
          key={state.round}
          roundKey={`${state.round}`}
          onExpire={() =>
            r.move({ pick: PICKS[Math.floor(Math.random() * PICKS.length)] })
          }
        />
      )}

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
                className={`group flex flex-col items-center gap-2 rounded-xl border py-6 transition duration-200 ${
                  chosen
                    ? 'a-pop border-accent bg-accent/12 shadow-lg'
                    : 'border-line bg-card enabled:hover:-translate-y-1 enabled:hover:border-line-strong enabled:hover:shadow-lg enabled:active:scale-95'
                } disabled:cursor-default ${
                  over || state.myPick ? (chosen ? '' : 'opacity-40') : ''
                }`}
              >
                <ShapeIcon
                  pick={pick}
                  className='size-10 transition-transform group-enabled:group-hover:-translate-y-0.5'
                />
                <span className='text-xs'>{LABEL[pick]}</span>
              </button>
            );
          })}
        </div>
      )}

      {last && (
        <div
          key={`round-${state.round}-${state.scores.join('-')}`}
          className='mt-5 text-center'
          data-testid='last-round'
        >
          <p className='text-xs text-mute'>ronde sebelumnya</p>
          <p className='mt-2 flex items-center justify-center text-5xl'>
            <span
              title='kamu'
              className={`inline-block ${
                last.winner === you ? 'a-bob' : ''
              } ${last.winner === opponent ? 'opacity-50' : ''}`}
            >
              <Hand pick={last.picks[you]} />
            </span>
            <span className='mx-5 text-sm text-mute'>vs</span>
            <span
              title='lawan'
              className={`inline-block ${
                last.winner === opponent ? 'a-bob' : ''
              } ${last.winner === you ? 'opacity-50' : ''}`}
            >
              <Hand pick={last.picks[opponent]} delay={250} />
            </span>
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
          main lagi
        </button>
      )}

      {r.error && <p className='mt-3 text-center text-err'>{r.error}</p>}

      <p className='mt-auto pt-4 text-center text-xs text-mute'>
        Pilihanmu tersembunyi sampai lawan juga memilih. Kamu punya 10 detik per
        ronde, lewat itu dipilihkan acak. Room hilang sendiri setelah 2 jam.
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
