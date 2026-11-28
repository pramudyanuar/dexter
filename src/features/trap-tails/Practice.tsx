'use client';

import { ArrowLeft, Camera, Pause, Play, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import styles from './stage.module.css';

import ConfirmDialog from '@/components/ConfirmDialog';
import { shouldIgnoreGameKey } from '@/components/games/snake/controls';

import {
  type Course,
  type CourseId,
  courses,
  WORKSHOP_PARTY_SIGN,
} from './content';
import { copy } from './copy';
import { newRun, STEP, stepRun, touchesCoin } from './movement';
import { partyCopy } from './party-copy';
import type { makeRenderer } from './render';

type Ready = 'loading' | 'ready' | 'unavailable' | 'contextLost';
type Outcome = 'won' | 'dead' | null;
const checkpoints = {
  workshop: {
    startMarker: courses.workshop.start,
    wallMarker: { x: 10.65, y: 3.3 },
    liftMarker: { x: 22.4, y: 5.35 },
    goalMarker: { x: 26.95, y: 7.1 },
  },
  lab: {
    startMarker: courses.lab.start,
    arrowMarker: { x: 11, y: 3 },
    fanMarker: { x: 15.3, y: 3.55 },
    pistonMarker: { x: 19.05, y: 4.3 },
    swingMarker: { x: 23.9, y: 4.75 },
  },
} satisfies Record<string, Record<string, Course['start']>>;
type Checkpoint =
  keyof typeof checkpoints.workshop | keyof typeof checkpoints.lab;
type CheckpointMap = Partial<Record<Checkpoint, Course['start']>>;
const startPoints: Partial<Record<CourseId, CheckpointMap>> = checkpoints;
const aliases: Record<string, 'left' | 'right' | 'jump' | 'sprint'> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'jump',
  Space: 'jump',
  KeyW: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};

