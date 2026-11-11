'use client';

import * as React from 'react';

import type { WerewolfView } from '@/lib/games/werewolf';
import { RoleId, ROLES } from '@/lib/games/werewolf-config';
import type { RoomView } from '@/lib/rooms/types';
import type { useRoom } from '@/lib/rooms/useRoom';

import Confetti from '@/components/games/Confetti';
import { seatName } from '@/components/games/lang';
import { seatColor } from '@/components/games/sekata/labels';
import RoleCard, {
  RoleBadge,
  teamColor,
} from '@/components/games/werewolf/RoleArt';

type Api = ReturnType<typeof useRoom>;

const mmss = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function useNow(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const PHASE_TITLE: Record<WerewolfView['phase'], string> = {
  roles: 'Your role',
  night: 'Night',
  morning: 'Morning',
  discussion: 'Discussion',
  voting: 'Voting',
  result: 'Judgement',
  hunter: 'A last shot',
  over: 'Game over',
};

const btn =
  'rounded-full border-2 border-white/25 px-5 py-2 text-sm font-bold text-[#efe9f7] transition-colors hover:border-white/60 disabled:opacity-40';
const primary =
  'rounded-full bg-[#d4584f] px-6 py-2.5 text-sm font-black tracking-wide text-white shadow-[0_3px_0_#8e2f29] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0';

/** One player at the table: living or fallen, and what is known of them. */
function Tile({
  seat,
  name,
  you,
  alive,
  role,
  ally,
  selected,
  onClick,
  count,
  tag,
  disabled,
}: {
  seat: number;
  name: string;
  you: boolean;
  alive: boolean;
  role: RoleId | null;
  ally?: boolean;
  selected?: boolean;
  onClick?: () => void;
  count?: number;
  tag?: string;
  disabled?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      data-seat={seat}
      data-alive={alive}
      aria-pressed={onClick ? !!selected : undefined}
      aria-label={`${name}${alive ? '' : ', eliminated'}`}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-all ${
        alive
          ? 'border-white/20 bg-black/30'
          : 'border-white/10 bg-black/40 opacity-50 grayscale'
      } ${selected ? '-translate-y-1 border-[#d4584f] bg-[#d4584f]/15 ring-2 ring-[#d4584f]' : ''} ${
        onClick && !disabled
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-white/50'
          : ''
      } ${ally ? 'ring-1 ring-[#d4584f]/70' : ''} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span
        aria-hidden
        className='relative flex size-12 items-center justify-center rounded-full text-lg font-black text-[#17181c] uppercase'
        style={{ background: seatColor(seat) }}
      >
        {name.charAt(0)}
        {!alive && (
          <span className='absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-2xl text-white'>
            ✕
          </span>
        )}
      </span>
      <span className='max-w-full truncate text-xs font-semibold'>
        {name}
        {you && <span className='ml-1 text-[10px] text-[#9be29b]'>(you)</span>}
      </span>
      {role && (
        <span className='flex items-center gap-1 text-[10px] text-[#cfcbd8]'>
          <RoleBadge role={role} size='size-5' />
          {ROLES[role].name}
        </span>
      )}
      {ally && !role && (
        <span className='text-[10px] font-bold tracking-wide text-[#e0786f] uppercase'>
          pack
        </span>
      )}
      {tag && <span className='text-[10px] text-[#cfcbd8]'>{tag}</span>}
      {count !== undefined && count > 0 && (
        <span className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-[#d4584f] text-xs font-black text-white'>
          {count}
        </span>
      )}
    </Tag>
  );
}

export default function WerewolfTable({
  r,
  view,
}: {
  r: Api;
  view: WerewolfView;
}) {
  const room = r.room as RoomView;
  const you = r.session!.you;
  const names = room.names;
  const nameOf = (s: number) => seatName('en', s, you, names);
  const me = view.me;
  const alive = me?.alive ?? false;
  const night = view.phase === 'night' || view.phase === 'roles';
  const phase = view.phase;

  const now = useNow(view.secondsLeft !== null);
  const left =
    view.secondsLeft === null
      ? null
      : Math.max(0, view.secondsLeft - Math.floor((now - r.receivedAt) / 1000));

  // what you have picked on this screen (reset when the phase moves on)
  const key = `${view.day}-${phase}-${view.stage}-${view.vote?.round ?? 0}`;
  const [pickState, setPick] = React.useState<{
    key: string;
    target: number | null;
    second: number | null;
    heal: boolean;
  }>({
    key: '',
    target: null,
    second: null,
    heal: false,
  });
  const pick =
    pickState.key === key
      ? pickState
      : { key, target: null, second: null, heal: false };
  const update = (p: Partial<typeof pickState>) =>
    setPick({ ...pick, ...p, key });
  const [history, setHistory] = React.useState(false);

  const act = (extra: Record<string, unknown>) =>
    void r.move({ type: 'night', ...extra });

  const roster = view.roster;
  const wolfAllies = me?.allies ?? [];
  const isWolf = me ? ROLES[me.role].wolfTeam : false;
  const tiles = (
    props: (
      p: (typeof roster)[number],
    ) => Partial<React.ComponentProps<typeof Tile>> = () => ({}),
  ) => (
    <div
      className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5'
      data-testid='roster'
    >
      {roster.map((p) => (
        <Tile
          key={p.seat}
          seat={p.seat}
          name={nameOf(p.seat)}
          you={p.seat === you}
          alive={p.alive}
          role={p.role}
          ally={wolfAllies.includes(p.seat)}
          {...props(p)}
        />
      ))}
    </div>
  );

  const bg = night
    ? 'bg-[radial-gradient(ellipse_at_50%_0%,#2a2357_0%,#120f26_55%,#07060f_100%)]'
    : phase === 'over'
      ? 'bg-[radial-gradient(ellipse_at_50%_0%,#3b2a4f_0%,#15111f_70%)]'
      : 'bg-[radial-gradient(ellipse_at_50%_0%,#b8762f_0%,#5a3a22_45%,#1c130f_100%)]';

  return (
    <div className='mx-auto w-full max-w-3xl'>
      {view.winner && me && view.winner.seats.includes(you) && (
        <Confetti count={60} />
      )}

      <section
        data-phase={phase}
        className={`relative overflow-hidden rounded-[1.75rem] border border-white/15 p-4 text-[#efe9f7] shadow-[inset_0_0_80px_rgb(0_0_0/0.5)] sm:p-6 ${bg}`}
      >
        {/* the sky: a moon at night, a sun by day, and fog drifting through */}
        <div aria-hidden className='pointer-events-none absolute inset-0'>
          {night ? (
            <span className='absolute top-2 left-1/2 size-10 -translate-x-1/2 rounded-full bg-[#f4efd2] shadow-[0_0_44px_12px_rgb(244_239_210/0.3)]' />
          ) : (
            <span className='absolute top-2 left-1/2 size-10 -translate-x-1/2 rounded-full bg-[#ffd36b] shadow-[0_0_50px_14px_rgb(255_211_107/0.35)]' />
          )}
          <span className='a-fog absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.07),transparent)]' />
          <span className='a-fog-slow absolute inset-x-0 bottom-10 h-32 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.05),transparent)]' />
        </div>

        <div className='relative'>
          {/* ------------------------------------------------ the header */}
          <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
            <div>
              <p className='text-[11px] font-bold tracking-[0.25em] text-[#cfcbd8] uppercase'>
                {view.day > 0 ? `Day ${view.day}` : 'Before the first night'}
              </p>
              <h1
                className='text-2xl font-black tracking-tight'
                data-testid='phase'
              >
                {PHASE_TITLE[phase]}
              </h1>
            </div>
            <div className='flex items-center gap-3'>
              {left !== null && (
                <span
                  data-testid='timer'
                  className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${
                    left <= 10
                      ? 'a-wiggle border-[#d4584f] text-[#ff9b94]'
                      : 'border-white/25'
                  }`}
                >
                  ⏱ {mmss(left)}
                </span>
              )}
              {me && (
                <span className='flex items-center gap-2 rounded-full border border-white/20 bg-black/30 py-1 pr-3 pl-1 text-xs'>
                  <RoleBadge role={me.role} size='size-7' />
                  <span>{ROLES[me.role].name}</span>
                </span>
              )}
            </div>
          </div>

          {me && !alive && phase !== 'over' && (
            <p
              className='mb-3 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-center text-sm text-[#cfcbd8]'
              role='status'
            >
              You have been eliminated. You can watch, and talk with the other
              fallen, but you cannot influence the game.
            </p>
          )}

          {/* --------------------------------------------- the phases */}
          {phase === 'roles' && me && (
            <div className='mx-auto max-w-sm space-y-4 py-2 text-center'>
              <RoleCard role={me.role} className='a-pop' />
              {wolfAllies.length > 0 && (
                <p className='text-sm' data-testid='allies'>
                  {isWolf ? 'Your pack: ' : 'You know: '}
                  <b>{wolfAllies.map(nameOf).join(', ')}</b>
                </p>
              )}
              <button
                type='button'
                onClick={() => void r.move({ type: 'ready' })}
                disabled={view.ready[you] || r.busy}
                className={primary}
              >
                {view.ready[you] ? 'Waiting for the others…' : "I'm ready"}
              </button>
              <p className='text-xs text-[#cfcbd8]'>
                {view.ready.filter(Boolean).length} of {view.players} ready.
                Night falls soon.
              </p>
            </div>
          )}

          {phase === 'night' && (
            <div className='space-y-4'>
              {me?.night && alive ? (
                <NightPanel
                  view={view}
                  nameOf={nameOf}
                  pick={pick}
                  update={update}
                  act={act}
                  busy={r.busy}
                  you={you}
                />
              ) : (
                <div className='py-8 text-center'>
                  <p className='text-xl font-bold'>
                    Night falls on the village…
                  </p>
                  <p className='mt-2 text-sm text-[#cfcbd8]'>
                    {alive
                      ? 'Close your eyes. Something stirs in the dark.'
                      : 'The night passes. You can only watch.'}
                  </p>
                </div>
              )}
              {!(me?.night && alive) && tiles(() => ({}))}
            </div>
          )}

          {phase === 'morning' && (
            <div className='space-y-4 py-2 text-center'>
              {view.morning.length === 0 ? (
                <div className='a-pop'>
                  <p className='text-3xl font-black'>
                    The village survived the night.
                  </p>
                  <p className='mt-2 text-sm text-[#f3dcc0]'>
                    Nobody was taken.
                  </p>
                </div>
              ) : (
                <div className='a-pop space-y-3'>
                  <p className='text-3xl font-black'>
                    {view.morning.length === 1
                      ? 'Someone is dead.'
                      : `${view.morning.length} are dead.`}
                  </p>
                  <ul className='flex flex-wrap justify-center gap-3'>
                    {view.morning.map((d) => (
                      <li
                        key={d.seat}
                        className='rounded-2xl border border-[#d4584f]/60 bg-black/40 px-4 py-3'
                      >
                        <p className='text-lg font-black'>{nameOf(d.seat)}</p>
                        {d.role ? (
                          <p className='mt-1 flex items-center justify-center gap-2 text-sm'>
                            <RoleBadge role={d.role} size='size-6' /> was the{' '}
                            {ROLES[d.role].name}
                          </p>
                        ) : (
                          <p className='text-xs text-[#f3dcc0]'>
                            Their role stays secret.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tiles()}
            </div>
          )}

          {phase === 'discussion' && (
            <div className='space-y-4'>
              {view.morning.length > 0 && (
                <p className='text-center text-sm text-[#f3dcc0]'>
                  Last night:{' '}
                  {view.morning.map((d) => nameOf(d.seat)).join(', ')}{' '}
                  {view.morning.length > 1 ? 'were' : 'was'} taken.
                </p>
              )}
              <p className='text-center text-sm'>
                Talk it through in the chat. Who is acting strangely?
              </p>
              {tiles(() => ({}))}
              <SeerNotes view={view} nameOf={nameOf} />
              {alive && (
                <div className='text-center'>
                  <button
                    type='button'
                    onClick={() => void r.move({ type: 'ready' })}
                    disabled={view.ready[you] || r.busy}
                    className={btn}
                  >
                    {view.ready[you]
                      ? `Waiting… ${view.ready.filter((x, i) => x && roster[i].alive).length}/${roster.filter((p) => p.alive).length} ready`
                      : 'Ready to vote'}
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === 'voting' && view.vote && (
            <div className='space-y-4'>
              <p className='text-center text-sm'>
                {view.vote.round === 2
                  ? 'The vote was tied. Choose between the tied players. '
                  : ''}
                Who is a werewolf?{' '}
                <span data-testid='progress' className='font-bold'>
                  {view.vote.voted}/{view.vote.total} voted
                </span>
                {view.config.anonymousVoting ? ' (votes are secret)' : ''}
              </p>
              {tiles((p) => {
                const votesFor = view.vote!.open
                  ? Object.values(view.vote!.open).filter((t) => t === p.seat)
                      .length
                  : 0;
                const can =
                  alive &&
                  p.alive &&
                  p.seat !== you &&
                  view.vote!.candidates.includes(p.seat);
                return {
                  onClick: alive
                    ? () => void r.move({ type: 'vote', target: p.seat })
                    : undefined,
                  disabled: !can || r.busy,
                  selected: view.vote!.mine === p.seat,
                  count: votesFor,
                };
              })}
              {view.vote.open && (
                <ul
                  className='flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[#cfcbd8]'
                  aria-label='Votes'
                >
                  {Object.entries(view.vote.open).map(([voter, target]) => (
                    <li key={voter}>
                      {nameOf(Number(voter))} →{' '}
                      {target === null ? 'abstains' : nameOf(target)}
                    </li>
                  ))}
                </ul>
              )}
              {alive && (
                <div className='flex items-center justify-center gap-3'>
                  <button
                    type='button'
                    className={btn}
                    disabled={r.busy}
                    onClick={() => void r.move({ type: 'vote', target: null })}
                  >
                    {view.vote.mine === null ? '✓ Abstaining' : 'Abstain'}
                  </button>
                  <span className='text-xs text-[#cfcbd8]'>
                    {view.vote.mine === undefined
                      ? 'You have not voted yet.'
                      : view.vote.mine === null
                        ? 'You abstained.'
                        : `You voted for ${nameOf(view.vote.mine)}.`}
                  </span>
                </div>
              )}
            </div>
          )}

          {phase === 'result' && view.lastVote && (
            <div className='space-y-4 py-2 text-center'>
              {view.lastVote.eliminated === null ? (
                <div className='a-pop'>
                  <p className='text-3xl font-black'>
                    {view.lastVote.tie
                      ? 'A tie. Nobody is eliminated.'
                      : 'Nobody was voted out.'}
                  </p>
                </div>
              ) : (
                <div className='a-pop space-y-2'>
                  <p className='text-3xl font-black'>
                    {nameOf(view.lastVote.eliminated)} is voted out.
                  </p>
                  {view.lastVote.role ? (
                    <p className='flex items-center justify-center gap-2 text-sm'>
                      <RoleBadge role={view.lastVote.role} size='size-7' />
                      They were the {ROLES[view.lastVote.role].name}.
                    </p>
                  ) : (
                    <p className='text-sm text-[#f3dcc0]'>
                      Their role stays secret.
                    </p>
                  )}
                </div>
              )}
              <Tally
                view={view}
                nameOf={nameOf}
                votes={view.lastVote.tally}
                voters={view.lastVote.votes}
              />
              {tiles()}
            </div>
          )}

          {phase === 'hunter' && view.hunter && (
            <div className='space-y-4 py-2 text-center'>
              {view.hunter.isMe ? (
                <>
                  <p className='text-2xl font-black'>
                    You are the Hunter. Take your last shot.
                  </p>
                  <p className='text-sm text-[#cfcbd8]'>
                    Pick someone to take down with you, or hold your fire.
                  </p>
                  {tiles((p) => ({
                    onClick: () => update({ target: p.seat }),
                    disabled:
                      !view.hunter!.targets.includes(p.seat) || p.seat === you,
                    selected: pick.target === p.seat,
                  }))}
                  <div className='flex justify-center gap-3'>
                    <button
                      type='button'
                      className={primary}
                      disabled={pick.target === null || r.busy}
                      onClick={() =>
                        void r.move({ type: 'hunter', target: pick.target })
                      }
                    >
                      Fire
                    </button>
                    <button
                      type='button'
                      className={btn}
                      disabled={r.busy}
                      onClick={() =>
                        void r.move({ type: 'hunter', target: null })
                      }
                    >
                      Hold fire
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className='text-2xl font-black'>
                    The Hunter, {nameOf(view.hunter.seat)}, takes a last shot…
                  </p>
                  {tiles()}
                </>
              )}
            </div>
          )}

          {phase === 'over' && view.winner && (
            <Over
              r={r}
              view={view}
              nameOf={nameOf}
              history={history}
              setHistory={setHistory}
            />
          )}
        </div>
      </section>

      {phase !== 'over' &&
        (view.history.length > 0 || view.voteHistory.length > 0) && (
          <details className='mt-3 rounded-2xl border border-line bg-surface/40 px-4 py-2 text-sm'>
            <summary className='cursor-pointer select-none'>
              Who has fallen
            </summary>
            <ul className='mt-2 space-y-1 text-xs text-[var(--mute)]'>
              {view.history.map((h, i) => (
                <li key={i}>
                  Day {h.day}: {nameOf(h.seat!)}{' '}
                  {h.kind === 'vote'
                    ? 'was voted out'
                    : h.kind === 'hunter'
                      ? 'was shot by the Hunter'
                      : 'died in the night'}
                  {h.role ? ` (${ROLES[h.role].name})` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      {r.error && (
        <p className='mt-2 text-center text-sm text-err' role='alert'>
          {r.error}
        </p>
      )}
    </div>
  );
}

function SeerNotes({
  view,
  nameOf,
}: {
  view: WerewolfView;
  nameOf: (s: number) => string;
}) {
  if (!view.me || view.me.role !== 'seer' || view.me.seen.length === 0)
    return null;
  return (
    <div
      className='rounded-xl border border-[#e7c46a]/50 bg-black/30 px-4 py-2 text-sm'
      data-testid='seer-notes'
    >
      <p className='mb-1 text-[11px] font-bold tracking-widest text-[#e7c46a] uppercase'>
        What you have seen
      </p>
      <ul className='space-y-0.5'>
        {view.me.seen.map((s) => (
          <li key={`${s.day}-${s.target}`}>
            Night {s.day}: <b>{nameOf(s.target)}</b>{' '}
            {s.wolf ? 'is a werewolf.' : 'is not a werewolf.'}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tally({
  view,
  nameOf,
  votes,
  voters,
}: {
  view: WerewolfView;
  nameOf: (s: number) => string;
  votes: Record<number, number>;
  voters: Record<number, number | null> | null;
}) {
  const rows = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0)
    return <p className='text-sm text-[#cfcbd8]'>Nobody voted.</p>;
  return (
    <ul
      className='mx-auto max-w-sm space-y-1 text-left text-sm'
      aria-label='Vote count'
    >
      {rows.map(([seat, n]) => (
        <li
          key={seat}
          className='flex items-center justify-between rounded-lg bg-black/30 px-3 py-1.5'
        >
          <span>
            {nameOf(Number(seat))}
            {voters && (
              <span className='ml-2 text-xs text-[#cfcbd8]'>
                {Object.entries(voters)
                  .filter(([, t]) => t === Number(seat))
                  .map(([v]) => nameOf(Number(v)))
                  .join(', ')}
              </span>
            )}
          </span>
          <b>{n}</b>
        </li>
      ))}
      {view.config.anonymousVoting && !voters && (
        <li className='text-center text-xs text-[#cfcbd8]'>
          Votes were secret.
        </li>
      )}
    </ul>
  );
}

function NightPanel({
  view,
  nameOf,
  pick,
  update,
  act,
  busy,
  you,
}: {
  view: WerewolfView;
  nameOf: (s: number) => string;
  pick: { target: number | null; second: number | null; heal: boolean };
  update: (p: {
    target?: number | null;
    second?: number | null;
    heal?: boolean;
  }) => void;
  act: (extra: Record<string, unknown>) => void;
  busy: boolean;
  you: number;
}) {
  const n = view.me!.night!;
  const choose = (seat: number) => update({ target: seat });
  const targetTiles = (
    mark: number | null,
    onPick: (seat: number) => void,
    badge?: (seat: number) => number,
  ) => (
    <div
      className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5'
      data-testid='targets'
    >
      {view.roster.map((p) => (
        <Tile
          key={p.seat}
          seat={p.seat}
          name={nameOf(p.seat)}
          you={p.seat === you}
          alive={p.alive}
          role={p.role}
          ally={view.me!.allies.includes(p.seat)}
          selected={mark === p.seat}
          onClick={() => onPick(p.seat)}
          disabled={!n.targets.includes(p.seat) || busy || n.acted}
          count={badge?.(p.seat)}
        />
      ))}
    </div>
  );

  if (n.kind === 'kill') {
    const mine = pick.target ?? n.choice;
    return (
      <div className='space-y-3'>
        <p className='text-center text-lg font-bold'>
          The pack hunts. Choose a victim.
        </p>
        {targetTiles(
          mine,
          choose,
          (seat) => Object.values(n.packVotes).filter((t) => t === seat).length,
        )}
        <ul
          className='flex flex-wrap justify-center gap-x-4 text-xs text-[#cfcbd8]'
          aria-label='Pack votes'
        >
          {Object.entries(n.packVotes).map(([w, t]) => (
            <li key={w}>
              {nameOf(Number(w))} → {nameOf(t)}
            </li>
          ))}
        </ul>
        {n.secondAvailable && (
          <label className='flex flex-col items-center gap-1 text-sm'>
            <span>Alpha bite: a second victim, once this game (optional)</span>
            <select
              aria-label='Second victim'
              value={pick.second ?? n.second ?? ''}
              onChange={(e) =>
                update({
                  second: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className='rounded-lg border border-white/25 bg-black/40 px-2 py-1'
            >
              <option value=''>No second bite</option>
              {n.targets
                .filter((t) => t !== mine)
                .map((t) => (
                  <option key={t} value={t}>
                    {nameOf(t)}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className='text-center'>
          <button
            type='button'
            className={primary}
            disabled={mine === null || busy}
            onClick={() =>
              act({ target: mine, second: pick.second ?? n.second })
            }
          >
            {n.acted ? 'Change the target' : 'Strike'}
          </button>
        </div>
        <p className='text-center text-xs text-[#cfcbd8]'>
          Only the pack can see this. Talk in the wolves' chat to agree on a
          target.
        </p>
      </div>
    );
  }

  if (n.kind === 'witch') {
    if (view.stage === 'main') {
      return (
        <div className='py-6 text-center'>
          <p className='text-lg font-bold'>The cauldron bubbles…</p>
          <p className='mt-1 text-sm text-[#cfcbd8]'>
            Wait for the werewolves to choose. Then you will be told who they
            chose.
          </p>
        </div>
      );
    }
    return (
      <div className='space-y-3'>
        <p className='text-center text-lg font-bold'>
          {n.victim === null
            ? 'The werewolves attacked nobody tonight.'
            : `The werewolves attacked ${nameOf(n.victim)}.`}
        </p>
        <div className='flex flex-wrap justify-center gap-3'>
          <button
            type='button'
            aria-pressed={pick.heal}
            disabled={!n.heal || n.victim === null || n.acted || busy}
            onClick={() => update({ heal: !pick.heal })}
            className={`${btn} ${pick.heal ? 'border-[#7cc576] bg-[#7cc576]/20' : ''}`}
          >
            {n.heal
              ? pick.heal
                ? '✓ Heal them'
                : 'Use healing potion'
              : 'Healing potion used'}
          </button>
        </div>
        <p className='text-center text-sm'>
          {n.poison ? 'Poison someone (optional):' : 'Poison already used.'}
        </p>
        {n.poison &&
          targetTiles(pick.target, (seat) =>
            update({ target: pick.target === seat ? null : seat }),
          )}
        <div className='text-center'>
          <button
            type='button'
            className={primary}
            disabled={busy || n.acted}
            onClick={() => act({ heal: pick.heal, poison: pick.target })}
          >
            Confirm
          </button>
        </div>
      </div>
    );
  }

  const label: Record<string, string> = {
    look: 'Choose someone to look at.',
    protect: 'Choose someone to protect tonight.',
    guard: 'Choose someone to guard tonight.',
    strike: 'You work alone. Choose your victim.',
  };
  const mine = pick.target ?? n.choice;
  const skippable = n.kind === 'protect' || n.kind === 'guard';
  return (
    <div className='space-y-3'>
      <p className='text-center text-lg font-bold'>{label[n.kind!]}</p>
      {n.acted && (
        <p className='text-center text-sm text-[#9be29b]' role='status'>
          Done for tonight. Wait for the dawn.
        </p>
      )}
      {targetTiles(mine, choose)}
      <div className='flex justify-center gap-3'>
        <button
          type='button'
          className={primary}
          disabled={mine === null || busy || n.acted}
          onClick={() => act({ target: mine })}
        >
          {n.kind === 'look'
            ? 'Look'
            : n.kind === 'strike'
              ? 'Strike'
              : n.kind === 'guard'
                ? 'Guard'
                : 'Protect'}
        </button>
        {skippable && (
          <button
            type='button'
            className={btn}
            disabled={busy || n.acted}
            onClick={() => act({ target: null })}
          >
            Skip tonight
          </button>
        )}
      </div>
      <SeerNotes view={view} nameOf={nameOf} />
    </div>
  );
}

function Over({
  r,
  view,
  nameOf,
  history,
  setHistory,
}: {
  r: Api;
  view: WerewolfView;
  nameOf: (s: number) => string;
  history: boolean;
  setHistory: (b: boolean) => void;
}) {
  const win = view.winner!;
  const reveal = view.reveal!;
  const names = {
    village: 'The Village wins!',
    wolves: 'The Werewolves win!',
    serialkiller: 'The Serial Killer wins!',
    jester: 'The Jester wins!',
  } as const;
  const color =
    win.team === 'wolves'
      ? '#d4584f'
      : win.team === 'village'
        ? '#e7c46a'
        : '#b58be0';
  const youWon = win.seats.includes(view.you ?? -1);
  const cause: Record<string, string> = {
    wolves: 'killed by the werewolves',
    poison: 'poisoned by the Witch',
    serialkiller: 'killed by the Serial Killer',
    guard: 'gave their life guarding someone',
    vote: 'voted out',
    hunter: 'shot by the Hunter',
    left: 'left the game',
  };
  const mm = `${Math.floor(view.elapsed / 60)}:${String(view.elapsed % 60).padStart(2, '0')}`;
  return (
    <div className='space-y-5'>
      <div className='text-center'>
        <p
          className='text-xs font-bold tracking-[0.25em] uppercase'
          style={{ color }}
        >
          {youWon ? 'You won' : 'You lost'}
        </p>
        <h2 className='mt-1 text-4xl font-black' style={{ color }}>
          {names[win.team]}
        </h2>
        <p className='mt-1 text-xs text-[#cfcbd8]'>
          {view.day} {view.day === 1 ? 'night' : 'nights'} · {mm}
        </p>
      </div>

      <ul className='grid gap-2 sm:grid-cols-2' aria-label='Final roles'>
        {reveal.roles.map((role, seat) => {
          const death = reveal.deaths.find((d) => d.seat === seat);
          return (
            <li
              key={seat}
              data-seat={seat}
              className={`flex items-center gap-3 rounded-xl border bg-black/30 px-3 py-2 ${
                win.seats.includes(seat)
                  ? 'border-[#e7c46a]'
                  : 'border-white/15'
              }`}
            >
              <RoleBadge role={role} size='size-10' />
              <span className='min-w-0 flex-1'>
                <span className='block truncate text-sm font-semibold'>
                  {nameOf(seat)}
                  {win.seats.includes(seat) && (
                    <span className='ml-2 text-xs text-[#e7c46a]'>winner</span>
                  )}
                </span>
                <span className='block text-xs text-[#cfcbd8]'>
                  {ROLES[role].name} ·{' '}
                  <span style={{ color: teamColor(ROLES[role].team) }}>
                    {ROLES[role].team}
                  </span>
                  {death
                    ? ` · day ${death.day}, ${cause[death.cause]}`
                    : ' · survived'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className='text-center'>
        <button
          type='button'
          className={btn}
          aria-expanded={history}
          onClick={() => setHistory(!history)}
        >
          {history ? 'Hide the history' : 'Show the history'}
        </button>
      </div>
      {history && (
        <div className='space-y-4 text-sm' data-testid='history'>
          {reveal.nights.map((n) => (
            <div
              key={n.day}
              className='rounded-xl border border-white/15 bg-black/30 px-4 py-3'
            >
              <p className='mb-1 font-bold'>Night {n.day}</p>
              <ul className='space-y-0.5 text-xs text-[#cfcbd8]'>
                <li>
                  Werewolves chose{' '}
                  {n.victim === null ? 'nobody' : nameOf(n.victim)}
                  {n.second !== null && ` and ${nameOf(n.second)}`}
                  {Object.keys(n.wolfVotes).length > 0 &&
                    ` (${Object.entries(n.wolfVotes)
                      .map(([w, t]) => `${nameOf(Number(w))}→${nameOf(t)}`)
                      .join(', ')})`}
                </li>
                {n.seer && (
                  <li>
                    The Seer looked at {nameOf(n.seer.target)}:{' '}
                    {n.seer.wolf ? 'werewolf' : 'not a werewolf'}.
                  </li>
                )}
                {n.doctor !== null && (
                  <li>The Doctor protected {nameOf(n.doctor)}.</li>
                )}
                {n.guard !== null && (
                  <li>The Bodyguard guarded {nameOf(n.guard)}.</li>
                )}
                {n.heal && <li>The Witch healed the victim.</li>}
                {n.poison !== null && (
                  <li>The Witch poisoned {nameOf(n.poison)}.</li>
                )}
                {n.sk !== null && (
                  <li>The Serial Killer struck {nameOf(n.sk)}.</li>
                )}
                <li>
                  {n.deaths.length === 0
                    ? 'Nobody died.'
                    : `Died: ${n.deaths.map((d) => `${nameOf(d.seat)} (${cause[d.cause]})`).join(', ')}.`}
                </li>
              </ul>
            </div>
          ))}
          {reveal.votes.map((v, i) => (
            <div
              key={i}
              className='rounded-xl border border-white/15 bg-black/30 px-4 py-3'
            >
              <p className='mb-1 font-bold'>
                Day {v.day} vote{v.round > 1 ? ' (second round)' : ''}
              </p>
              <ul className='space-y-0.5 text-xs text-[#cfcbd8]'>
                {Object.entries(v.tally).map(([t, c]) => (
                  <li key={t}>
                    {nameOf(Number(t))}: {c}
                    {` (${Object.entries(v.votes)
                      .filter(([, x]) => x === Number(t))
                      .map(([a]) => nameOf(Number(a)))
                      .join(', ')})`}
                  </li>
                ))}
                <li>
                  {v.eliminated === null
                    ? v.tie
                      ? 'Tied. Nobody was eliminated.'
                      : 'Nobody was eliminated.'
                    : `${nameOf(v.eliminated)} was voted out.`}
                </li>
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className='flex flex-wrap justify-center gap-2'>
        <button
          type='button'
          className={primary}
          onClick={r.rematch}
          disabled={r.busy}
        >
          Play Again
        </button>
        <button type='button' className={btn} onClick={r.leave}>
          Return to lobby
        </button>
        <a href='/games' className={btn}>
          Exit game
        </a>
      </div>
    </div>
  );
}
