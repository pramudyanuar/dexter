'use client';

import {
  Bot,
  Check,
  Copy,
  Gamepad2,
  Play,
  RotateCcw,
  Shuffle,
  Smartphone,
  Trophy,
  Tv,
  Wifi,
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import useMounted from '@/hooks/useMounted';

import { encodeQrMatrix, qrToSvg } from '@/features/tools/qr';
import {
  CANVAS_H,
  CANVAS_W,
  createInitialRace,
  createRandomTrack,
  drawRaceCanvas,
  drawTrackSurface,
  type KartState,
  type RacerSetup,
  type RaceState,
  standings,
  stepRace,
  TOTAL_LAPS,
  type TrackData,
} from '@/features/tv-controller/game';
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

export default function TvHost() {
  const mounted = useMounted();
  const [code] = React.useState(() => createTvRoomCode());
  const [phase, setPhase] = React.useState<RacePhase>('lobby');
  const [connected, setConnected] = React.useState(false);
  const [transportMode, setTransportMode] =
    React.useState<TransportMode>('local');
  const [pads, setPads] = React.useState<ConnectedPad[]>([]);
  const [fillBots, setFillBots] = React.useState(true);
  const [autoRandomTrack, setAutoRandomTrack] = React.useState(true);
  const [track, setTrack] = React.useState<TrackData>(() =>
    createRandomTrack(),
  );
  const [copied, setCopied] = React.useState(false);
  const [hudKarts, setHudKarts] = React.useState<KartState[]>([]);
  const [winnerSlot, setWinnerSlot] = React.useState<number | null>(null);

  const previewRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const inputsRef = React.useRef<Record<number, ControllerInput>>({});
  const padsRef = React.useRef<ConnectedPad[]>([]);
  const phaseRef = React.useRef<RacePhase>('lobby');
  const raceRef = React.useRef<RaceState>(createInitialRace([], track));
  const transportRef = React.useRef<ReturnType<typeof connectTvChannel> | null>(
    null,
  );

  React.useEffect(() => {
    padsRef.current = pads;
    phaseRef.current = phase;
  }, [pads, phase]);

  const controllerUrl = React.useMemo(() => {
    if (!mounted) return '';
    return `${window.location.origin}/games/tv/controller?room=${code}`;
  }, [mounted, code]);

  const qrDataUrl = React.useMemo(() => {
    if (!controllerUrl) return null;
    try {
      return `data:image/svg+xml,${encodeURIComponent(qrToSvg(encodeQrMatrix(controllerUrl)))}`;
    } catch {
      return null;
    }
  }, [controllerUrl]);

  // Connect to shared broadcast channel
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

  // Keyboard fallback for Slot 0 (useful if testing solo on PC)
  React.useEffect(() => {
    const keyInput: ControllerInput = { ...EMPTY_INPUT };
    const syncKey = (e: KeyboardEvent, down: boolean) => {
      if (phaseRef.current !== 'playing') return;
      const k = e.key.toLowerCase();
      let changed = true;
      if (k === 'arrowleft' || k === 'a') keyInput.left = down;
      else if (k === 'arrowright' || k === 'd') keyInput.right = down;
      else if (k === 'arrowup' || k === 'w' || k === ' ') keyInput.a = down;
      else if (k === 'arrowdown' || k === 's') keyInput.b = down;
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

  React.useEffect(() => {
    if (phase !== 'lobby') return;
    const ctx = previewRef.current?.getContext('2d');
    if (ctx) drawTrackSurface(ctx, track);
  }, [phase, track]);

  const shuffleTrack = React.useCallback(() => {
    setTrack(createRandomTrack());
  }, []);

  const startRace = React.useCallback(
    (reroll = false) => {
      const nextTrack = reroll ? createRandomTrack() : track;
      if (reroll) setTrack(nextTrack);

      const humanBySlot = new Map(padsRef.current.map((p) => [p.slot, p]));
      const racers: RacerSetup[] = [];
      for (let slot = 0; slot < 4; slot++) {
        const human = humanBySlot.get(slot);
        if (human) {
          racers.push({ slot, name: human.name, isBot: false });
        } else if (fillBots) {
          racers.push({
            slot,
            name: `Bot ${TV_SLOTS[slot].label}`,
            isBot: true,
          });
        }
      }
      if (racers.length === 0) {
        racers.push(
          { slot: 0, name: 'Keyboard P1', isBot: false },
          { slot: 1, name: 'Bot Biru', isBot: true },
        );
      }

      const initial = createInitialRace(racers, nextTrack);
      raceRef.current = initial;
      setHudKarts(initial.karts);
      setWinnerSlot(null);
      setPhase('playing');
      transportRef.current?.send({
        type: 'phase',
        phase: 'playing',
        winnerSlot: null,
        laps: initial.karts.map((k) => k.lap),
      });
    },
    [fillBots, track],
  );

  // 60fps simulation + canvas draw loop
  React.useEffect(() => {
    if (phase !== 'playing') return;
    let raf = 0;
    let last = performance.now();
    let hudTick = 0;

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const next = stepRace(raceRef.current, inputsRef.current, dt);
      raceRef.current = next;

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRaceCanvas(ctx, next);

      hudTick += dt;
      if (hudTick >= 0.12) {
        hudTick = 0;
        setHudKarts(standings(next.karts));
      }

      if (next.winnerSlot !== null) {
        setWinnerSlot(next.winnerSlot);
        setHudKarts(standings(next.karts));
        setPhase('over');
        transportRef.current?.send({
          type: 'phase',
          phase: 'over',
          winnerSlot: next.winnerSlot,
          laps: next.karts.map((k) => k.lap),
        });
        return;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

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
      {/* Top Bar */}
      <header className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card/70 px-4 py-3'>
        <div className='flex items-center gap-3'>
          <span className='flex size-10 items-center justify-center rounded-xl border border-line-strong bg-paper text-accent'>
            <Tv aria-hidden className='size-5' />
          </span>
          <div>
            <h1 className='text-lg font-bold tracking-tight text-ink sm:text-xl'>
              Turbo TV Arena
            </h1>
            <p className='text-xs text-mute'>
              Mode TV · Pindai QR dari HP untuk jadi controller
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
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
          {/* Left: QR Code & Invite */}
          <section className='flex flex-col items-center justify-center rounded-2xl border border-line bg-card/70 p-6 text-center'>
            <p className='text-xs font-semibold tracking-wider text-accent uppercase'>
              Hubungkan HP
            </p>
            <h2 className='mt-1 text-2xl font-black tracking-tight text-ink'>
              Scan QR atau Masukkan Kode
            </h2>
            <p className='mt-1 text-sm text-mute'>
              Buka kamera HP dan arahkan ke QR di bawah ini.
            </p>

            {qrDataUrl && (
              <div className='mt-5 rounded-2xl border border-line-strong bg-white p-3 shadow-lg'>
                <Image
                  src={qrDataUrl}
                  alt={`QR Controller Room ${code}`}
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

          {/* Right: Connected Controllers & Start */}
          <section className='flex flex-col justify-between rounded-2xl border border-line bg-card/70 p-6'>
            <div>
              <div className='flex items-center justify-between'>
                <h2 className='flex items-center gap-2 text-lg font-bold text-ink'>
                  <Gamepad2 aria-hidden className='size-5 text-accent' />
                  Controller Terhubung ({pads.length}/4)
                </h2>
                <span className='text-xs text-mute'>{TOTAL_LAPS} Lap</span>
              </div>

              <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
                {TV_SLOTS.map((theme, slot) => {
                  const pad = pads.find((p) => p.slot === slot);
                  return (
                    <li
                      key={theme.label}
                      className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${
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
                          {pad ? pad.name : `Slot ${theme.label}`}
                        </p>
                        <p className='text-xs text-mute'>
                          {pad ? (
                            <span className='inline-flex items-center gap-1 text-accent'>
                              <Smartphone aria-hidden className='size-3' /> HP
                              Siap
                            </span>
                          ) : fillBots ? (
                            <span className='inline-flex items-center gap-1'>
                              <Bot aria-hidden className='size-3' /> Diisi Bot
                            </span>
                          ) : (
                            'Menunggu HP…'
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className='mt-5 space-y-3 border-t border-line pt-4'>
              {/* Track preview & randomize */}
              <div className='flex items-center gap-3 rounded-xl border border-line bg-paper/50 p-3'>
                <canvas
                  ref={previewRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className='aspect-video w-28 shrink-0 rounded-lg border border-line-strong bg-[#090d14]'
                />
                <div className='min-w-0 flex-1'>
                  <p className='text-xs font-semibold tracking-wider text-accent uppercase'>
                    Sirkuit Acak
                  </p>
                  <p className='truncate text-sm font-bold text-ink'>
                    {track.name}
                  </p>
                  <p className='text-xs text-mute'>
                    {TOTAL_LAPS} lap · 3 turbo ⚡ · 3 genangan oli
                  </p>
                </div>
                <button
                  type='button'
                  onClick={shuffleTrack}
                  className='inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 text-xs font-semibold text-ink hover:border-accent hover:text-accent'
                >
                  <Shuffle aria-hidden className='size-3.5' />
                  Acak Sirkuit
                </button>
              </div>

              <label className='flex cursor-pointer items-center justify-between rounded-xl border border-line bg-paper/50 px-4 py-2.5 text-sm text-ink'>
                <span>Isi slot kosong dengan Bot AI</span>
                <input
                  type='checkbox'
                  checked={fillBots}
                  onChange={(e) => setFillBots(e.target.checked)}
                />
              </label>

              <label className='flex cursor-pointer items-center justify-between rounded-xl border border-line bg-paper/50 px-4 py-2.5 text-sm text-ink'>
                <span>Acak sirkuit baru setiap ronde</span>
                <input
                  type='checkbox'
                  checked={autoRandomTrack}
                  onChange={(e) => setAutoRandomTrack(e.target.checked)}
                />
              </label>

              <button
                type='button'
                onClick={() => startRace(false)}
                className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-base font-bold text-paper transition-opacity hover:opacity-90'
              >
                <Play aria-hidden className='size-5' />
                Mulai Balapan (
                {pads.length > 0 ? `${pads.length} HP` : 'Demo Keyboard / Bot'})
              </button>

              <p className='text-center text-xs text-mute'>
                Tips: Bisa juga main langsung di PC pakai tombol Panah / WASD
                untuk P1 sambil teman pakai HP.
              </p>
            </div>
          </section>
        </div>
      )}

      {(phase === 'playing' || phase === 'over') && (
        <div className='relative overflow-hidden rounded-2xl border border-line-strong bg-[#090d14] shadow-2xl'>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className='block aspect-video w-full'
          />

          {/* Live Standings HUD */}
          <div className='pointer-events-none absolute top-3 right-3 left-3 flex flex-wrap items-center justify-between gap-2'>
            <div className='flex flex-wrap gap-2'>
              {hudKarts.map((k, idx) => {
                const theme = TV_SLOTS[k.slot];
                return (
                  <div
                    key={k.slot}
                    className='flex items-center gap-2 rounded-lg border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-sm'
                  >
                    <span className='font-bold text-amber-300'>#{idx + 1}</span>
                    <span
                      className='size-2.5 rounded-full'
                      style={{ backgroundColor: theme.color }}
                    />
                    <span className='font-semibold'>{k.name}</span>
                    <span className='text-white/70'>
                      Lap {Math.min(k.lap, TOTAL_LAPS)}/{TOTAL_LAPS}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Finish Overlay */}
          {phase === 'over' && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'>
              <div className='w-full max-w-md rounded-2xl border border-line-strong bg-card p-6 text-center shadow-2xl'>
                <Trophy
                  aria-hidden
                  className='mx-auto size-10 text-amber-400'
                />
                <h2 className='mt-2 text-2xl font-black text-ink'>
                  Balapan Selesai!
                </h2>
                {winnerSlot !== null && (
                  <p className='mt-1 text-sm text-mute'>
                    Pemenang:{' '}
                    <strong className={TV_SLOTS[winnerSlot]?.text}>
                      {hudKarts[0]?.name ?? `P${winnerSlot + 1}`}
                    </strong>
                  </p>
                )}

                <ol className='mt-4 space-y-2 text-left'>
                  {hudKarts.map((k, idx) => (
                    <li
                      key={k.slot}
                      className='flex items-center justify-between rounded-lg border border-line bg-paper/60 px-3 py-2 text-sm'
                    >
                      <span className='flex items-center gap-2 font-semibold text-ink'>
                        <span className='text-amber-400'>#{idx + 1}</span>
                        <span
                          className='size-3 rounded-full'
                          style={{ backgroundColor: TV_SLOTS[k.slot]?.color }}
                        />
                        {k.name}
                      </span>
                      <span className='text-xs text-mute'>
                        {k.finishedAt !== null
                          ? `${k.finishedAt.toFixed(1)} dtk`
                          : `Lap ${k.lap}`}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className='mt-5 flex gap-3'>
                  <button
                    type='button'
                    onClick={() => startRace(autoRandomTrack)}
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
