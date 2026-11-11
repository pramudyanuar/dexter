'use client';

import * as React from 'react';

import { BlindMod, DeafMod, ManualPage, MonkeyView } from '@/lib/games/monkeys';
import {
  CAMPAIGN_KEY,
  Gesture,
  GESTURE_INFO,
  MODULE_INFO,
  Role,
  ROLE_INFO,
} from '@/lib/games/monkeys-config';
import type { useRoom } from '@/lib/rooms/useRoom';
import useStoredState from '@/lib/useStoredState';

import Confetti from '@/components/games/Confetti';
import { Act, BombModules } from '@/components/games/monkeys/Modules';
import MonkeyArt, { ROLE_COLOR } from '@/components/games/monkeys/MonkeyArt';
import {
  clockText,
  GestureLegend,
  GestureWheel,
  Hud,
  SignStrip,
  useClock,
  VoiceBar,
} from '@/components/games/monkeys/parts';
import useVoice from '@/components/games/monkeys/useVoice';
import useSfx from '@/components/games/sekata/useSfx';

type Api = ReturnType<typeof useRoom>;

const primary =
  'rounded-full bg-[#e0b84c] px-6 py-2.5 text-sm font-black text-[#2a1f00] shadow-[0_3px_0_#9c7d2e] transition-transform active:translate-y-px disabled:opacity-50';
const ghost =
  'rounded-full border-2 border-line-strong px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--mute)]';

/** Fingers add up: 4 is three and one. */
const numberSigns = (n: number): Gesture[] =>
  n <= 3
    ? [(['one', 'two', 'three'] as const)[n - 1]]
    : ['three', n === 4 ? 'one' : 'two'];

