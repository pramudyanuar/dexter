'use client';

import * as React from 'react';

import {
  ARENA_H,
  ARENA_W,
  computeAiInput,
  createGeludState,
  Fighter,
  FighterInput,
  GeludEvents,
  GeludRoomState,
  GeludState,
  GROUND_Y,
  stepGelud,
} from '@/lib/games/gelud';
import { newToken } from '@/lib/rooms/codes';
import { useRoom } from '@/lib/rooms/useRoom';
import useMounted from '@/lib/useMounted';

import Confetti from '@/components/games/Confetti';
import GameShell from '@/components/games/GameShell';
import useGeludPeer from '@/components/games/gelud/useGeludPeer';
import RoomChat from '@/components/games/RoomChat';
import RoomGate, { Rematch } from '@/components/games/RoomGate';

function playGeludSfx(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  muted: boolean,
  events: GeludEvents,
) {
  if (muted) return;
  if (!events.hit && !events.blocked && !events.special && !events.ko) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    const ac = ctxRef.current;
    if (ac.state === 'suspended') void ac.resume();

    const tone = (
      f1: number,
      f2: number,
      dur: number,
      type: OscillatorType,
      vol: number,
    ) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(30, f2),
        ac.currentTime + dur,
      );
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    };

    if (events.hit) tone(190, 65, 0.12, 'sawtooth', 0.15);
    if (events.blocked) tone(420, 260, 0.08, 'triangle', 0.1);
    if (events.special) tone(540, 140, 0.25, 'square', 0.12);
    if (events.ko) tone(140, 38, 0.45, 'sawtooth', 0.2);
  } catch {
    // ignore audio restrictions
  }
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  primary: string,
  accent: string,
) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.facing, 1);

  if (f.action === 'ko') {
    ctx.rotate(-Math.PI / 2.2);
    ctx.translate(20, 0);
  }

  if (f.action !== 'ko') {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const flash = f.action === 'hit';
  const bodyColor = flash ? '#ffffff' : primary;
  const trimColor = flash ? '#ffffff' : accent;

  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -32);
  ctx.lineTo(-14, 0);
  ctx.moveTo(8, -32);
  if (f.action === 'kick' || f.action === 'special') {
    ctx.lineTo(44, -26);
  } else {
    ctx.lineTo(14, 0);
  }
  ctx.stroke();

  ctx.fillStyle = bodyColor;
  ctx.fillRect(-15, -74, 30, 44);

  ctx.fillStyle = trimColor;
  ctx.fillRect(-15, -42, 30, 6);

  ctx.fillStyle = flash ? '#ffffff' : '#f1c7a4';
  ctx.beginPath();
  ctx.arc(0, -88, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = trimColor;
  ctx.fillRect(-14, -95, 28, 6);

  ctx.fillStyle = '#111';
  ctx.fillRect(4, -89, 4, 3);

  ctx.strokeStyle = flash ? '#ffffff' : '#f1c7a4';
  ctx.lineWidth = 8;
  ctx.beginPath();
  if (f.action === 'punch' || f.action === 'special') {
    ctx.moveTo(6, -64);
    ctx.lineTo(46, -64);
  } else if (f.action === 'block') {
    ctx.moveTo(8, -68);
    ctx.lineTo(18, -82);
  } else {
    ctx.moveTo(8, -64);
    ctx.lineTo(22, -52);
  }
  ctx.stroke();

  if (f.action === 'special') {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.beginPath();
    ctx.arc(42, -56, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  if (f.action === 'block') {
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(16, -56, 34, -Math.PI / 2.5, Math.PI / 2.5);
    ctx.stroke();
  }

  ctx.restore();
}

function renderGelud(ctx: CanvasRenderingContext2D, state: GeludState) {
  ctx.save();
  if (state.shake > 0.2) {
    ctx.translate(
      (Math.random() - 0.5) * state.shake,
      (Math.random() - 0.5) * state.shake,
    );
  }

  const bg = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  bg.addColorStop(0, '#12131f');
  bg.addColorStop(1, '#261b2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, ARENA_W, GROUND_Y);

  ctx.fillStyle = '#1b1a29';
  for (let i = 0; i < 10; i++) {
    const bh = 70 + ((i * 47) % 90);
    ctx.fillRect(i * 84 + 4, GROUND_Y - bh, 72, bh);
  }

  ctx.fillStyle = '#252632';
  ctx.fillRect(0, GROUND_Y, ARENA_W, ARENA_H - GROUND_Y);
  ctx.strokeStyle = '#47495e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(ARENA_W, GROUND_Y);
  ctx.stroke();

  drawFighter(ctx, state.fighters[0], '#3b82f6', '#fbbf24');
  drawFighter(ctx, state.fighters[1], '#ef4444', '#f8fafc');

  for (const s of state.sparks) {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Math.max(0, s.life * 3.5);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 140, ARENA_W, 56);
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.banner, ARENA_W / 2, 168);
  }

  ctx.restore();
}

const emptyInput = (): FighterInput => ({
  left: false,
  right: false,
  jump: false,
  block: false,
  punch: false,
  kick: false,
  special: false,
});

function GeludHud({ hud }: { hud: GeludState }) {
  const [p1, p2] = hud.fighters;
  return (
    <div className='grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5'>
      <div>
        <div className='mb-1 flex items-center justify-between text-xs'>
          <span className='truncate font-bold text-info'>{p1.name}</span>
          <span className='font-mono text-[11px] text-[var(--mute)]'>
            {'●'.repeat(p1.roundsWon)}
            {'○'.repeat(Math.max(0, 2 - p1.roundsWon))}
          </span>
        </div>
        <div className='h-3 overflow-hidden rounded-full bg-paper'>
          <div
            className='h-full bg-info transition-[width] duration-75'
            style={{ width: `${p1.hp}%` }}
          />
        </div>
        <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-paper'>
          <div
            className='h-full bg-hash transition-[width] duration-75'
            style={{ width: `${p1.superMeter}%` }}
          />
        </div>
      </div>

      <div className='text-center'>
        <p className='text-[10px] text-[var(--mute)] uppercase'>
          Ronde {hud.round}
        </p>
        <p className='font-mono text-xl font-black text-ink'>
          {Math.ceil(hud.timer)}
        </p>
      </div>

      <div>
        <div className='mb-1 flex items-center justify-between text-xs'>
          <span className='font-mono text-[11px] text-[var(--mute)]'>
            {'○'.repeat(Math.max(0, 2 - p2.roundsWon))}
            {'●'.repeat(p2.roundsWon)}
          </span>
          <span className='truncate font-bold text-err'>{p2.name}</span>
        </div>
        <div className='h-3 overflow-hidden rounded-full bg-paper'>
          <div
            className='ml-auto h-full bg-err transition-[width] duration-75'
            style={{ width: `${p2.hp}%` }}
          />
        </div>
        <div className='mt-1 h-1.5 overflow-hidden rounded-full bg-paper'>
          <div
            className='ml-auto h-full bg-hash transition-[width] duration-75'
            style={{ width: `${p2.superMeter}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function TouchControls({
  touchRef,
  superMeter,
}: {
  touchRef: React.MutableRefObject<FighterInput>;
  superMeter: number;
}) {
  return (
    <div className='grid grid-cols-3 gap-2 md:hidden'>
      <button
        type='button'
        onPointerDown={() => (touchRef.current.left = true)}
        onPointerUp={() => (touchRef.current.left = false)}
        onPointerLeave={() => (touchRef.current.left = false)}
        className='rounded-lg border border-line bg-surface py-3 text-sm font-bold active:bg-line'
      >
        ◀ Kiri
      </button>
      <button
        type='button'
        onPointerDown={() => (touchRef.current.jump = true)}
        onPointerUp={() => (touchRef.current.jump = false)}
        onPointerLeave={() => (touchRef.current.jump = false)}
        className='rounded-lg border border-line bg-surface py-3 text-sm font-bold active:bg-line'
      >
        ▲ Lompat
      </button>
      <button
        type='button'
        onPointerDown={() => (touchRef.current.right = true)}
        onPointerUp={() => (touchRef.current.right = false)}
        onPointerLeave={() => (touchRef.current.right = false)}
        className='rounded-lg border border-line bg-surface py-3 text-sm font-bold active:bg-line'
      >
        Kanan ▶
      </button>
      <button
        type='button'
        onPointerDown={() => (touchRef.current.block = true)}
        onPointerUp={() => (touchRef.current.block = false)}
        onPointerLeave={() => (touchRef.current.block = false)}
        className='rounded-lg border border-line bg-surface py-3 text-sm font-bold active:bg-line'
      >
        🛡 Blok
      </button>
      <button
        type='button'
        onPointerDown={() => (touchRef.current.punch = true)}
        onPointerUp={() => (touchRef.current.punch = false)}
        onPointerLeave={() => (touchRef.current.punch = false)}
        className='rounded-lg bg-info py-3 text-sm font-bold text-white active:opacity-80'
      >
        Pukul
      </button>
      <button
        type='button'
        onPointerDown={() => {
          if (superMeter >= 50) touchRef.current.special = true;
          else touchRef.current.kick = true;
        }}
        onPointerUp={() => {
          touchRef.current.special = false;
          touchRef.current.kick = false;
        }}
        onPointerLeave={() => {
          touchRef.current.special = false;
          touchRef.current.kick = false;
        }}
        className='rounded-lg bg-err py-3 text-sm font-bold text-white active:opacity-80'
      >
        {superMeter >= 50 ? '⚡ Jurus!' : 'Tendang'}
      </button>
    </div>
  );
}

function OnlineArena({
  code,
  token,
  you,
  names,
  match,
  roomWinner,
  hostReloaded,
  reported,
  busy,
  onHostStart,
  onReportWinner,
  rematchControl,
}: {
  code: string;
  token: string;
  you: number;
  names: (string | null)[];
  match: number;
  roomWinner: 0 | 1 | null;
  hostReloaded?: true;
  reported: boolean;
  busy: boolean;
  onHostStart: (run: string, signal: AbortSignal) => Promise<void>;
  onReportWinner: (winner: 0 | 1) => void;
  rematchControl: React.ReactNode;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioRef = React.useRef<AudioContext | null>(null);
  const keysRef = React.useRef<Set<string>>(new Set());
  const touchRef = React.useRef<FighterInput>(emptyInput());
  const remoteInputRef = React.useRef<FighterInput>(emptyInput());
  const hostRun = React.useRef<string | null>(null);
  const [hostReady, setHostReady] = React.useState(you !== 0);
  const [startError, setStartError] = React.useState('');
  const [startAttempt, setStartAttempt] = React.useState(0);
  const roomOver = roomWinner !== null || hostReloaded === true;
  const startHost = React.useEffectEvent(onHostStart);

  const initialOnline = React.useCallback((): GeludState => {
    const base = createGeludState('2p');
    base.fighters[0].name = names[0] ?? 'Pemain 1';
    base.fighters[1].name = names[1] ?? 'Pemain 2';
    return base;
  }, [names]);

  const stateRef = React.useRef<GeludState>(initialOnline());
  const [hud, setHud] = React.useState<GeludState>(() => initialOnline());
  const [muted, setMuted] = React.useState(false);

  const { connected, timedOut, supported, send, retry } = useGeludPeer({
    code,
    token,
    you,
    match,
    active: !roomOver,
    onMessage: (raw) => {
      try {
        const msg = JSON.parse(raw) as
          | { type: 'input'; input: FighterInput }
          | { type: 'state'; state: GeludState; events: GeludEvents };
        if (you === 0 && msg.type === 'input') {
          remoteInputRef.current = msg.input;
        } else if (you === 1 && msg.type === 'state') {
          stateRef.current = msg.state;
          setHud(msg.state);
          playGeludSfx(audioRef, muted, msg.events);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) renderGelud(ctx, msg.state);
        }
      } catch {
        // ignore malformed packet
      }
    },
  });

  React.useEffect(() => {
    if (hostReady || !connected || roomOver) return;
    const controller = new AbortController();
    const run = (hostRun.current ??= newToken());
    void startHost(
      run,
      AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    )
      .then(() => {
        if (!controller.signal.aborted) {
          setStartError('');
          setHostReady(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStartError('Gagal memulai pertandingan.');
      });
    return () => controller.abort();
  }, [connected, hostReady, roomOver, startAttempt]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
      ) {
        e.preventDefault();
      }
      keysRef.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  React.useEffect(() => {
    if (!connected) remoteInputRef.current = emptyInput();
    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let netTimer = 0;

    const readLocalInput = (): FighterInput => {
      const k = keysRef.current;
      const t = touchRef.current;
      return {
        left: k.has('a') || k.has('arrowleft') || t.left,
        right: k.has('d') || k.has('arrowright') || t.right,
        jump: k.has('w') || k.has('arrowup') || t.jump,
        block: k.has('s') || k.has('arrowdown') || t.block,
        punch: k.has('f') || k.has(' ') || k.has('k') || t.punch,
        kick: k.has('g') || k.has('l') || t.kick,
        special: k.has('h') || k.has(';') || t.special,
      };
    };

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      if (you === 0) {
        if (connected && hostReady && !roomOver) {
          const p1 = readLocalInput();
          const p2 = remoteInputRef.current;
          const res = stepGelud(stateRef.current, [p1, p2], dt, now / 1000);
          stateRef.current = res.state;
          playGeludSfx(audioRef, muted, res.events);

          netTimer += dt;
          if (netTimer >= 0.032 || res.state.phase !== 'fight') {
            netTimer = 0;
            send({ type: 'state', state: res.state, events: res.events });
          }

          hudTimer += dt;
          if (hudTimer >= 0.06 || res.state.phase !== 'fight') {
            hudTimer = 0;
            setHud(res.state);
          }
        }
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) renderGelud(ctx, stateRef.current);
      } else {
        if (connected) {
          netTimer += dt;
          if (netTimer >= 0.032) {
            netTimer = 0;
            send({ type: 'input', input: readLocalInput() });
          }
        }
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) renderGelud(ctx, stateRef.current);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [you, connected, hostReady, roomOver, muted, send]);

  const myFighter = hud.fighters[you] ?? hud.fighters[0];

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-3'>
      {roomWinner === you && <Confetti />}

      <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-xs'>
        <span
          role='status'
          className={connected ? 'text-accent' : 'text-[var(--mute)]'}
        >
          {roomOver
            ? 'Pertandingan selesai'
            : startError ||
              (connected && hostReady
                ? 'Terhubung ke lawan'
                : connected
                  ? 'Menyiapkan pertandingan…'
                  : !supported
                    ? 'Browser ini tidak mendukung WebRTC.'
                    : timedOut
                      ? 'Koneksi ke lawan gagal. Masih mencoba menyambung.'
                      : 'Menghubungkan ke lawan…')}
        </span>
        {supported && timedOut && !roomOver && (
          <button
            type='button'
            onClick={retry}
            className='min-h-11 rounded-lg border border-line-strong px-3 hover:text-ink'
          >
            Sambung ulang
          </button>
        )}
        {startError && connected && !roomOver && (
          <button
            type='button'
            onClick={() => {
              setStartError('');
              setStartAttempt((count) => count + 1);
            }}
            className='min-h-11 rounded-lg border border-line-strong px-3 hover:text-ink'
          >
            Coba lagi
          </button>
        )}
        <button
          type='button'
          onClick={() => setMuted((v) => !v)}
          className='rounded-lg border border-line-strong px-2.5 py-1 text-[var(--mute)] hover:text-ink'
        >
          {muted ? 'Suara: Off' : 'Suara: On'}
        </button>
      </div>

      <GeludHud hud={hud} />

      <div className='relative overflow-hidden rounded-xl border-2 border-line-strong bg-black shadow-2xl'>
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className='aspect-[800/420] w-full'
        />
        {!connected && supported && !timedOut && !roomOver && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-[var(--mute)]'>
            Menyiapkan koneksi arena real-time…
          </div>
        )}
        {(hud.phase === 'match-over' || roomOver) && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center'>
            <h2 className='text-2xl font-black tracking-wider text-accent uppercase'>
              {hostReloaded
                ? 'Host memuat ulang halaman. Pertandingan berakhir.'
                : roomWinner === null
                  ? hud.banner
                  : roomWinner === you
                    ? 'KAMU MENANG!'
                    : 'KAMU KALAH'}
            </h2>
            {roomOver ? (
              rematchControl
            ) : reported ? (
              <p className='text-sm text-mute'>Menunggu konfirmasi lawan.</p>
            ) : hud.winner !== null ? (
              <button
                type='button'
                className='rounded-lg border border-line px-3 py-2 text-sm'
                disabled={busy}
                onClick={() => {
                  if (hud.winner !== null) onReportWinner(hud.winner);
                }}
              >
                Konfirmasi hasil
              </button>
            ) : null}
          </div>
        )}
      </div>

      <TouchControls touchRef={touchRef} superMeter={myFighter.superMeter} />

      <p className='text-center text-xs text-[var(--mute)]'>
        Kontrol: <strong className='text-ink'>A/D</strong> atau{' '}
        <strong className='text-ink'>←/→</strong> gerak,{' '}
        <strong className='text-ink'>W/↑</strong> lompat,{' '}
        <strong className='text-ink'>S/↓</strong> blok,{' '}
        <strong className='text-ink'>F/Spasi</strong> pukul,{' '}
        <strong className='text-ink'>G</strong> tendang,{' '}
        <strong className='text-ink'>H</strong> jurus.
      </p>
    </div>
  );
}

function LocalGelud({
  mode,
  onSwitchTab,
}: {
  mode: 'ai' | '2p';
  onSwitchTab: (tab: 'online' | 'ai' | '2p') => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const audioRef = React.useRef<AudioContext | null>(null);
  const stateRef = React.useRef<GeludState>(createGeludState(mode));
  const keysRef = React.useRef<Set<string>>(new Set());
  const touchRef = React.useRef<FighterInput>(emptyInput());

  const [hud, setHud] = React.useState<GeludState>(() =>
    createGeludState(mode),
  );
  const [muted, setMuted] = React.useState(false);

  const reset = React.useCallback(
    (nextMode: 'ai' | '2p' = mode) => {
      stateRef.current = createGeludState(nextMode);
      setHud(stateRef.current);
    },
    [mode],
  );

  React.useEffect(() => {
    reset(mode);
  }, [mode, reset]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
      ) {
        e.preventDefault();
      }
      keysRef.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;

      const k = keysRef.current;
      const t = touchRef.current;

      const p1: FighterInput = {
        left: k.has('a') || t.left,
        right: k.has('d') || t.right,
        jump: k.has('w') || t.jump,
        block: k.has('s') || t.block,
        punch: k.has('f') || k.has(' ') || t.punch,
        kick: k.has('g') || t.kick,
        special: k.has('h') || t.special,
      };

      const p2: FighterInput =
        stateRef.current.mode === 'ai'
          ? computeAiInput(
              stateRef.current.fighters[1],
              stateRef.current.fighters[0],
              now / 1000,
            )
          : {
              left: k.has('arrowleft'),
              right: k.has('arrowright'),
              jump: k.has('arrowup'),
              block: k.has('arrowdown'),
              punch: k.has('k'),
              kick: k.has('l'),
              special: k.has(';'),
            };

      const res = stepGelud(stateRef.current, [p1, p2], dt, now / 1000);
      stateRef.current = res.state;
      playGeludSfx(audioRef, muted, res.events);

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) renderGelud(ctx, stateRef.current);

      hudTimer += dt;
      if (hudTimer >= 0.06 || res.state.phase !== 'fight') {
        hudTimer = 0;
        setHud(res.state);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [muted]);

  const p1 = hud.fighters[0];

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-xs'>
        <div className='flex flex-wrap items-center gap-1.5'>
          <button
            type='button'
            onClick={() => onSwitchTab('online')}
            className='rounded-lg px-3 py-1 font-medium text-[var(--mute)] transition hover:text-ink'
          >
            Mabar Online
          </button>
          <button
            type='button'
            onClick={() => onSwitchTab('ai')}
            className={`rounded-lg px-3 py-1 font-medium transition ${
              mode === 'ai'
                ? 'bg-ink text-paper'
                : 'text-[var(--mute)] hover:text-ink'
            }`}
          >
            1P vs AI
          </button>
          <button
            type='button'
            onClick={() => onSwitchTab('2p')}
            className={`rounded-lg px-3 py-1 font-medium transition ${
              mode === '2p'
                ? 'bg-ink text-paper'
                : 'text-[var(--mute)] hover:text-ink'
            }`}
          >
            2P (1 Keyboard)
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => setMuted((v) => !v)}
            className='rounded-lg border border-line-strong px-2.5 py-1 text-[var(--mute)] hover:text-ink'
          >
            {muted ? 'Suara: Off' : 'Suara: On'}
          </button>
          <button
            type='button'
            onClick={() => reset(mode)}
            className='rounded-lg border border-line-strong px-2.5 py-1 text-ink hover:border-[var(--mute)]'
          >
            Ulangi
          </button>
        </div>
      </div>

      <GeludHud hud={hud} />

      <div className='relative overflow-hidden rounded-xl border-2 border-line-strong bg-black shadow-2xl'>
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className='aspect-[800/420] w-full'
        />

        {hud.phase === 'match-over' && (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center'>
            <h2 className='text-2xl font-black tracking-wider text-accent uppercase'>
              {hud.banner}
            </h2>
            <button
              type='button'
              onClick={() => reset(mode)}
              className='rounded-lg bg-ink px-5 py-2 text-sm font-medium text-paper hover:opacity-90'
            >
              Main Lagi
            </button>
          </div>
        )}
      </div>

      <TouchControls touchRef={touchRef} superMeter={p1.superMeter} />

      <p className='text-center text-xs text-[var(--mute)]'>
        P1: <strong className='text-ink'>A/D</strong> gerak,{' '}
        <strong className='text-ink'>W</strong> lompat,{' '}
        <strong className='text-ink'>S</strong> blok,{' '}
        <strong className='text-ink'>F/Spasi</strong> pukul,{' '}
        <strong className='text-ink'>G</strong> tendang,{' '}
        <strong className='text-ink'>H</strong> jurus.
        {mode === '2p' && (
          <>
            {' '}
            · P2: <strong className='text-ink'>←/→/↑/↓</strong>,{' '}
            <strong className='text-ink'>K</strong> pukul,{' '}
            <strong className='text-ink'>L</strong> tendang,{' '}
            <strong className='text-ink'>;</strong> jurus.
          </>
        )}
      </p>
    </div>
  );
}

function GeludRouter() {
  const r = useRoom<GeludRoomState>('gelud');
  const [tab, setTab] = React.useState<'online' | 'ai' | '2p'>('online');

  if (!r.session && tab !== 'online') {
    return <LocalGelud mode={tab} onSwitchTab={setTab} />;
  }

  return (
    <div className='flex flex-col gap-3'>
      {!r.session && (
        <div className='mx-auto inline-flex items-center gap-1 rounded-full border border-line bg-surface/60 p-1 text-xs'>
          <button
            type='button'
            onClick={() => setTab('online')}
            className='rounded-full bg-ink px-3.5 py-1 font-medium text-paper'
          >
            Mabar Online
          </button>
          <button
            type='button'
            onClick={() => setTab('ai')}
            className='rounded-full px-3.5 py-1 font-medium text-[var(--mute)] hover:text-ink'
          >
            1P vs AI
          </button>
          <button
            type='button'
            onClick={() => setTab('2p')}
            className='rounded-full px-3.5 py-1 font-medium text-[var(--mute)] hover:text-ink'
          >
            2P (1 Keyboard)
          </button>
        </div>
      )}

      <RoomGate
        r={r}
        blurb='# Gelud online 2 pemain real-time! Buat room atau gabung pakai kode untuk duel 1v1 lewat koneksi peer-to-peer.'
      >
        {({ room, you }) => (
          <OnlineArena
            key={`${room.code}:${room.state.match ?? 0}`}
            code={r.session!.code}
            token={r.session!.token}
            you={you}
            names={room.names}
            match={room.state.match ?? 0}
            roomWinner={room.state.winner}
            hostReloaded={room.state.hostReloaded}
            reported={room.state.reports?.[you] != null}
            busy={r.busy}
            onHostStart={(hostRun, signal) =>
              r.moveOrThrow({ hostRun, match: room.state.match ?? 0 }, signal)
            }
            onReportWinner={(winner) =>
              r.move({ winner, match: room.state.match ?? 0 })
            }
            rematchControl={<Rematch r={r} />}
          />
        )}
      </RoomGate>
    </div>
  );
}

export default function GeludPage() {
  const mounted = useMounted();

  return (
    <GameShell name='gelud' xwide>
      {mounted ? (
        <>
          <GeludRouter />
          <RoomChat game='gelud' />
        </>
      ) : null}
    </GameShell>
  );
}
