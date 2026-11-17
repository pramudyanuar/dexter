'use client';

import * as React from 'react';

import ToolShell from '@/components/tools/ToolShell';

function formatStopwatch(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function formatCountdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function beep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // ignore
  }
}

export default function TimerToolPage() {
  const [tab, setTab] = React.useState<'stopwatch' | 'countdown'>('stopwatch');

  // Stopwatch state
  const [swRunning, setSwRunning] = React.useState(false);
  const [swMs, setSwMs] = React.useState(0);
  const [laps, setLaps] = React.useState<number[]>([]);
  const swStartRef = React.useRef(0);

  React.useEffect(() => {
    if (!swRunning) return;
    swStartRef.current = Date.now() - swMs;
    const id = setInterval(() => {
      setSwMs(Date.now() - swStartRef.current);
    }, 50);
    return () => clearInterval(id);
  }, [swRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown state
  const [cdMinutes, setCdMinutes] = React.useState(5);
  const [cdLeft, setCdLeft] = React.useState(300);
  const [cdRunning, setCdRunning] = React.useState(false);

  React.useEffect(() => {
    if (!cdRunning) return;
    const id = setInterval(() => {
      setCdLeft((prev) => {
        if (prev <= 1) {
          setCdRunning(false);
          beep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cdRunning]);

  return (
    <ToolShell
      title='Stopwatch & Timer'
      description='Stopwatch dengan pencatat putaran (lap) dan hitung mundur custom dengan alarm suara.'
    >
      <div className='mb-5 flex gap-2'>
        <button
          type='button'
          onClick={() => setTab('stopwatch')}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            tab === 'stopwatch'
              ? 'border-transparent bg-ink text-paper'
              : 'border-line-strong text-[var(--mute)] hover:text-ink'
          }`}
        >
          Stopwatch
        </button>
        <button
          type='button'
          onClick={() => setTab('countdown')}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            tab === 'countdown'
              ? 'border-transparent bg-ink text-paper'
              : 'border-line-strong text-[var(--mute)] hover:text-ink'
          }`}
        >
          Hitung Mundur
        </button>
      </div>

      {tab === 'stopwatch' ? (
        <div className='flex flex-col items-center gap-6 rounded-xl border border-line bg-surface/50 p-6'>
          <div className='font-mono text-5xl font-semibold tracking-tight text-ink'>
            {formatStopwatch(swMs)}
          </div>

          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => setSwRunning((r) => !r)}
              className='rounded-lg bg-ink px-6 py-2 text-sm font-medium text-paper transition hover:opacity-90'
            >
              {swRunning ? 'Jeda' : swMs > 0 ? 'Lanjut' : 'Mulai'}
            </button>
            <button
              type='button'
              disabled={!swRunning}
              onClick={() => setLaps((prev) => [swMs, ...prev])}
              className='rounded-lg border border-line-strong px-4 py-2 text-sm transition hover:border-accent disabled:opacity-40'
            >
              Lap
            </button>
            <button
              type='button'
              onClick={() => {
                setSwRunning(false);
                setSwMs(0);
                setLaps([]);
              }}
              className='rounded-lg border border-line-strong px-4 py-2 text-sm text-[var(--mute)] hover:text-ink'
            >
              Reset
            </button>
          </div>

          {laps.length > 0 && (
            <ul className='flex w-full max-w-sm flex-col gap-1.5 border-t border-line pt-4'>
              {laps.map((lap, i) => (
                <li
                  key={i}
                  className='flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-1.5 font-mono text-xs'
                >
                  <span className='text-[var(--mute)]'>
                    Lap {laps.length - i}
                  </span>
                  <span className='text-ink'>{formatStopwatch(lap)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className='flex flex-col items-center gap-6 rounded-xl border border-line bg-surface/50 p-6'>
          <div className='font-mono text-5xl font-semibold tracking-tight text-ink'>
            {formatCountdown(cdLeft)}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            {[1, 3, 5, 10, 15, 30].map((m) => (
              <button
                key={m}
                type='button'
                onClick={() => {
                  setCdRunning(false);
                  setCdMinutes(m);
                  setCdLeft(m * 60);
                }}
                className='rounded-lg border border-line-strong px-2.5 py-1 text-xs text-[var(--mute)] hover:border-accent hover:text-ink'
              >
                {m}m
              </button>
            ))}
          </div>

          <label className='flex items-center gap-2 text-xs text-[var(--mute)]'>
            Menit custom:
            <input
              type='number'
              min={1}
              max={180}
              value={cdMinutes}
              onChange={(e) => {
                const m = Math.max(1, Number(e.target.value) || 1);
                setCdRunning(false);
                setCdMinutes(m);
                setCdLeft(m * 60);
              }}
              className='w-20 rounded-lg border border-line-strong bg-paper px-2.5 py-1 font-mono text-sm text-ink'
            />
          </label>

          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => {
                if (cdLeft === 0) setCdLeft(cdMinutes * 60);
                setCdRunning((r) => !r);
              }}
              className='rounded-lg bg-ink px-6 py-2 text-sm font-medium text-paper transition hover:opacity-90'
            >
              {cdRunning ? 'Jeda' : cdLeft === 0 ? 'Ulangi' : 'Mulai'}
            </button>
            <button
              type='button'
              onClick={() => {
                setCdRunning(false);
                setCdLeft(cdMinutes * 60);
              }}
              className='rounded-lg border border-line-strong px-4 py-2 text-sm text-[var(--mute)] hover:text-ink'
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
