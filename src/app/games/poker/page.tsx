'use client';

import useMounted from '@/hooks/useMounted';

import GameShell from '@/features/games/components/GameShell';
import PlayingCard, {
  CardBack,
} from '@/features/games/components/remo/PlayingCard';
import { POKER_HANDS, type PokerView } from '@/features/games/logic/poker';
import RoomChat from '@/features/rooms/components/RoomChat';
import RoomGate, {
  Rematch,
  seatTitle,
} from '@/features/rooms/components/RoomGate';
import { useRoom } from '@/features/rooms/useRoom';

const STREET = {
  'pre-flop': 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

function PokerRoom() {
  const r = useRoom<PokerView>('poker');
  return (
    <>
      <RoomGate
        r={r}
        blurb='Texas Hold’em untuk 2–6 pemain. Setiap ronde memakai chip virtual dan taruhan batas tetap.'
      >
        {({ room, you }) => {
          const view = room.state;
          const name = (seat: number) => seatTitle(seat, you, room.names);
          const mine = view.players[you];
          const actionLabel = {
            check: 'Check',
            call: `Call · ${view.toCall}`,
            raise: `${view.toCall || mine?.bet ? 'Raise' : 'Bet'} · ${view.raiseCost}`,
            fold: 'Fold',
          };
          return (
            <section
              aria-label='Meja poker'
              className='mx-auto w-full max-w-2xl'
            >
              <div className='rounded-2xl border border-emerald-800 bg-[#103b2f] px-2 py-5 text-white sm:p-6'>
                <header className='mb-4 flex items-center justify-between gap-2 px-1 text-sm'>
                  <h1 className='font-semibold'>Texas Hold’em</h1>
                  <p className='text-emerald-100/80'>
                    Ronde {view.hand} · {STREET[view.street]}
                  </p>
                </header>
                <div
                  className='flex min-h-[4.4rem] flex-wrap justify-center gap-1 sm:gap-2'
                  aria-label='Kartu di meja'
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const card = view.board[i];
                    return card ? (
                      <PlayingCard key={i} id={card} size='sm' />
                    ) : (
                      <span
                        key={i}
                        aria-hidden
                        className='h-[4.4rem] w-[3.1rem] rounded-lg border border-emerald-100/25 bg-emerald-950/25'
                      />
                    );
                  })}
                </div>
                <p className='mt-3 text-center text-sm text-emerald-50'>
                  Pot <strong className='text-xl'>{view.pot}</strong> chip
                </p>
                <ul
                  className='mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3'
                  aria-label='Pemain poker'
                >
                  {view.players.map((player, seat) => (
                    <li
                      key={seat}
                      className={`min-w-0 rounded-lg border p-2.5 ${view.turn === seat ? 'border-amber-300 bg-emerald-950' : 'border-emerald-100/15 bg-emerald-950/40'}`}
                    >
                      <p className='text-sm font-semibold wrap-break-word'>
                        {name(seat)}
                        {view.button === seat && (
                          <span className='ml-1.5 text-xs font-normal text-amber-200'>
                            Dealer
                          </span>
                        )}
                      </p>
                      <p className='text-xs text-emerald-100/80'>
                        {player.chips} chip
                        {room.out[seat]
                          ? ' · Keluar'
                          : player.folded
                            ? ' · Fold'
                            : player.bet
                              ? ` · Masuk ${player.bet}`
                              : ''}
                      </p>
                      {seat !== you && !player.folded && (
                        <div className='mt-2 flex gap-1'>
                          {player.cards.length ? (
                            player.cards.map((card) => (
                              <PlayingCard key={card} id={card} size='xs' />
                            ))
                          ) : (
                            <>
                              <CardBack size='xs' />
                              <CardBack size='xs' />
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className='py-5 text-center'>
                {mine && mine.cards.length > 0 && (
                  <div
                    aria-label='Kartumu'
                    className='mb-3 flex justify-center gap-2'
                  >
                    {mine.cards.map((card) => (
                      <PlayingCard key={card} id={card} size='sm' />
                    ))}
                  </div>
                )}
                {view.result ? (
                  <>
                    <p role='status' className='text-sm'>
                      {view.result.category === null
                        ? 'Menang lewat fold'
                        : POKER_HANDS[view.result.category]}
                      {' · '}
                      {view.result.winners
                        .map(
                          ({ seat, chips }) => `${name(seat)} +${chips} chip`,
                        )
                        .join(', ')}
                    </p>
                    <Rematch r={r} />
                  </>
                ) : (
                  <>
                    <p aria-live='polite' className='text-sm text-mute'>
                      {view.turn === you
                        ? 'Giliranmu'
                        : view.turn !== null
                          ? `Giliran ${name(view.turn)}`
                          : null}
                    </p>
                    <div className='mt-3 flex flex-wrap justify-center gap-2'>
                      {view.actions.map((type) => (
                        <button
                          key={type}
                          type='button'
                          disabled={r.busy || room.out[you]}
                          onClick={() =>
                            r.move({
                              type,
                              hand: view.hand,
                              turnNumber: view.turnNumber,
                            })
                          }
                          className='rounded-lg border border-line-strong bg-card px-4 py-2 text-sm font-medium hover:border-accent disabled:opacity-50'
                        >
                          {actionLabel[type]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        }}
      </RoomGate>
      <RoomChat game='poker' names={r.room?.names} />
    </>
  );
}

export default function PokerPage() {
  const mounted = useMounted();
  return (
    <GameShell name='poker' fluid>
      <div className='xl:pr-[21rem]'>
        <div className='mx-auto w-full max-w-3xl'>
          {mounted && <PokerRoom />}
        </div>
      </div>
    </GameShell>
  );
}
