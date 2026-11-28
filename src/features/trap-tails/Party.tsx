'use client';

import { ArrowLeft, Camera, Pause, Play } from 'lucide-react';
import {
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import style from './party.module.css';
import stage from './stage.module.css';

import ConfirmDialog from '@/components/ConfirmDialog';
import { shouldIgnoreGameKey } from '@/components/games/snake/controls';

import { seatsArt } from './art';
import { HEIGHT, WIDTH } from './content';
import { copy } from './copy';
import {
  BLAST,
  type ItemId,
  itemRect,
  ITEMS,
  LIFT_TRAVEL,
  type Part,
  previewPlacement,
  protectedZones,
  RAIL_TRAVEL,
} from './items';
import {
  type Action,
  CRATE_OPEN_TICK,
  dispatchMatch,
  isClaimed,
  type Match,
  newMatch,
  type Rules,
  scoreTotal,
  tickParty,
} from './match';
import { type Direction, type Point } from './mechanisms';
import { type Frame, newRun, STEP } from './movement';
import {
  categoryColor,
  categoryCopy,
  errorCopy,
  itemCopy,
  outcomeCopy,
  partyCopy as t,
  phaseCopy,
} from './party-copy';
import type { makeRenderer } from './render';
import Sprite from './Sprite';

const defaultRules: Rules = {
  seats: 2,
  rounds: 10,
  target: 600,
  doubleDraft: true,
};
const controls = [
  {
    left: 'KeyA',
    right: 'KeyD',
    up: 'KeyW',
    down: 'KeyS',
    sprint: 'ShiftLeft',
    confirm: 'KeyF',
    label: 'A D · W · Shift kiri',
    place: 'F',
  },
  {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    sprint: 'ShiftRight',
    confirm: 'Slash',
    label: '← → · ↑ · Shift kanan',
    place: '/',
  },
  {
    left: 'KeyJ',
    right: 'KeyL',
    up: 'KeyI',
    down: 'KeyK',
    sprint: 'KeyU',
    confirm: 'KeyO',
    label: 'J L · I · U',
    place: 'O',
  },
  {
    left: 'Numpad4',
    right: 'Numpad6',
    up: 'Numpad8',
    down: 'Numpad2',
    sprint: 'Numpad5',
    confirm: 'NumpadEnter',
    label: 'Num 4 6 · 8 · 5',
    place: 'Num Enter',
  },
];
const names = seatsArt.map((s, i) => `${s.name} ${i + 1}`);
const second = (value: number) => Math.ceil(value / 60);
const initialCursors = () =>
  seatsArt.map((_, i) => ({ x: 8 + i * 2.5, y: 7 + i, turn: 0 as Direction }));
const visibleDraft = (m: Match) =>
  m.offers.filter((offer) => !isClaimed(m.picks, offer.id));
const percent = (part: { x: number; y: number }) => ({
  left: `${(part.x / WIDTH) * 100}%`,
  top: `${(1 - part.y / HEIGHT) * 100}%`,
});
const area = (r: { x: number; y: number; w: number; h: number }) => ({
  ...percent({ x: r.x, y: r.y + r.h }),
  width: `${(r.w / WIDTH) * 100}%`,
  height: `${(r.h / HEIGHT) * 100}%`,
});

function DraftSprite({ item }: { item: ItemId }) {
  if (item === 'rail')
    return (
      <span aria-hidden='true' className={style.railToken}>
        <Sprite name='wood' />
        <Sprite name='saw' />
      </span>
    );
  if (item === 'lift')
    return (
      <span aria-hidden='true' className={style.liftToken}>
        <Sprite name='iron' />
        <Sprite name='wood' />
      </span>
    );
  return <Sprite name={ITEMS[item].art} />;
}

export default function Party({ onBack }: { onBack: () => void }) {
  const [rules, setRules] = useState(defaultRules);
  const [match, setMatch] = useState<Match | null>(null);
  const [cursors, setCursors] = useState(initialCursors);
  const [seat, setSeat] = useState(0);
  const [focus, setFocus] = useState([0, 0, 0, 0]);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'unavailable' | 'contextLost'
  >('loading');
  const [attempt, setAttempt] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLElement>(null);
  const live = useRef<{
    match: Match | null;
    paused: boolean;
    leaving: boolean;
    fixed: boolean;
  }>({ match: null, paused: false, leaving: false, fixed: false });
  const pointer = useRef({ cursors: initialCursors(), focus: [0, 0, 0, 0] });

  function updateCursors(next: typeof cursors) {
    pointer.current.cursors = next;
    setCursors(next);
  }

  function updateChoice(next: number[]) {
    pointer.current.focus = next;
    setFocus(next);
  }

  const write = useCallback((next: Match, notify: boolean) => {
    if (live.current.match?.serial !== next.serial) {
      setSeat((next.round + next.box - 2) % next.rules.seats);
      pointer.current = { cursors: initialCursors(), focus: [0, 0, 0, 0] };
      setCursors(pointer.current.cursors);
      setFocus(pointer.current.focus);
    }
    live.current.match = next;
    if (notify) setMatch(next);
  }, []);

  function begin() {
    live.current.paused = false;
    setPaused(false);
    field.current?.focus();
    write(newMatch(rules, Math.floor(Math.random() * 0x100000000)), true);
  }

  function dispatch(action: Action) {
    const state = live.current.match;
    if (!state || live.current.paused || live.current.leaving) return;
    const next = dispatchMatch(state, action);
    if (next === state) return;
    write(next, true);
    if (next.serial === state.serial) {
      const eligible =
        state.phase === 'draft'
          ? next.picks.map((p) => p === 'pending')
          : next.done.map((done) => !done);
      const after = eligible.findIndex(
        (_, i) => eligible[(action.seat + i + 1) % eligible.length],
      );
      if (after >= 0) setSeat((action.seat + after + 1) % eligible.length);
    }
  }

  function moveCursor(i: number, dx: number, dy: number) {
    updateCursors(
      pointer.current.cursors.map((c, index) =>
        i === index
          ? {
              ...c,
              x: Math.max(0, Math.min(WIDTH, c.x + dx)),
              y: Math.max(0, Math.min(HEIGHT, c.y + dy)),
            }
          : c,
      ),
    );
  }

  function rotate(i: number, flip = false) {
    const m = live.current.match;
    const token = m?.picks[i];
    if (!token || token === 'pending' || m?.done[i]) return;
    const directions = ITEMS[token.item].turns;
    updateCursors(
      pointer.current.cursors.map((c, index) => {
        if (i !== index) return c;
        const position = directions.findIndex((d) => d === c.turn);
        const opposite = ((c.turn + 2) % 4) as Direction;
        return {
          ...c,
          turn:
            flip && directions.some((d) => d === opposite)
              ? opposite
              : directions[(position + 1) % directions.length],
        };
      }),
    );
  }

  const onKey = useRef<(event: KeyboardEvent, i: number) => void>(() => {});
  useEffect(() => {
    onKey.current = (event, i) => {
      const state = live.current.match;
      const c = controls[i];
      if (!state || live.current.paused || live.current.leaving) return;
      const { code } = event;
      if (
        state.phase === 'draft' &&
        state.picks[i] === 'pending' &&
        state.left <= CRATE_OPEN_TICK
      ) {
        const options = visibleDraft(state);
        if (code === c.up && !event.repeat) {
          const choice = options[pointer.current.focus[i] % options.length];
          if (choice)
            dispatch({
              type: 'claim',
              serial: state.serial,
              seat: i,
              token: choice.id,
            });
        } else if (code === c.down && !event.repeat)
          dispatch({
            type: 'claim',
            serial: state.serial,
            seat: i,
            token: null,
          });
        else if ((code === c.left || code === c.right) && options.length) {
          updateChoice(
            pointer.current.focus.map((n, index) =>
              index === i
                ? (n + options.length + (code === c.right ? 1 : -1)) %
                  options.length
                : n,
            ),
          );
        }
      } else if (state.phase === 'build' && !state.done[i]) {
        if (code === c.confirm && !event.repeat)
          dispatch({
            type: 'place',
            serial: state.serial,
            seat: i,
            position: pointer.current.cursors[i],
          });
        else if (code === c.sprint && !event.repeat) rotate(i);
        else if (
          code === c.left ||
          code === c.right ||
          code === c.up ||
          code === c.down
        )
          moveCursor(
            i,
            code === c.right ? 0.5 : code === c.left ? -0.5 : 0,
            code === c.up ? 0.5 : code === c.down ? -0.5 : 0,
          );
      }
    };
  });

  useEffect(() => {
    const surface = canvas.current!;
    const abort = new AbortController();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: Awaited<ReturnType<typeof makeRenderer>>;
    let raf = 0;
    let last = 0;
    let accumulator = 0;
    const keys = new Set<string>();
    const jumps = new Set<number>();
    const idle = newMatch(defaultRules, 0);
    const clear = () => {
      keys.clear();
      jumps.clear();
      last = 0;
    };
    const pause = (value: boolean) => {
      live.current.paused = value;
      setPaused(value);
      clear();
    };
    function keyDown(event: KeyboardEvent) {
      if (
        shouldIgnoreGameKey(event) ||
        live.current.leaving ||
        (event.target instanceof Element &&
          event.target.closest('dialog[open]'))
      )
        return;
      const m = live.current.match;
      if (!m) return;
      if (event.code === 'Escape' && !event.repeat) {
        event.preventDefault();
        pause(!live.current.paused);
        return;
      }
      if (live.current.paused) return;
      const i = controls.findIndex(
        (c, index) =>
          index < m.rules.seats &&
          [c.left, c.right, c.up, c.down, c.sprint, c.confirm].includes(
            event.code,
          ),
      );
      if (i < 0) return;
      event.preventDefault();
      if (m.phase === 'race') {
        if (event.code === controls[i].up && !event.repeat) jumps.add(i);
        keys.add(event.code);
      } else onKey.current(event, i);
    }
    const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const lose = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      setStatus('contextLost');
    };
    surface.addEventListener('webglcontextlost', lose);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);

    let stillCourse = idle.course;
    let stillFrame: Frame = newRun(stillCourse);
    let previousRace = idle.race;
    let animationAge = 0;
    function animate(now: number) {
      const dt = last ? Math.min((now - last) / 1000, STEP * 5) : 0;
      last = now;
      const current = live.current;
      animationAge += dt;
      if (current.match && !current.paused && !current.leaving) {
        accumulator += dt;
        while (accumulator + 1e-9 >= STEP) {
          const previous = live.current.match!;
          const input = controls
            .slice(0, previous.rules.seats)
            .map(({ left, right, up, sprint }, i) => ({
              direction: (Number(keys.has(right)) - Number(keys.has(left))) as
                -1 | 0 | 1,
              sprint: keys.has(sprint),
              jumpHeld: keys.has(up),
              jumpPressed: jumps.has(i),
            }));
          const next = tickParty(previous, input);
          jumps.clear();
          if (next.serial !== previous.serial) keys.clear();
          previousRace =
            next.race.tick === previous.race.tick + 1
              ? previous.race
              : next.race;
          const newStatus = next.race.players.some(
            (p, i) =>
              p.pose !== previous.race.players[i].pose &&
              (p.pose === 'dead' ||
                p.pose === 'finish' ||
                previous.race.players[i].pose === 'dead'),
          );
          write(
            next,
            next.serial !== previous.serial ||
              second(next.left) !== second(previous.left) ||
              newStatus ||
              (next.phase === 'draft' && next.left === CRATE_OPEN_TICK) ||
              Object.keys(next.race.collected).length !==
                Object.keys(previous.race.collected).length,
          );
          accumulator = Math.max(0, accumulator - STEP);
        }
      } else if (current.paused || current.leaving) {
        clear();
      }
      const m = live.current.match ?? idle;
      const isRace = [
        'countdown',
        'race',
        'result',
        'score',
        'victory',
      ].includes(m.phase);
      if (stillCourse !== m.course) {
        stillCourse = m.course;
        stillFrame = newRun(stillCourse);
      }
      const before =
        isRace &&
        previousRace.layout.surfaces.length === m.race.layout.surfaces.length &&
        previousRace.tick <= m.race.tick &&
        m.race.tick - previousRace.tick <= 1
          ? previousRace
          : m.race;
      const from = isRace
        ? {
            ...stillFrame,
            tick: before.tick,
            layout: before.layout,
            player: before.players[0],
          }
        : stillFrame;
      const to = isRace
        ? {
            ...stillFrame,
            tick: m.race.tick,
            layout: m.race.layout,
            player: m.race.players[0],
          }
        : stillFrame;
      const showWide =
        current.fixed || (m.phase !== 'race' && m.phase !== 'victory');
      renderer?.draw(
        m.course,
        from,
        to,
        accumulator / STEP,
        dt,
        showWide,
        motion.matches,
        {
          runners: isRace
            ? m.race.active.map((i) => ({
                before: before.players[i] ?? m.race.players[i],
                player:
                  m.phase === 'victory' && m.winners.includes(i)
                    ? {
                        ...m.race.players[i],
                        pose: 'finish',
                        age: Math.floor(animationAge * 60),
                      }
                    : m.race.players[i],
                seat: i,
              }))
            : [],
          collected: m.race.collected,
        },
      );
      raf = requestAnimationFrame(animate);
    }
    void import('./render')
      .then(({ makeRenderer }) => makeRenderer(surface, abort.signal))
      .then((value) => {
        if (abort.signal.aborted) {
          value?.dispose();
          return;
        }
        renderer = value;
        setStatus('ready');
        raf = requestAnimationFrame(animate);
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatus('unavailable');
      });
    return () => {
      abort.abort();
      cancelAnimationFrame(raf);
      surface.removeEventListener('webglcontextlost', lose);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
      renderer?.dispose();
    };
  }, [attempt, write]);

  const m = match;
  const canDraft = (i: number) =>
    m?.phase === 'draft' && m.picks[i] === 'pending';
  const canBuild = (i: number) => m?.phase === 'build' && !m.done[i];
  const selected = m?.picks[seat];
  const selectedPart =
    selected && selected !== 'pending' ? selected.item : null;
  const previews =
    m?.phase === 'build'
      ? cursors.slice(0, m.rules.seats).map((point, i) => {
          const token = m.picks[i];
          return token && token !== 'pending' && canBuild(i)
            ? previewPlacement(m.board, token.item, point, undefined, m.course)
            : null;
        })
      : [];
  const activePreview = previews[seat];
  const isCrateOpen = (m?.left ?? 600) <= CRATE_OPEN_TICK;
  const timer = second(m?.left ?? 0);

  function pointAt(event: PointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: (1 - (event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }
  function choose(i: number, token: string | null) {
    if (m && isCrateOpen)
      dispatch({ type: 'claim', serial: m.serial, seat: i, token });
  }
  function place(i: number, position: (Point & { turn: Direction }) | null) {
    if (m) dispatch({ type: 'place', serial: m.serial, seat: i, position });
  }
  function togglePause() {
    live.current.paused = !live.current.paused;
    setPaused(live.current.paused);
    field.current?.focus();
  }

  return (
    <div className={stage.frame}>
      <section
        ref={field}
        tabIndex={-1}
        className={`${stage.stage} ${style.party}`}
        data-phase={m?.phase ?? 'setup'}
        aria-label={t.name}
      >
        <canvas key={attempt} ref={canvas} aria-hidden='true' />
        <header className={style.hud}>
          <h1>{t.name}</h1>
          {m && (
            <div className={style.phase}>
              <span>
                {m.tieAttempt
                  ? t.tiebreak
                  : `${t.round} ${m.round} / ${rules.rounds}`}
              </span>
              <strong>{phaseCopy[m.phase]}</strong>
              {(m.phase === 'draft' ||
                m.phase === 'build' ||
                m.phase === 'race') && <time>{timer}s</time>}
            </div>
          )}
          <div className={stage.tools}>
            {m && (
              <>
                <button
                  type='button'
                  title={copy.camera}
                  aria-label={copy.camera}
                  aria-pressed={fixed}
                  onClick={() => {
                    live.current.fixed = !fixed;
                    setFixed(!fixed);
                  }}
                >
                  <Camera size={17} />
                </button>
                <button
                  type='button'
                  aria-label={paused ? copy.resume : copy.pause}
                  title={paused ? copy.resume : copy.pause}
                  onClick={togglePause}
                >
                  {paused ? <Play size={17} /> : <Pause size={17} />}
                </button>
              </>
            )}
            <button
              type='button'
              aria-label={t.practice}
              title={t.practice}
              onClick={() => {
                if (!m || m.phase === 'victory') {
                  onBack();
                  return;
                }
                live.current.leaving = true;
                setLeaving(true);
              }}
            >
              <ArrowLeft size={17} />
            </button>
          </div>
        </header>

        {status !== 'ready' && (
          <div className={style.center} role='status'>
            <div className={style.paper}>
              <p>{status === 'loading' ? copy.loading : copy[status]}</p>
              {status !== 'loading' && (
                <button
                  type='button'
                  onClick={() => {
                    setStatus('loading');
                    setAttempt((n) => n + 1);
                  }}
                >
                  {copy.recover}
                </button>
              )}
            </div>
          </div>
        )}
        {status === 'ready' && !m && (
          <div className={style.center}>
            <div className={`${style.paper} ${style.setup}`}>
              <h2>{copy.orchard}</h2>
              <p>{t.setup}</p>
              <div className={style.rules}>
                <label>
                  {t.players}
                  <select
                    aria-label={t.players}
                    value={rules.seats}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        seats: Number(e.target.value) as Rules['seats'],
                      })
                    }
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.rounds}
                  <select
                    aria-label={t.rounds}
                    value={rules.rounds}
                    onChange={(e) =>
                      setRules({ ...rules, rounds: Number(e.target.value) })
                    }
                  >
                    {[5, 10, 15].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.points}
                  <select
                    aria-label={t.points}
                    value={rules.target}
                    onChange={(e) =>
                      setRules({ ...rules, target: Number(e.target.value) })
                    }
                  >
                    {[300, 600, 900, 1200].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              {rules.seats === 2 && (
                <label className={style.check}>
                  <input
                    type='checkbox'
                    checked={rules.doubleDraft}
                    onChange={(e) =>
                      setRules({ ...rules, doubleDraft: e.target.checked })
                    }
                  />
                  {t.double}
                </label>
              )}
              <ul className={style.instructions}>
                {names.slice(0, rules.seats).map((name, i) => (
                  <li key={name}>
                    <Sprite name={seatsArt[i].face} />
                    <strong>{name}</strong>
                    <kbd>{controls[i].label}</kbd>
                  </li>
                ))}
              </ul>
              <button className={style.primary} type='button' onClick={begin}>
                {t.begin}
              </button>
            </div>
          </div>
        )}

        {m?.phase === 'intro' && (
          <div className={style.center}>
            <div className={style.sign}>
              <span>{copy.orchard}</span>
              <strong>{phaseCopy.intro}</strong>
            </div>
          </div>
        )}

        {m?.phase === 'draft' && (
          <div className={style.center}>
            <div className={style.crate} aria-label={phaseCopy.draft}>
              <Sprite
                name={isCrateOpen ? 'crate-open' : 'crate-closed'}
                className={style.crateArt}
              />
              {isCrateOpen && (
                <div className={style.crateContents}>
                  <p>{t.draftHint}</p>
                  <div className={style.tokens}>
                    {m.offers.map((offer) => {
                      const taken = isClaimed(m.picks, offer.id);
                      return (
                        <button
                          type='button'
                          key={offer.id}
                          className={style.token}
                          data-taken={taken || undefined}
                          disabled={taken || !canDraft(seat)}
                          aria-label={itemCopy[offer.item][0]}
                          title={itemCopy[offer.item].join(' · ')}
                          onClick={() => choose(seat, offer.id)}
                        >
                          {!taken && (
                            <>
                              <DraftSprite item={offer.item} />
                              <span>{itemCopy[offer.item][0]}</span>
                              <span className={style.tokenSeats}>
                                {m.picks.map((p, i) =>
                                  p === 'pending' &&
                                  visibleDraft(m)[
                                    focus[i] % visibleDraft(m).length
                                  ]?.id === offer.id ? (
                                    <b
                                      key={i}
                                      style={{ background: seatsArt[i].color }}
                                    >
                                      <Sprite name={seatsArt[i].face} />
                                      {i + 1}
                                    </b>
                                  ) : null,
                                )}
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div
                className={style.picker}
                role='group'
                aria-label={t.choosePlayer}
              >
                {m.picks.map((pick, i) => (
                  <button
                    type='button'
                    key={i}
                    className={style.seat}
                    disabled={pick !== 'pending'}
                    aria-pressed={seat === i}
                    onClick={() => setSeat(i)}
                  >
                    <Sprite name={seatsArt[i].face} />
                    <b style={{ color: seatsArt[i].color }}>{i + 1}</b>
                    {pick && pick !== 'pending'
                      ? itemCopy[pick.item][0]
                      : pick === null
                        ? t.pass
                        : names[i]}
                  </button>
                ))}
                <button
                  type='button'
                  disabled={!isCrateOpen || !canDraft(seat)}
                  onClick={() => choose(seat, null)}
                >
                  {t.pass}
                </button>
              </div>
            </div>
          </div>
        )}

        {m?.phase === 'build' && (
          <>
            <div
              className={style.blueprint}
              aria-hidden='true'
              onPointerMove={(e) => {
                if (!canBuild(seat) || paused) return;
                const raw = pointAt(e);
                const x = Math.round(raw.x * 2) / 2;
                const y = Math.round(raw.y * 2) / 2;
                if (cursors[seat].x === x && cursors[seat].y === y) return;
                updateCursors(
                  pointer.current.cursors.map((c, index) =>
                    seat === index ? { ...c, x, y } : c,
                  ),
                );
              }}
              onPointerDown={(e) => {
                if (canBuild(seat) && e.button === 0)
                  place(seat, { ...pointAt(e), turn: cursors[seat].turn });
              }}
            >
              {protectedZones().map((zone, i) => (
                <span key={i} className={style.protected} style={area(zone)}>
                  {i ? copy.finish : copy.start}
                </span>
              ))}
              {previews.map((value, i) => {
                const pick = m.picks[i];
                if (!value || !pick || pick === 'pending') return null;
                const art = ITEMS[pick.item];
                const color = value.error ? '#b64f51' : '#117f82';
                return (
                  <div
                    key={i}
                    className={style.preview}
                    style={{ ...percent(value.point), color }}
                  >
                    <div
                      className={style.ghost}
                      style={{
                        width: `${(art.w / WIDTH) * 100}cqw`,
                        height: `${(art.h / HEIGHT) * 100}cqh`,
                        transform: `rotate(${-90 * value.point.turn}deg)`,
                      }}
                    >
                      <Sprite name={art.art} />
                      {pick.item === 'rail' && (
                        <span
                          className={style.sweep}
                          style={{
                            width: `${((2 * RAIL_TRAVEL) / WIDTH) * 100}cqw`,
                          }}
                        />
                      )}
                      {pick.item === 'lift' && (
                        <span
                          className={style.liftPath}
                          style={{
                            height: `${(LIFT_TRAVEL / HEIGHT) * 100}cqh`,
                          }}
                        />
                      )}
                    </div>
                    <div
                      className={style.cursor}
                      style={{ background: seatsArt[i].color }}
                    >
                      <Sprite name={seatsArt[i].face} />
                      <b>
                        {i + 1} {value.error ? '×' : '✓'}
                      </b>
                    </div>
                  </div>
                );
              })}
              {selectedPart === 'bomb' && activePreview && (
                <>
                  <span
                    className={style.blast}
                    style={area({
                      x: activePreview.point.x - BLAST,
                      y: activePreview.point.y - BLAST,
                      w: BLAST * 2,
                      h: BLAST * 2,
                    })}
                  />
                  {m.board
                    .filter((p: Part) => activePreview.targets.includes(p.id))
                    .map((p) => (
                      <span
                        key={p.id}
                        className={style.target}
                        style={area(itemRect(p.item, p))}
                      />
                    ))}
                </>
              )}
            </div>
            <div className={style.buildTools}>
              <div
                className={style.picker}
                role='group'
                aria-label={t.choosePlayer}
              >
                {m.picks.map((p, i) => (
                  <button
                    key={i}
                    type='button'
                    className={style.seat}
                    disabled={!canBuild(i)}
                    aria-pressed={seat === i}
                    onClick={() => setSeat(i)}
                  >
                    <Sprite name={seatsArt[i].face} />
                    <b style={{ color: seatsArt[i].color }}>{i + 1}</b>
                    {m.done[i]
                      ? t.ready
                      : p && p !== 'pending'
                        ? itemCopy[p.item][0]
                        : t.pass}
                  </button>
                ))}
              </div>
              <div className={style.buildActions}>
                <p
                  role='status'
                  data-invalid={activePreview?.error !== undefined}
                >
                  {activePreview?.error
                    ? errorCopy[activePreview.error]
                    : activePreview
                      ? `${t.valid} (${controls[seat].place})`
                      : t.buildHint}
                </p>
                <button
                  type='button'
                  onClick={() => rotate(seat)}
                  disabled={
                    !selectedPart || ITEMS[selectedPart].turns.length === 1
                  }
                >
                  {t.rotate}
                </button>
                <button
                  type='button'
                  onClick={() => rotate(seat, true)}
                  disabled={
                    !selectedPart ||
                    !ITEMS[selectedPart].turns.some(
                      (v) => v === (cursors[seat].turn + 2) % 4,
                    )
                  }
                >
                  {t.flip}
                </button>
                <button
                  type='button'
                  onClick={() => place(seat, null)}
                  disabled={!canBuild(seat)}
                >
                  {t.pass}
                </button>
                <button
                  type='button'
                  className={style.primary}
                  onClick={() => place(seat, cursors[seat])}
                  disabled={!activePreview || Boolean(activePreview.error)}
                >
                  {t.place}
                </button>
              </div>
            </div>
          </>
        )}

        {m?.phase === 'countdown' && (
          <div className={style.center} role='status'>
            <div className={style.count}>
              {m.tieAttempt && <p>{t.firstToFinish}</p>}
              <strong>{timer}</strong>
            </div>
          </div>
        )}

        {m?.phase === 'race' && (
          <div className={style.raceSeats}>
            {m.race.active.map((i) => {
              const p = m.race.players[i];
              const coins = Object.values(m.race.collected).filter(
                (value) => value === i,
              ).length;
              return (
                <span key={i} style={{ borderColor: seatsArt[i].color }}>
                  <b>{names[i]}</b>
                  {p.pose === 'dead'
                    ? t.dead
                    : p.pose === 'finish'
                      ? t.finish
                      : controls[i].label}
                  {coins > 0 && (
                    <small>
                      {t.coin} × {coins}
                    </small>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {m?.phase === 'result' && (
          <div className={style.center}>
            <div className={style.sign} role='status'>
              <span>{phaseCopy.result}</span>
              <strong>{outcomeCopy[m.outcome]}</strong>
            </div>
          </div>
        )}

        {m?.phase === 'score' && (
          <div className={style.center}>
            <div className={`${style.paper} ${style.scores}`}>
              <h2>{phaseCopy.score}</h2>
              <p>{m.outcome === 'mixed' ? t.bonus : outcomeCopy[m.outcome]}</p>
              {m.scores.map((events, i) => {
                const max = Math.max(
                  m.rules.target,
                  ...m.scores.map(scoreTotal),
                );
                const latest = m.awards[i];
                const runner = m.race.players[i];
                const status =
                  runner.pose === 'finish'
                    ? t.finish
                    : runner.pose === 'dead'
                      ? t.dead
                      : t.timeout;
                return (
                  <div key={i} className={style.scoreRow}>
                    <Sprite name={seatsArt[i].face} />
                    <div>
                      <div className={style.scoreName}>
                        <strong>{names[i]}</strong>
                        <span>{status}</span>
                        <b>
                          {scoreTotal(events)} / {m.rules.target}
                        </b>
                      </div>
                      <div
                        className={style.scoreBar}
                        aria-label={`${scoreTotal(events)} / ${m.rules.target}`}
                      >
                        {events.map((e, j) => (
                          <span
                            key={j}
                            title={`${categoryCopy[e.category]} +${e.points}`}
                            data-new={e.round === m.round || undefined}
                            style={{
                              width: `${(e.points / max) * 100}%`,
                              backgroundColor: categoryColor[e.category],
                            }}
                          />
                        ))}
                        <i
                          style={{ left: `${(m.rules.target / max) * 100}%` }}
                        />
                      </div>
                      {latest.length > 0 && (
                        <div className={style.legend}>
                          {latest.map((e, j) => (
                            <span key={j}>
                              <i
                                style={{
                                  background: categoryColor[e.category],
                                }}
                              />
                              {categoryCopy[e.category]} +{e.points}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {m?.phase === 'victory' && (
          <div className={style.center}>
            <div className={style.sign}>
              <span>{m.winners.length > 1 ? t.tied : phaseCopy.victory}</span>
              <strong>{m.winners.map((i) => names[i]).join(' & ')}</strong>
              <button className={style.primary} type='button' onClick={begin}>
                {t.rematch}
              </button>
            </div>
          </div>
        )}

        {paused && (
          <div className={`${style.center} ${style.pause}`}>
            <div className={style.paper}>
              <h2>{copy.pause}</h2>
              <button type='button' onClick={togglePause}>
                {copy.resume}
              </button>
            </div>
          </div>
        )}
      </section>
      {leaving && (
        <ConfirmDialog
          title={t.leave}
          message={t.leaveBody}
          confirmLabel={copy.leave}
          cancelLabel={copy.stay}
          onConfirm={onBack}
          onCancel={() => {
            live.current.leaving = false;
            setLeaving(false);
          }}
        />
      )}
    </div>
  );
}
