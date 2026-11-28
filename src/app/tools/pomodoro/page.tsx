'use client';

import * as React from 'react';

import ToolShell from '@/features/tools/components/ToolShell';

type Preset = 'focus' | 'short' | 'long';

const PRESETS: Record<Preset, { label: string; minutes: number }> = {
  focus: { label: 'Fokus', minutes: 25 },
  short: { label: 'Istirahat Pendek', minutes: 5 },
  long: { label: 'Istirahat Panjang', minutes: 15 },
};

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(
        0.15,
        ctx.currentTime + i * 0.12 + 0.03,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + i * 0.12 + 0.45,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.5);
    });
  } catch {
    // AudioContext blocked or unavailable
  }
}

export default function PomodoroPage() {
  const [preset, setPreset] = React.useState<Preset>('focus');
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [running, setRunning] = React.useState(false);
  const [sessions, setSessions] = React.useState(0);
  const [taskLabel, setTaskLabel] = React.useState('');

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playChime();
          if (preset === 'focus') setSessions((s) => s + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, preset]);

  const selectPreset = (next: Preset) => {
    setRunning(false);
    setPreset(next);
    setSecondsLeft(PRESETS[next].minutes * 60);
  };

  const totalSeconds = PRESETS[preset].minutes * 60;
  const progress = Math.max(0, Math.min(1, 1 - secondsLeft / totalSeconds));
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <ToolShell
      title='Pomodoro Timer'
      description='Timer fokus 25/5/15 menit dengan notifikasi suara lembut di akhir sesi.'
    >
      <div className='flex flex-col items-center gap-6 rounded-xl border border-line bg-surface/50 p-6'>
        <div className='flex flex-wrap justify-center gap-2'>
          {(Object.keys(PRESETS) as Preset[]).map((key) => (
            <button
              key={key}
              type='button'
              onClick={() => selectPreset(key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                preset === key
                  ? 'border-transparent bg-ink text-paper'
                  : 'border-line-strong text-[var(--mute)] hover:text-ink'
              }`}
            >
              {PRESETS[key].label} ({PRESETS[key].minutes}m)
            </button>
          ))}
        </div>

        <input
          type='text'
          placeholder='Sedang mengerjakan apa? (opsional)'
          value={taskLabel}
          onChange={(e) => setTaskLabel(e.target.value)}
          className='w-full max-w-md rounded-lg border border-line bg-paper px-3.5 py-2 text-center text-sm text-ink placeholder:text-[var(--mute)] focus:border-accent focus:outline-none'
        />

        <div className='relative flex size-56 items-center justify-center'>
          <svg viewBox='0 0 120 120' className='size-full -rotate-90'>
            <circle
              cx='60'
              cy='60'
              r='52'
              fill='none'
              stroke='currentColor'
              strokeWidth='5'
              className='text-line'
            />
            <circle
              cx='60'
              cy='60'
              r='52'
              fill='none'
              stroke='currentColor'
              strokeWidth='5'
              strokeLinecap='round'
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 * (1 - progress)}
              className='text-accent transition-[stroke-dashoffset] duration-500'
            />
          </svg>
          <span className='absolute font-mono text-5xl font-semibold tracking-tight'>
            {mins}:{secs}
          </span>
        </div>

        <div className='flex items-center gap-3'>
          <button
            type='button'
            onClick={() => {
              if (secondsLeft === 0) {
                setSecondsLeft(PRESETS[preset].minutes * 60);
              }
              setRunning((r) => !r);
            }}
            className='rounded-lg bg-ink px-6 py-2.5 text-sm font-medium text-paper transition hover:opacity-90'
          >
            {running ? 'Jeda' : secondsLeft === 0 ? 'Ulangi' : 'Mulai'}
          </button>
          <button
            type='button'
            onClick={() => {
              setRunning(false);
              setSecondsLeft(PRESETS[preset].minutes * 60);
            }}
            className='rounded-lg border border-line-strong px-4 py-2.5 text-sm text-[var(--mute)] transition hover:text-ink'
          >
            Reset
          </button>
        </div>

        <div className='text-xs text-[var(--mute)]'>
          Sesi fokus selesai: <strong className='text-ink'>{sessions}</strong>
        </div>
      </div>
    </ToolShell>
  );
}
