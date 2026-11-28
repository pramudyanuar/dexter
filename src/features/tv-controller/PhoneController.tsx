'use client';

import { Gamepad2, Wifi } from 'lucide-react';
import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import {
  type ControllerInput,
  EMPTY_INPUT,
  normalizeTvRoomCode,
  type RacePhase,
  TV_SLOTS,
  type TvMessage,
} from '@/features/tv-controller/protocol';
import { connectTvChannel } from '@/features/tv-controller/transport';

function vibrate(ms = 12) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

function initialParamCode(): string {
  if (typeof window === 'undefined') return '';
  return normalizeTvRoomCode(
    new URLSearchParams(window.location.search).get('room') ?? '',
  );
}

function makeClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function initialButtonLabel(param: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const val = new URLSearchParams(window.location.search).get(param)?.trim();
  return val ? val.slice(0, 10) : fallback;
}

export default function PhoneController() {
  const mounted = useMounted();
  const [clientId] = React.useState(makeClientId);
  const [labelA] = React.useState(() => initialButtonLabel('a', 'Gas'));
  const [labelB] = React.useState(() => initialButtonLabel('b', 'Rem'));
  const [roomCode, setRoomCode] = React.useState(initialParamCode);
  const [name, setName] = React.useState(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('dexter-player-name') ?? '')
      : '',
  );
  const [joinedCode, setJoinedCode] = React.useState<string | null>(() => {
    const code = initialParamCode();
    return code.length === 5 ? code : null;
  });
  const [slot, setSlot] = React.useState<number | null>(null);
  const [phase, setPhase] = React.useState<RacePhase>('lobby');
  const [connected, setConnected] = React.useState(false);
  const [error, setError] = React.useState('');

  const inputRef = React.useRef<ControllerInput>({ ...EMPTY_INPUT });
  const seqRef = React.useRef(0);
  const transportRef = React.useRef<ReturnType<typeof connectTvChannel> | null>(
    null,
  );
  const [activeKeys, setActiveKeys] = React.useState<ControllerInput>({
    ...EMPTY_INPUT,
  });

  // Connect to TV room when joinedCode is set
  React.useEffect(() => {
    if (!mounted || !joinedCode) return;

    const tx = connectTvChannel(
      joinedCode,
      (msg: TvMessage) => {
        if (msg.type === 'welcome' && msg.clientId === clientId) {
          setSlot(msg.slot);
          setPhase(msg.phase);
          setError('');
        } else if (msg.type === 'full' && msg.clientId === clientId) {
          setError('Room sudah penuh (maksimal 4 HP).');
        } else if (msg.type === 'phase') {
          setPhase(msg.phase);
        }
      },
      (ok) => {
        setConnected(ok);
        if (ok) {
          transportRef.current?.send({
            type: 'join',
            clientId,
            name: name.trim() || 'Pemain HP',
          });
        }
      },
    );
    transportRef.current = tx;

    // Retry join every 1.5s until TV assigns a slot
    const retry = setInterval(() => {
      tx.send({
        type: 'join',
        clientId,
        name: name.trim() || 'Pemain HP',
      });
    }, 1500);

    return () => {
      clearInterval(retry);
      tx.send({ type: 'leave', clientId });
      tx.close();
      transportRef.current = null;
    };
  }, [clientId, joinedCode, mounted, name]);

  const sendFullInput = React.useCallback(
    (next: ControllerInput, haptic = false) => {
      inputRef.current = next;
      setActiveKeys(next);
      if (haptic) vibrate(12);
      if (slot === null) return;
      seqRef.current += 1;
      transportRef.current?.send({
        type: 'input',
        clientId,
        slot,
        input: next,
        seq: seqRef.current,
      });
    },
    [clientId, slot],
  );

  const sendButton = React.useCallback(
    (key: 'a' | 'b', pressed: boolean) => {
      if (inputRef.current[key] === pressed) return;
      sendFullInput({ ...inputRef.current, [key]: pressed }, pressed);
    },
    [sendFullInput],
  );

  const stickRef = React.useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = React.useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const updateStick = React.useCallback(
    (clientX: number, clientY: number) => {
      const el = stickRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.36;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, maxR);
      const ang = Math.atan2(dy, dx);
      const kx = dist > 0 ? Math.cos(ang) * clamped : 0;
      const ky = dist > 0 ? Math.sin(ang) * clamped : 0;
      setKnob({ x: kx, y: ky });

      const nx = maxR > 0 ? kx / maxR : 0;
      const ny = maxR > 0 ? ky / maxR : 0;
      const mag = Math.hypot(nx, ny);
      const ax = mag < 0.12 ? 0 : nx;
      const ay = mag < 0.12 ? 0 : ny;
      sendFullInput({
        ...inputRef.current,
        ax,
        ay,
        left: ax < -0.3,
        right: ax > 0.3,
        up: ay < -0.3,
        down: ay > 0.3,
      });
    },
    [sendFullInput],
  );

  const resetStick = React.useCallback(() => {
    setKnob({ x: 0, y: 0 });
    sendFullInput({
      ...inputRef.current,
      ax: 0,
      ay: 0,
      left: false,
      right: false,
      up: false,
      down: false,
    });
  }, [sendFullInput]);

  const connectManual = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeTvRoomCode(roomCode);
    if (clean.length < 4) {
      setError('Masukkan kode room dari layar TV.');
      return;
    }
    setError('');
    setSlot(null);
    if (name.trim()) localStorage.setItem('dexter-player-name', name.trim());
    setJoinedCode(clean);
  };

  if (!mounted) return null;

  if (!joinedCode) {
    return (
      <div className='games-ui flex min-h-dvh flex-col items-center justify-center bg-paper p-5 text-ink'>
        <form
          onSubmit={connectManual}
          className='w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-xl'
        >
          <div className='flex items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent'>
              <Gamepad2 aria-hidden className='size-5' />
            </span>
            <div>
              <h1 className='text-lg font-bold'>Controller HP</h1>
              <p className='text-xs text-mute'>
                Masukkan kode yang tampil di layar TV
              </p>
            </div>
          </div>

          <label className='mt-5 block text-sm'>
            <span className='text-mute'>Namamu</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 14))}
              placeholder='mis. Budi'
              className='mt-1.5 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-ink outline-none focus:border-accent'
            />
          </label>

          <label className='mt-4 block text-sm'>
            <span className='text-mute'>Kode Room TV</span>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(normalizeTvRoomCode(e.target.value))}
              placeholder='ABCDE'
              maxLength={5}
              autoCapitalize='characters'
              className='mt-1.5 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-center font-mono text-2xl font-bold tracking-[0.3em] text-ink uppercase outline-none focus:border-accent'
            />
          </label>

          {error && (
            <p role='alert' className='mt-3 text-center text-sm text-err'>
              {error}
            </p>
          )}

          <button
            type='submit'
            className='mt-5 min-h-12 w-full rounded-xl bg-accent font-bold text-paper transition-opacity hover:opacity-90'
          >
            Hubungkan ke TV
          </button>
        </form>
      </div>
    );
  }

  const theme = slot !== null ? TV_SLOTS[slot] : TV_SLOTS[0];

  const padBtnProps = (key: 'a' | 'b') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      sendButton(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      sendButton(key, false);
    },
    onPointerCancel: () => sendButton(key, false),
  });

  return (
    <div
      className='games-ui flex h-dvh w-full touch-none flex-col justify-between overflow-hidden bg-paper p-4 text-ink select-none'
      style={{
        backgroundImage: `radial-gradient(circle at 50% 0%, ${theme.color}22, transparent 60%)`,
      }}
    >
      {/* Top Status Strip */}
      <header className='flex items-center justify-between gap-2 rounded-2xl border border-line bg-card/80 px-4 py-2.5'>
        <div className='flex items-center gap-2.5'>
          <span
            className='flex size-8 items-center justify-center rounded-lg text-xs font-black text-white'
            style={{ backgroundColor: theme.color }}
          >
            {slot !== null ? `P${slot + 1}` : '…'}
          </span>
          <div>
            <p className='text-sm leading-tight font-bold'>
              {slot !== null
                ? `Pemain ${slot + 1} (${theme.label})`
                : 'Menghubungkan ke TV…'}
            </p>
            <p className='text-[11px] text-mute'>
              Room {joinedCode} ·{' '}
              {phase === 'playing'
                ? 'Balapan berlangsung!'
                : phase === 'over'
                  ? 'Balapan selesai'
                  : 'Menunggu TV mulai'}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            connected && slot !== null
              ? 'bg-accent/15 text-accent'
              : 'bg-line text-mute'
          }`}
        >
          <Wifi aria-hidden className='size-3.5' />
          {slot !== null ? 'Siap' : 'Sync…'}
        </span>
      </header>

      {error && (
        <p
          role='alert'
          className='mx-auto rounded-xl border border-err/40 bg-err/10 px-4 py-2 text-sm text-err'
        >
          {error}
        </p>
      )}

      {/* Gamepad Controls */}
      <div className='my-auto flex w-full max-w-3xl items-center justify-between gap-4 self-center px-2 sm:px-8'>
        {/* Left: Virtual Analog Joystick */}
        <div
          ref={stickRef}
          role='application'
          aria-label='Analog Joystick'
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            vibrate(8);
            updateStick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.pointerType === 'mouse') return;
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            updateStick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            resetStick();
          }}
          onPointerCancel={resetStick}
          className='relative flex size-40 touch-none items-center justify-center rounded-full border-4 border-line-strong bg-card/90 shadow-inner sm:size-48'
        >
          <div className='pointer-events-none size-24 rounded-full border border-dashed border-line-strong/70 sm:size-28' />
          <div
            className='pointer-events-none absolute size-16 rounded-full border-2 border-white/40 shadow-lg transition-transform duration-75 sm:size-20'
            style={{
              backgroundColor: theme.color,
              transform: `translate(${knob.x}px, ${knob.y}px)`,
            }}
          />
        </div>

        {/* Right: B (Brake) & A (Gas) Arcade Buttons */}
        <div className='flex items-end gap-4 sm:gap-6'>
          <button
            type='button'
            aria-label={`${labelB} (B)`}
            {...padBtnProps('b')}
            className={`flex size-20 flex-col items-center justify-center rounded-full border-4 font-black transition-transform sm:size-24 ${
              activeKeys.b
                ? 'scale-95 border-rose-400 bg-rose-500 text-white'
                : 'border-rose-500/60 bg-rose-500/20 text-rose-300'
            }`}
          >
            <span className='text-2xl'>B</span>
            <span className='text-[10px] font-semibold uppercase'>
              {labelB}
            </span>
          </button>

          <button
            type='button'
            aria-label={`${labelA} (A)`}
            {...padBtnProps('a')}
            className={`mb-6 flex size-24 flex-col items-center justify-center rounded-full border-4 font-black transition-transform sm:size-28 ${
              activeKeys.a
                ? 'scale-95 border-emerald-400 bg-emerald-500 text-white'
                : 'border-emerald-500/70 bg-emerald-500/25 text-emerald-300'
            }`}
          >
            <span className='text-3xl'>A</span>
            <span className='text-[11px] font-semibold uppercase'>
              {labelA}
            </span>
          </button>
        </div>
      </div>

      <footer className='text-center text-[11px] text-mute'>
        Putar HP ke posisi mendatar (landscape) untuk kontrol lebih nyaman
      </footer>
    </div>
  );
}
