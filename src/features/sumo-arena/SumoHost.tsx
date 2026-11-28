'use client';

import {
  Bot,
  Check,
  Copy,
  Gamepad2,
  Play,
  RotateCcw,
  Smartphone,
  Trophy,
  Tv,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import {
  createInitialSumo,
  drawSumoArena,
  stepSumo,
  SUMO_H,
  SUMO_W,
  type SumoSetup,
  type SumoState,
  WIN_SCORE,
} from '@/features/sumo-arena/game';
import { encodeQrMatrix, qrToSvg } from '@/features/tools/qr';
import {
  type ControllerInput,
  createTvRoomCode,
  EMPTY_INPUT,
  type RacePhase,
  TV_SLOTS,
  type TvMessage,
} from '@/features/tv-controller/protocol';
import {
  connectTvChannel,
  type TransportMode,
} from '@/features/tv-controller/transport';

interface ConnectedPad {
  slot: number;
  clientId: string;
  name: string;
}

export default function SumoHost() {
  const mounted = useMounted();
  const [code] = React.useState(() => createTvRoomCode());
  const [phase, setPhase] = React.useState<RacePhase>('lobby');
  const [connected, setConnected] = React.useState(false);
  const [transportMode, setTransportMode] =
    React.useState<TransportMode>('local');
  const [pads, setPads] = React.useState<ConnectedPad[]>([]);
  const [playerCount, setPlayerCount] = React.useState<2 | 4>(4);
  const [muted, setMuted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [winnerSlot, setWinnerSlot] = React.useState<number | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const inputsRef = React.useRef<Record<number, ControllerInput>>({});
  const padsRef = React.useRef<ConnectedPad[]>([]);
  const phaseRef = React.useRef<RacePhase>('lobby');
  const mutedRef = React.useRef(false);
  const audioRef = React.useRef<AudioContext | null>(null);
  const sumoRef = React.useRef<SumoState>(createInitialSumo([]));
  const transportRef = React.useRef<ReturnType<typeof connectTvChannel> | null>(
    null,
  );

  React.useEffect(() => {
    padsRef.current = pads;
    phaseRef.current = phase;
    mutedRef.current = muted;
  }, [muted, pads, phase]);

  const playBeep = React.useCallback((freq: number, dur = 0.08) => {
    if (mutedRef.current || typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = (audioRef.current ??= new AudioCtx());
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Ignore audio autoplay blocks
    }
  }, []);

  const controllerUrl = React.useMemo(() => {
    if (!mounted) return '';
    return `${window.location.origin}/games/tv/controller?room=${code}&a=Seruduk&b=Dash`;
  }, [mounted, code]);

  const qrDataUrl = React.useMemo(() => {
    if (!controllerUrl) return null;
    try {
      return `data:image/svg+xml,${encodeURIComponent(qrToSvg(encodeQrMatrix(controllerUrl)))}`;
    } catch {
      return null;
    }
  }, [controllerUrl]);

  React.useEffect(() => {
    if (!mounted) return;
    const tx = connectTvChannel(
      code,
      (msg: TvMessage) => {
        if (msg.type === 'join') {
          const current = padsRef.current;
          const existing = current.find((p) => p.clientId === msg.clientId);
          if (existing) {
            tx.send({
              type: 'welcome',
              clientId: msg.clientId,
              slot: existing.slot,
              phase: phaseRef.current,
            });
            return;
          }
          const used = new Set(current.map((p) => p.slot));
          const freeSlot = [0, 1, 2, 3].find((s) => !used.has(s));
          if (freeSlot === undefined) {
            tx.send({ type: 'full', clientId: msg.clientId });
            return;
          }
          const cleanName =
            msg.name.trim().slice(0, 14) || `Pemain ${freeSlot + 1}`;
          const next = [
            ...current,
            { slot: freeSlot, clientId: msg.clientId, name: cleanName },
          ].sort((a, b) => a.slot - b.slot);
          padsRef.current = next;
          setPads(next);
          tx.send({
            type: 'welcome',
            clientId: msg.clientId,
            slot: freeSlot,
            phase: phaseRef.current,
          });
        } else if (msg.type === 'leave') {
          const next = padsRef.current.filter(
            (p) => p.clientId !== msg.clientId,
          );
          padsRef.current = next;
          setPads(next);
        } else if (msg.type === 'input') {
          inputsRef.current[msg.slot] = msg.input;
        }
      },
      (ok) => {
        setConnected(ok);
        if (transportRef.current) {
          setTransportMode(transportRef.current.mode);
        }
      },
    );
    transportRef.current = tx;
    return () => {
      tx.close();
      transportRef.current = null;
    };
  }, [code, mounted]);

  React.useEffect(() => {
    const keyInput: ControllerInput = { ...EMPTY_INPUT };
    const syncKey = (e: KeyboardEvent, down: boolean) => {
      if (phaseRef.current !== 'playing') return;
      const k = e.key.toLowerCase();
      let changed = true;
      if (k === 'arrowleft' || k === 'a') keyInput.left = down;
      else if (k === 'arrowright' || k === 'd') keyInput.right = down;
      else if (k === 'arrowup' || k === 'w') keyInput.up = down;
      else if (k === 'arrowdown' || k === 's') keyInput.down = down;
      else if (k === ' ') keyInput.a = down;
      else if (k === 'shift') keyInput.b = down;
      else changed = false;

      if (changed) {
        e.preventDefault();
        inputsRef.current[0] = { ...keyInput };
      }
    };
    const onDown = (e: KeyboardEvent) => syncKey(e, true);
    const onUp = (e: KeyboardEvent) => syncKey(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const startMatch = React.useCallback(() => {
    const humanBySlot = new Map(padsRef.current.map((p) => [p.slot, p]));
    const setups: SumoSetup[] = [];
    for (let slot = 0; slot < playerCount; slot++) {
      const human = humanBySlot.get(slot);
      if (human) {
        setups.push({ slot, name: human.name, isBot: false });
      } else if (slot === 0 && padsRef.current.length === 0) {
        setups.push({ slot: 0, name: 'Kamu (P1)', isBot: false });
      } else {
        setups.push({
          slot,
          name: `Bot ${TV_SLOTS[slot].label}`,
          isBot: true,
        });
      }
    }

    sumoRef.current = createInitialSumo(setups);
    setWinnerSlot(null);
    setPhase('playing');
    transportRef.current?.send({
      type: 'phase',
      phase: 'playing',
      winnerSlot: null,
      laps: [0],
    });
  }, [playerCount]);

  React.useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const prev = sumoRef.current;
      const next = stepSumo(prev, inputsRef.current, dt);
      sumoRef.current = next;

      if (next.roundOverTimer > 0 && prev.roundOverTimer <= 0) {
        playBeep(520, 0.22);
      } else if (next.shakeTimer > 0.08 && prev.shakeTimer <= 0) {
        playBeep(190, 0.07);
      }

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawSumoArena(ctx, next);

      if (next.matchWinnerSlot !== null) {
        setWinnerSlot(next.matchWinnerSlot);
        setPhase('over');
        transportRef.current?.send({
          type: 'phase',
          phase: 'over',
          winnerSlot: next.matchWinnerSlot,
          laps: next.fighters.map((f) => f.score),
        });
        return;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, playBeep]);

  const copyLink = async () => {
    if (!controllerUrl) return;
    try {
      await navigator.clipboard.writeText(controllerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (!mounted) return null;

  return (
    <div className='mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-4 py-2'>
      <header className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/70 px-4 py-3'>
        <div className='flex items-center gap-3'>
          <span className='flex size-10 items-center justify-center rounded-xl border border-line-strong bg-paper text-accent'>
            <Tv aria-hidden className='size-5' />
          </span>
          <div>
            <h1 className='text-lg font-bold tracking-tight text-ink sm:text-xl'>
              Sumo Bumper Arena
            </h1>
            <p className='text-xs text-mute'>
              Dorong lawan keluar ring yang menyusut · Pertama {WIN_SCORE} poin
              menang!
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
          <button
            type='button'
            aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
            onClick={() => setMuted((m) => !m)}
            className='flex size-8 items-center justify-center rounded-lg border border-line bg-paper text-mute hover:border-accent hover:text-ink'
          >
            {muted ? (
              <VolumeX aria-hidden className='size-4' />
            ) : (
              <Volume2 aria-hidden className='size-4' />
            )}
          </button>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              connected
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-line text-mute'
            }`}
          >
            <Wifi aria-hidden className='size-3.5' />
            {connected
              ? transportMode === 'realtime'
                ? 'Realtime Aktif'
                : 'Mode Lokal (Tab)'
              : 'Menghubungkan…'}
          </span>
          <span className='rounded-lg border border-line-strong bg-paper px-3 py-1 font-mono text-sm font-bold tracking-[0.2em] text-ink'>
            {code}
          </span>
        </div>
      </header>

      {phase === 'lobby' && (
        <div className='grid items-stretch gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]'>
          <section className='flex flex-col items-center justify-center rounded-2xl border border-line bg-card/70 p-6 text-center'>
            <p className='text-xs font-semibold tracking-wider text-accent uppercase'>
              Controller HP
            </p>
            <h2 className='mt-1 text-2xl font-black tracking-tight text-ink'>
              Scan QR untuk Jadi Pegulat
            </h2>
            <p className='mt-1 text-sm text-mute'>
              Main solo lawan Bot AI atau ajak hingga 4 teman pakai HP.
            </p>

            {qrDataUrl && (
              <div className='mt-5 rounded-2xl border border-line-strong bg-white p-3 shadow-lg'>
                <Image
                  src={qrDataUrl}
                  alt={`QR Controller Sumo ${code}`}
                  width={184}
                  height={184}
                  unoptimized
                />
              </div>
            )}

            <div className='mt-4 flex flex-wrap items-center justify-center gap-2'>
              <span className='rounded-lg border border-line-strong bg-paper px-4 py-2 font-mono text-2xl font-bold tracking-[0.25em] text-ink'>
                {code}
              </span>
              <button
                type='button'
                onClick={copyLink}
                className='inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3.5 text-sm font-semibold text-ink hover:border-accent hover:text-accent'
              >
                {copied ? (
                  <>
                    <Check aria-hidden className='size-4 text-accent' />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy aria-hidden className='size-4' />
                    Salin Link HP
                  </>
                )}
              </button>
            </div>
          </section>

          <section className='flex flex-col justify-between rounded-2xl border border-line bg-card/70 p-6'>
            <div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h2 className='flex items-center gap-2 text-lg font-bold text-ink'>
                  <Gamepad2 aria-hidden className='size-5 text-accent' />
                  Pegulat ({pads.length} HP terhubung)
                </h2>
                <div
                  role='group'
                  aria-label='Jumlah pegulat'
                  className='flex gap-1 rounded-lg border border-line bg-paper p-1'
                >
                  {([2, 4] as const).map((cnt) => (
                    <button
                      key={cnt}
                      type='button'
                      aria-pressed={playerCount === cnt}
                      onClick={() => setPlayerCount(cnt)}
                      className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                        playerCount === cnt
                          ? 'bg-accent text-paper'
                          : 'text-mute hover:text-ink'
                      }`}
                    >
                      {cnt} Pemain
                    </button>
                  ))}
                </div>
              </div>

              <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
                {TV_SLOTS.slice(0, playerCount).map((theme, slot) => {
                  const pad = pads.find((p) => p.slot === slot);
                  return (
                    <li
                      key={theme.label}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                        pad
                          ? `${theme.border} ${theme.bg}`
                          : 'border-dashed border-line bg-paper/40'
                      }`}
                    >
                      <span
                        className='flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-white'
                        style={{ backgroundColor: theme.color }}
                      >
                        P{slot + 1}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-semibold text-ink'>
                          {pad
                            ? pad.name
                            : slot === 0 && pads.length === 0
                              ? 'Kamu (Keyboard / HP)'
                              : `Bot ${theme.label}`}
                        </p>
                        <p className='text-xs text-mute'>
                          {pad ? (
                            <span className='inline-flex items-center gap-1 text-accent'>
                              <Smartphone aria-hidden className='size-3' /> HP
                              Siap
                            </span>
                          ) : slot === 0 && pads.length === 0 ? (
                            <span className='inline-flex items-center gap-1'>
                              <Users aria-hidden className='size-3' /> Solo /
                              Scan HP
                            </span>
                          ) : (
                            <span className='inline-flex items-center gap-1'>
                              <Bot aria-hidden className='size-3' /> Bot AI
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className='mt-6 space-y-3 border-t border-line pt-4'>
              <button
                type='button'
                onClick={startMatch}
                className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-bold text-paper transition-opacity hover:opacity-90'
              >
                <Play aria-hidden className='size-5' />
                Mulai Pertarungan (
                {pads.length > 0 ? `${pads.length} HP` : 'Solo vs Bot'})
              </button>
              <p className='text-center text-xs text-mute'>
                Kontrol PC (P1): <strong>WASD / Panah</strong> gerak ·{' '}
                <strong>Spasi</strong> seruduk · <strong>Shift</strong> dash.
              </p>
            </div>
          </section>
        </div>
      )}

      {(phase === 'playing' || phase === 'over') && (
        <div className='relative overflow-hidden rounded-2xl border border-line-strong bg-[#0c2340] shadow-2xl'>
          <canvas
            ref={canvasRef}
            width={SUMO_W}
            height={SUMO_H}
            style={{ imageRendering: 'pixelated' }}
            className='block aspect-video w-full'
          />

          {phase === 'over' && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm'>
              <div className='w-full max-w-md rounded-2xl border border-line-strong bg-card p-6 text-center shadow-2xl'>
                <Trophy
                  aria-hidden
                  className='mx-auto size-10 text-amber-400'
                />
                <h2 className='mt-2 text-2xl font-black text-ink'>
                  Juara Dohyo!
                </h2>
                {winnerSlot !== null && (
                  <p className='mt-1 text-base font-bold'>
                    <span className={TV_SLOTS[winnerSlot]?.text}>
                      P{winnerSlot + 1} ({TV_SLOTS[winnerSlot]?.label}) Menang!
                    </span>
                  </p>
                )}

                <div className='mt-5 flex gap-3'>
                  <button
                    type='button'
                    onClick={startMatch}
                    className='inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-bold text-paper hover:opacity-90'
                  >
                    <RotateCcw aria-hidden className='size-4' />
                    Main Lagi
                  </button>
                  <button
                    type='button'
                    onClick={() => setPhase('lobby')}
                    className='inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-ink hover:border-accent'
                  >
                    Lobi
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