export default function Practice({ onParty }: { onParty: () => void }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<Ready>('loading');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [hasCoin, setHasCoin] = useState(false);
  const [courseId, setCourseId] = useState<CourseId>('workshop');
  const [checkpoint, setCheckpoint] = useState<Checkpoint>('startMarker');
  const [fixed, setFixed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const controls = useRef({
    courseId,
    checkpoint,
    fixed,
    paused,
    leaving,
    revision: 0,
  });

  function changeCourse(next: CourseId) {
    controls.current.courseId = next;
    controls.current.checkpoint = 'startMarker';
    controls.current.revision++;
    setCourseId(next);
    setCheckpoint('startMarker');
    setOutcome(null);
    setHasCoin(false);
  }

  function changeCheckpoint(next: Checkpoint) {
    controls.current.checkpoint = next;
    controls.current.revision++;
    setCheckpoint(next);
    setOutcome(null);
    setHasCoin(false);
  }

  function reset() {
    controls.current.revision++;
    controls.current.paused = false;
    setOutcome(null);
    setHasCoin(false);
    setPaused(false);
    fieldRef.current?.focus({ preventScroll: true });
  }

  function togglePause(next: boolean) {
    controls.current.paused = next;
    setPaused(next);
    if (!next) fieldRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const controller = new AbortController();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: Awaited<ReturnType<typeof makeRenderer>>;
    let animation = 0;
    const keys = new Set<string>();
    let jumpPressed = false;
    let revision = -1;
    let course: Course = courses.workshop;
    let previous = newRun(course);
    let current = previous;
    let last = 0;
    let accumulator = 0;
    let collected: Record<string, number> = {};

    const clearInput = () => {
      keys.clear();
      jumpPressed = false;
      last = 0;
    };
    const has = (action: (typeof aliases)[string]) =>
      [...keys].some((code) => aliases[code] === action);
    const down = (e: KeyboardEvent) => {
      if (
        controls.current.leaving ||
        shouldIgnoreGameKey(e) ||
        (e.target instanceof Element && e.target.closest('dialog[open]')) ||
        !renderer
      )
        return;
      if (
        e.code === 'KeyE' &&
        !e.repeat &&
        !controls.current.paused &&
        course === courses.workshop &&
        Math.abs(current.player.x - WORKSHOP_PARTY_SIGN.x) < 1.05 &&
        Math.abs(current.player.y + 0.65 - WORKSHOP_PARTY_SIGN.y) < 0.8 &&
        current.player.pose !== 'dead' &&
        current.player.pose !== 'finish'
      ) {
        e.preventDefault();
        onParty();
        return;
      }
      if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
        e.preventDefault();
        clearInput();
        togglePause(!controls.current.paused);
        return;
      }
      if (!e.repeat && e.code === 'KeyR') {
        e.preventDefault();
        clearInput();
        reset();
        return;
      }
      if (controls.current.paused || !aliases[e.code]) return;
      e.preventDefault();
      if (aliases[e.code] === 'jump' && !e.repeat && !has('jump'))
        jumpPressed = true;
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
    };

    const loop = (now: number) => {
      const state = controls.current;
      const dt = last ? Math.min((now - last) / 1000, STEP * 5) : 0;
      last = now;

      if (revision !== state.revision) {
        revision = state.revision;
        course = courses[state.courseId];
        previous = newRun(
          course,
          startPoints[state.courseId]?.[state.checkpoint],
        );
        current = previous;
        collected = {};
        accumulator = 0;
      }

      if (state.paused || state.leaving) {
        clearInput();
      } else {
        accumulator += dt;
        while (accumulator + 1e-9 >= STEP) {
          previous = current;
          const direction = has('right')
            ? has('left')
              ? 0
              : 1
            : has('left')
              ? -1
              : 0;
          current = stepRun(course, previous, {
            direction,
            sprint: has('sprint'),
            jumpPressed,
            jumpHeld: has('jump'),
          });
          if (
            current.player.pose !== 'dead' &&
            previous.player.pose !== 'finish'
          ) {
            for (const coin of current.layout.gadgets) {
              if (
                coin.kind === 'coin' &&
                collected[coin.id] === undefined &&
                touchesCoin(previous.player, current.player, coin)
              ) {
                collected[coin.id] = 0;
                setHasCoin(true);
              }
            }
          }
          jumpPressed = false;
          accumulator = Math.max(0, accumulator - STEP);
          if (current.player.pose !== previous.player.pose) {
            if (current.player.pose === 'dead') setOutcome('dead');
            if (current.player.pose === 'finish') setOutcome('won');
          }
        }
      }

      if (canvas.dataset.pose !== current.player.pose)
        canvas.dataset.pose = current.player.pose;
      renderer?.draw(
        course,
        previous,
        current,
        accumulator / STEP,
        dt,
        state.fixed,
        motion.matches,
        { collected },
      );
      animation = requestAnimationFrame(loop);
    };

    const loseContext = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(animation);
      setStatus('contextLost');
    };
    canvas.addEventListener('webglcontextlost', loseContext);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', clearInput);

    void import('./render')
      .then(({ makeRenderer }) => makeRenderer(canvas, controller.signal))
      .then((next) => {
        if (controller.signal.aborted) {
          next?.dispose();
          return;
        }
        renderer = next;
        setStatus('ready');
        animation = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unavailable');
      });

    return () => {
      controller.abort();
      cancelAnimationFrame(animation);
      canvas.removeEventListener('webglcontextlost', loseContext);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', clearInput);
      renderer?.dispose();
    };
  }, [loadAttempt, onParty]);

  const error = status === 'unavailable' || status === 'contextLost';
  const wideLabel = fixed ? copy.cameraFollow : copy.camera;
  return (
    <div className={styles.frame}>
      <section
        className={styles.stage}
        ref={fieldRef}
        tabIndex={-1}
        aria-label={copy.stage}
      >
        <canvas ref={canvasRef} key={loadAttempt} aria-hidden='true' />
        <header className={styles.header}>
          <div className={styles.masthead}>
            <p>{copy.orchard}</p>
            <h1>{copy.title}</h1>
          </div>
          <div className={styles.tools}>
            <button type='button' onClick={onParty}>
              {partyCopy.name}
            </button>
            <button
              type='button'
              disabled={status !== 'ready'}
              aria-label={paused ? copy.resume : copy.pause}
              title={paused ? copy.resume : copy.pause}
              onClick={() => togglePause(!paused)}
            >
              {paused ? (
                <Play aria-hidden='true' size={17} />
              ) : (
                <Pause aria-hidden='true' size={17} />
              )}
            </button>
            <button
              type='button'
              disabled={status !== 'ready'}
              aria-label={copy.reset}
              title={copy.reset}
              onClick={reset}
            >
              <RotateCcw aria-hidden='true' size={17} />
            </button>
            <button
              type='button'
              aria-label={copy.back}
              title={copy.back}
              onClick={() => {
                controls.current.leaving = true;
                setLeaving(true);
              }}
            >
              <ArrowLeft aria-hidden='true' size={19} />
            </button>
          </div>
        </header>

        <div className={styles.status} role='status'>
          {status === 'loading' && <span>{copy.loading}</span>}
          {error && (
            <div className={styles.notice}>
              <p>{copy[status]}</p>
              <button
                type='button'
                onClick={() => {
                  setStatus('loading');
                  reset();
                  setLoadAttempt((value) => value + 1);
                }}
              >
                {copy.recover}
              </button>
            </div>
          )}
          {status === 'ready' && (paused || outcome) && (
            <div className={styles.notice}>
              <p>{paused ? copy.paused : copy[outcome!]}</p>
              <button
                type='button'
                onClick={paused ? () => togglePause(false) : reset}
              >
                {paused ? copy.resume : copy.reset}
              </button>
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <div className={styles.options}>
            <select
              aria-label={copy.setup}
              value={courseId}
              onChange={(event) => changeCourse(event.target.value as CourseId)}
            >
              {(Object.keys(courses) as CourseId[]).map((id) => (
                <option key={id} value={id}>
                  {copy[id]}
                </option>
              ))}
            </select>
            {startPoints[courseId] && (
              <select
                aria-label={copy.checkpoint}
                value={checkpoint}
                onChange={(event) =>
                  changeCheckpoint(event.target.value as Checkpoint)
                }
              >
                {(Object.keys(startPoints[courseId]!) as Checkpoint[]).map(
                  (id) => (
                    <option key={id} value={id}>
                      {copy[id]}
                    </option>
                  ),
                )}
              </select>
            )}
            {hasCoin && (
              <span className={styles.keys} role='status'>
                {copy.leafCollected}
              </span>
            )}
            <button
              type='button'
              title={wideLabel}
              aria-label={copy.camera}
              aria-pressed={fixed}
              onClick={() => {
                controls.current.fixed = !fixed;
                setFixed(!fixed);
              }}
            >
              <Camera size={17} aria-hidden='true' />
            </button>
          </div>
          <div className={styles.keys} aria-label={copy.controls}>
            <span>
              <kbd>←</kbd> <kbd>→</kbd> {copy.movement}
            </span>
            <span>
              <kbd>Space</kbd> {copy.jump}
            </span>
            <span>
              <kbd>Shift</kbd> {copy.sprint}
            </span>
          </div>
        </footer>
      </section>
      {leaving && (
        <ConfirmDialog
          title={copy.leaveTitle}
          message={copy.leaveMessage}
          confirmLabel={copy.leave}
          cancelLabel={copy.stay}
          onConfirm={() => router.push('/games')}
          onCancel={() => {
            controls.current.leaving = false;
            setLeaving(false);
          }}
        />
      )}
    </div>
  );
}