function Signs({ list }: { list: Gesture[] }) {
  return (
    <span className='inline-flex flex-wrap gap-1'>
      {list.map((g, i) => (
        <span
          key={i}
          title={GESTURE_INFO[g].label}
          className='flex size-9 items-center justify-center rounded-lg border border-line bg-card text-xl'
        >
          {GESTURE_INFO[g].glyph}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- the manual

function Manual({ pages }: { pages: ManualPage[] }) {
  return (
    <ol className='space-y-3'>
      {pages.map((p, n) => {
        const info = MODULE_INFO[p.kind];
        return (
          <li
            key={p.id}
            className={`rounded-2xl border border-line-strong bg-[#f2e8cf]/[0.06] p-3 ${p.solved ? 'opacity-40' : ''}`}
          >
            <div className='mb-2 flex items-center justify-between'>
              <h3 className='text-sm font-bold'>
                Page {n + 1} · {info.glyph} {info.title}
              </h3>
              {p.solved && (
                <span className='text-xs font-bold text-accent'>✓ done</span>
              )}
            </div>
            <div className='mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--mute)]'>
              Start with
              <Signs list={['warning', ...numberSigns(n + 1), 'stop']} />
            </div>
            {p.variant ? (
              <div className='space-y-2'>
                <p className='text-xs text-[var(--mute)]'>
                  This one depends on a lamp you cannot see. Give both.
                </p>
                <div className='flex flex-wrap items-center gap-2'>
                  <Signs list={['yes']} /> <span aria-hidden>→</span>
                  <Signs list={p.lit} />
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <Signs list={['no']} /> <span aria-hidden>→</span>
                  <Signs list={p.dark} />
                </div>
              </div>
            ) : (
              <Signs list={p.lit} />
            )}
            <p className='mt-2 text-[11px] text-[var(--mute)]'>
              {p.kind === 'wires' &&
                'Fingers count wires from the top. Down is the last wire. Cut them in this order.'}
              {p.kind === 'keypad' &&
                'Press the buttons that show these numbers, one by one.'}
              {p.kind === 'knobs' &&
                'One arrow per knob, left to right, then lock in.'}
              {p.kind === 'math' &&
                'Add this to the answer of the sum. A circle means add nothing.'}
              {p.kind === 'flash' &&
                'Press the pad shifted from each flash: circle = the same pad, right = next one clockwise, left = anticlockwise, down = the opposite pad.'}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- the panels

function MutePanel({
  view,
  send,
}: {
  view: MonkeyView;
  send: (g: Gesture) => void;
}) {
  const last = view.signs.at(-1);
  // on a phone the wheel is a sheet you pull up, so the manual keeps the screen
  const [open, setOpen] = React.useState(false);
  return (
    <div className='grid gap-5 lg:grid-cols-[1fr_auto]'>
      <section aria-label='Manual' className='max-lg:pb-20'>
        <h2 className='mb-2 text-sm font-semibold'>The manual</h2>
        <Manual pages={view.manual ?? []} />
      </section>
      <section
        aria-label='Gestures'
        className={`lg:block lg:w-[360px] ${
          open
            ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:rounded-t-3xl max-lg:border-t max-lg:border-line-strong max-lg:bg-card max-lg:p-4 max-lg:shadow-2xl'
            : 'max-lg:hidden'
        }`}
      >
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='text-sm font-semibold'>Your gestures</h2>
          <button
            type='button'
            onClick={() => setOpen(false)}
            className='text-xs text-[var(--mute)] lg:hidden'
          >
            Close
          </button>
        </div>
        <GestureWheel onSign={send} last={last} disabled={false} />
        <div className='mt-3'>
          <p className='mb-1 text-xs text-[var(--mute)]'>
            The Deaf Monkey sees these:
          </p>
          <SignStrip signs={view.signs} />
        </div>
      </section>
      {!open && (
        <button
          type='button'
          onClick={() => setOpen(true)}
          className='fixed right-4 bottom-4 z-30 rounded-full bg-[#e0b84c] px-5 py-3 text-sm font-black text-[#2a1f00] shadow-xl lg:hidden'
        >
          🖐 Gestures
        </button>
      )}
    </div>
  );
}

function DeafPanel({
  view,
  voice,
}: {
  view: MonkeyView;
  voice: ReturnType<typeof useVoice>;
}) {
  const last = view.signs.at(-1);
  const [legend, setLegend] = React.useState(false);
  return (
    <div className='space-y-4'>
      <VoiceBar voice={voice} dir='send' />
      <div className='grid gap-4 lg:grid-cols-[1fr_300px]'>
        <section aria-label='The bomb'>
          <BombModules mods={(view.deaf ?? []) as DeafMod[]} look='deaf' />
        </section>
        <aside
          className='space-y-3 max-lg:sticky max-lg:top-2 max-lg:z-20 max-lg:order-first'
          aria-label='The Mute Monkey'
        >
          <div className='flex items-center gap-3 rounded-2xl border border-line bg-card/95 p-3 text-center backdrop-blur lg:block lg:bg-surface/50 lg:p-4'>
            <MonkeyArt
              role='mute'
              className='size-14 shrink-0 lg:mx-auto lg:size-24'
              title='Mute Monkey'
            />
            <div className='flex h-14 w-20 shrink-0 items-center justify-center lg:mt-2 lg:h-20 lg:w-full'>
              {last ? (
                <div key={last.seq} className='a-sign'>
                  <div
                    className='text-5xl lg:text-6xl'
                    aria-live='polite'
                    aria-label={GESTURE_INFO[last.g].label}
                  >
                    {GESTURE_INFO[last.g].glyph}
                  </div>
                  <p className='hidden text-xs text-[var(--mute)] lg:block'>
                    {GESTURE_INFO[last.g].label}
                  </p>
                </div>
              ) : (
                <p className='text-xs text-[var(--mute)]'>
                  Waiting for a gesture…
                </p>
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <SignStrip signs={view.signs} />
            </div>
          </div>
          <button
            type='button'
            onClick={() => setLegend((l) => !l)}
            aria-expanded={legend}
            className='w-full rounded-xl border border-line px-3 py-2 text-left text-sm'
          >
            {legend ? '▾' : '▸'} What the gestures mean
          </button>
          {legend && (
            <div className='rounded-xl border border-line bg-surface/50 p-3'>
              <GestureLegend />
              <p className='mt-3 text-xs text-[var(--mute)]'>
                A page starts with ⚠️, a module number made of fingers (4 =
                🤟☝️) and ✋. Then the answer. 👍 means the version for a lit
                lamp follows, 👎 the version for a dark lamp.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BlindPanel({
  view,
  voice,
  act,
}: {
  view: MonkeyView;
  voice: ReturnType<typeof useVoice>;
  act: Act;
}) {
  return (
    <div className='space-y-4'>
      <VoiceBar voice={voice} dir='receive' dark />
      {/* the picture is grey and a little shaky: this monkey cannot see well */}
      <div className='a-wobble brightness-90 contrast-90 grayscale [filter:grayscale(1)_blur(0.5px)]'>
        <BombModules
          mods={(view.blind ?? []) as BlindMod[]}
          look='blind'
          act={act}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- briefing

const TIPS: Record<Role, string[]> = {
  blind: [
    'You are the hands. Only you can touch the bomb.',
    'You see grey shapes, no colours and no words. Listen to the Deaf Monkey’s voice.',
    'You cannot answer out loud, so do what you are told and the team will see it.',
  ],
  mute: [
    'You hold the manual. Only you can read it.',
    'You cannot speak or write. Tap the gesture wheel: the Deaf Monkey sees every gesture.',
    'Work through the pages in order. Start each page with ⚠️, the page number in fingers, then ✋.',
  ],
  deaf: [
    'You are the eyes and the voice. You see the bomb in full colour.',
    'Watch the Mute Monkey’s gestures and tell the Blind Monkey out loud what to do.',
    'You hear nothing, so nobody can answer you. Speak clearly, and keep the microphone on.',
  ],
};

function Training({ role }: { role: Role }) {
  const [signs, setSigns] = React.useState<Gesture[]>([]);
  const [cut, setCut] = React.useState<boolean[]>([false, false, false]);
  if (role === 'mute')
    return (
      <div>
        <p className='mb-2 text-xs text-[var(--mute)]'>
          Try the wheel. Nothing is sent yet.
        </p>
        <GestureWheel
          onSign={(g) => setSigns((s) => [...s, g].slice(-6))}
          last={
            signs.length
              ? { seq: signs.length, g: signs.at(-1)!, at: 0 }
              : undefined
          }
          disabled={false}
        />
        <p className='mt-2 text-center text-xs text-[var(--mute)]'>
          {signs.map((g) => GESTURE_INFO[g].glyph).join(' ') || 'Tap a gesture'}
        </p>
      </div>
    );
  if (role === 'blind')
    return (
      <div className='a-wobble [filter:grayscale(1)_blur(0.5px)]'>
        <p className='mb-2 text-xs text-[var(--mute)]'>
          This is how you see things. Try cutting a wire.
        </p>
        <BombModules
          mods={[{ id: 0, kind: 'wires', solved: false, count: 3, cut }]}
          look='blind'
          act={(_m, _a, e) => setCut((c) => c.map((x, k) => x || k === e?.i))}
        />
      </div>
    );
  return (
    <div className='space-y-3'>
      <p className='text-xs text-[var(--mute)]'>
        These are the Mute Monkey’s gestures:
      </p>
      <GestureLegend />
    </div>
  );
}

function Briefing({
  view,
  api,
  voice,
  seat,
}: {
  view: MonkeyView;
  api: Api;
  voice: ReturnType<typeof useVoice>;
  seat: number;
}) {
  const role = view.role as Role;
  const info = ROLE_INFO[role];
  const ready = view.ready[seat];
  return (
    <div className='mx-auto w-full max-w-4xl'>
      <header className='mb-5 text-center'>
        <p className='text-xs tracking-[0.3em] text-[var(--mute)] uppercase'>
          You are the
        </p>
        <h1 className='text-4xl font-black' style={{ color: ROLE_COLOR[role] }}>
          {info.title}
        </h1>
        <MonkeyArt
          role={role}
          className='mx-auto mt-2 size-28'
          title={info.title}
        />
      </header>
      <div className='grid gap-4 md:grid-cols-2'>
        <section className='rounded-2xl border border-line bg-surface/50 p-4'>
          <h2 className='mb-2 text-sm font-semibold'>Your job</h2>
          <ul className='list-disc space-y-1.5 pl-5 text-sm'>
            {TIPS[role].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className='mt-3 text-xs text-[var(--mute)]'>{info.cannot}</p>
          {view.voice && (
            <div className='mt-3'>
              <VoiceBar
                voice={voice}
                dir={view.voice.dir}
                dark={role === 'blind'}
              />
            </div>
          )}
        </section>
        <section className='rounded-2xl border border-line bg-surface/50 p-4'>
          <h2 className='mb-2 text-sm font-semibold'>Try it</h2>
          <Training role={role} />
        </section>
      </div>
      <section className='mt-4 flex flex-wrap items-center justify-center gap-4 text-sm'>
        {view.roles.map((r, s) => (
          <span key={s} className='flex items-center gap-2'>
            <MonkeyArt role={r} className='size-8' />
            <span
              className={view.ready[s] ? 'text-accent' : 'text-[var(--mute)]'}
            >
              {ROLE_INFO[r].title} {view.ready[s] ? '✓' : '…'}
            </span>
          </span>
        ))}
      </section>
      <p className='mt-4 text-center text-xs text-[var(--mute)]'>
        {view.mode === 'practice'
          ? 'Practice'
          : view.mode === 'campaign'
            ? `Campaign level ${view.level}`
            : view.mode === 'endless'
              ? 'Endless'
              : 'Custom'}
        {' · '}
        {view.modules.length} modules · {clockText(view.remaining)} ·{' '}
        {view.allowed} mistakes allowed
      </p>
      <div className='mt-4 flex justify-center'>
        <button
          type='button'
          className={primary}
          disabled={ready || api.busy}
          onClick={() => api.move({ t: 'ready' })}
        >
          {ready ? 'Waiting for the others…' : 'I’m ready'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the end

function Result({ view, api }: { view: MonkeyView; api: Api }) {
  const won = view.phase === 'won';
  const [progress, setProgress] = useStoredState<{
    cleared: number;
    endless: number;
  }>(CAMPAIGN_KEY, { cleared: 0, endless: 0 });
  const saved = React.useRef(false);
  React.useEffect(() => {
    if (saved.current) return;
    if (won && view.mode === 'campaign' && view.level > progress.cleared) {
      saved.current = true;
      setProgress({ ...progress, cleared: view.level });
    }
    if (view.mode === 'endless' && view.defused > progress.endless) {
      saved.current = true;
      setProgress({ ...progress, endless: view.defused });
    }
  }, [won, view.mode, view.level, view.defused, progress, setProgress]);

  const mood = won ? 'cheer' : 'boom';
  const next = won && view.mode === 'campaign' && view.level < view.levels;
  const title = won
    ? 'Bomb defused!'
    : view.phase === 'abandoned'
      ? 'The team broke up'
      : 'BOOM!';
  const why =
    view.cause === 'time'
      ? 'The clock ran out.'
      : view.cause === 'mistakes'
        ? 'One mistake too many.'
        : view.cause === 'left'
          ? 'A monkey did not come back.'
          : '';

  return (
    <div className='relative mx-auto w-full max-w-xl text-center'>
      {won && <Confetti />}
      {!won && view.phase === 'exploded' && (
        <span
          aria-hidden
          className='a-boom pointer-events-none fixed top-1/2 left-1/2 z-40 -mt-12 -ml-12 size-24 rounded-full bg-[#ffb347]'
        />
      )}
      <div className={`flex justify-center gap-3 ${won ? '' : 'a-shake'}`}>
        {view.roles.map((r, i) => (
          <MonkeyArt key={i} role={r} mood={mood} className='size-24' />
        ))}
      </div>
      <h1
        className={`a-pop mt-4 text-5xl font-black ${won ? 'text-accent' : 'text-err'}`}
      >
        {title}
      </h1>
      <p className='mt-1 text-sm text-[var(--mute)]'>{why}</p>
      <dl className='mx-auto mt-5 grid max-w-sm grid-cols-3 gap-2 text-sm'>
        <div className='rounded-xl border border-line bg-surface/50 p-3'>
          <dt className='text-[11px] text-[var(--mute)] uppercase'>Mistakes</dt>
          <dd className='text-xl font-bold'>{view.mistakes}</dd>
        </div>
        <div className='rounded-xl border border-line bg-surface/50 p-3'>
          <dt className='text-[11px] text-[var(--mute)] uppercase'>
            {view.mode === 'endless' ? 'Defused' : 'Time left'}
          </dt>
          <dd className='text-xl font-bold'>
            {view.mode === 'endless'
              ? view.defused
              : won
                ? `${view.finishedWith}s`
                : '–'}
          </dd>
        </div>
        <div className='rounded-xl border border-line bg-surface/50 p-3'>
          <dt className='text-[11px] text-[var(--mute)] uppercase'>
            {view.mode === 'endless' ? 'Best' : 'Level'}
          </dt>
          <dd className='text-xl font-bold'>
            {view.mode === 'endless'
              ? Math.max(progress.endless, view.defused)
              : view.mode === 'campaign'
                ? view.level
                : '–'}
          </dd>
        </div>
      </dl>
      <div className='mt-6 flex flex-wrap justify-center gap-2'>
        <button
          type='button'
          className={primary}
          disabled={api.busy}
          onClick={api.rematch}
        >
          {next ? 'Next level' : won ? 'Play again' : 'Try again'}
        </button>
        <button type='button' className={ghost} onClick={api.leave}>
          Leave
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the table

export default function MonkeyTable({ r, view }: { r: Api; view: MonkeyView }) {
  const seat = r.session?.you ?? 0;
  const role = view.role;
  const sfx = useSfx();
  const voice = useVoice(
    r.session ? { code: r.session.code, token: r.session.token } : null,
    // the call lasts as long as the team is together
    view.phase === 'abandoned' ? null : view.voice,
  );
  const ms = useClock(
    view.remaining,
    r.receivedAt,
    view.paused || view.phase !== 'playing',
  );

  // Only the Mute Monkey can hear the bomb: the other two get it by eye alone
  const hears = role === 'mute' || role === null;
  const seq = view.event?.seq ?? 0;
  const lastSeq = React.useRef(seq);
  React.useEffect(() => {
    if (seq === lastSeq.current) return;
    lastSeq.current = seq;
    if (!hears || !view.event) return;
    sfx.play(
      view.event.kind === 'bad'
        ? 'bad'
        : view.event.kind === 'ok'
          ? 'cut'
          : 'ok',
    );
  }, [seq, hears, view.event, sfx]);
  const secs = Math.ceil(ms / 1000);
  React.useEffect(() => {
    if (
      hears &&
      view.phase === 'playing' &&
      !view.paused &&
      secs > 0 &&
      secs <= 10
    )
      sfx.play('tick');
  }, [secs, hears, view.phase, view.paused, sfx]);
  const phaseSeen = React.useRef(view.phase);
  React.useEffect(() => {
    if (phaseSeen.current === view.phase) return;
    phaseSeen.current = view.phase;
    if (!hears) return;
    if (view.phase === 'won') sfx.play('win');
    if (view.phase === 'exploded') sfx.play('boom');
  }, [view.phase, hears, sfx]);

  const act: Act = (m, a, extra) => void r.move({ t: 'act', m, a, ...extra });
  const send = (g: Gesture) => void r.move({ t: 'gesture', g });

  if (
    view.phase === 'won' ||
    view.phase === 'exploded' ||
    view.phase === 'abandoned'
  )
    return <Result view={view} api={r} />;

  if (!role)
    return (
      <p className='py-16 text-center text-sm text-[var(--mute)]'>Watching…</p>
    );

  if (view.phase === 'briefing')
    return <Briefing view={view} api={r} voice={voice} seat={seat} />;

  const away = r.room?.leaving ?? [];
  const label =
    view.mode === 'endless'
      ? `Endless · bomb ${view.bomb + 1}`
      : view.mode === 'campaign'
        ? `Level ${view.level}`
        : view.mode === 'practice'
          ? 'Practice bomb'
          : 'Custom bomb';

  return (
    <div key={view.bomb} className='mx-auto w-full max-w-5xl'>
      {/* a flash of green or red for every move, for those who cannot hear it */}
      {view.event && (
        <span
          key={view.event.seq}
          aria-hidden
          className={`pointer-events-none fixed inset-0 z-30 ${
            view.event.kind === 'bad'
              ? 'a-fx bg-err/25'
              : view.event.kind === 'ok'
                ? ''
                : 'a-fx bg-accent/15'
          }`}
        />
      )}
      <Hud
        ms={ms}
        total={view.total}
        mistakes={view.mistakes}
        allowed={view.allowed}
        role={role}
        label={`${label} · ${view.modules.filter((m) => m.solved).length}/${view.modules.length} defused`}
        penalty={view.penalty}
      />
      {r.error && (
        <p role='alert' className='mb-3 text-center text-xs text-err'>
          {r.error}
        </p>
      )}
      {view.paused && (
        <div
          role='alert'
          className='a-slide-up mb-4 rounded-xl border border-[#e0b84c]/60 bg-[#e0b84c]/10 px-4 py-3 text-center text-sm'
        >
          ⏸ The clock is paused
          {away.length > 0 &&
            `: waiting for ${away.map((a) => ROLE_INFO[view.roles[a.seat]].title).join(', ')} (${Math.max(...away.map((a) => a.goneIn))}s)`}
        </div>
      )}
      {role === 'mute' && <MutePanel view={view} send={send} />}
      {role === 'deaf' && <DeafPanel view={view} voice={voice} />}
      {role === 'blind' && <BlindPanel view={view} voice={voice} act={act} />}
    </div>
  );
}
