'use client';

import * as React from 'react';

import type { Signal } from '@/lib/rooms/types';

/**
 * Real voice chat between two browsers (WebRTC). The Deaf Monkey sends its
 * microphone, the Blind Monkey receives it; nobody else is connected, and the
 * Deaf Monkey never plays anything back. The game server only relays the call
 * set-up (see /api/rooms/[code]/signal): the audio goes browser to browser.
 *
 * The Blind Monkey calls out ("hello") and the Deaf Monkey answers with an
 * offer, so either side can reload at any time and the call is built again.
 */

export type VoiceStatus =
  | 'off'
  | 'asking' // waiting for the microphone permission
  | 'denied'
  | 'nomic'
  | 'waiting' // set up, but the other monkey is not there yet
  | 'connecting'
  | 'live'
  | 'lost'; // dropped, trying again

export interface VoiceInfo {
  peer: number;
  dir: 'send' | 'receive';
}

const POLL_MS = 700;
const HELLO_MS = 2500;
const LOST_AFTER_MS = 4000;

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  // a relay for networks that block direct calls, when the site has one
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  if (url) {
    servers.push({
      urls: url.split(','),
      username: process.env.NEXT_PUBLIC_TURN_USER,
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD,
    });
  }
  return servers;
}

export interface Voice {
  status: VoiceStatus;
  /** The microphone is switched off (Deaf Monkey) */
  muted: boolean;
  /** The sound is switched off on this side (Blind Monkey) */
  deafened: boolean;
  /** 0..1, how loud the voice is right now */
  level: number;
  /** Sound is waiting for a tap, because the browser blocked playing it */
  blocked: boolean;
  toggleMute: () => void;
  toggleDeafen: () => void;
  /** Ask for the microphone (again) or let the browser play the sound */
  retry: () => void;
}

export default function useVoice(
  session: { code: string; token: string } | null,
  voice: VoiceInfo | null,
): Voice {
  const [status, setStatus] = React.useState<VoiceStatus>('off');
  const [muted, setMuted] = React.useState(false);
  const [deafened, setDeafened] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const [blocked, setBlocked] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  const stream = React.useRef<MediaStream | null>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const mutedRef = React.useRef(false);
  const deafRef = React.useRef(false);

  const code = session?.code;
  const token = session?.token;
  const dir = voice?.dir;
  const peer = voice?.peer;

  React.useEffect(() => {
    mutedRef.current = muted;
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);
  React.useEffect(() => {
    deafRef.current = deafened;
    if (audio.current) audio.current.muted = deafened;
  }, [deafened]);

  React.useEffect(() => {
    if (!code || !token || !dir || peer === undefined) return;
    if (typeof RTCPeerConnection === 'undefined') {
      const t = setTimeout(() => setStatus('nomic'), 0);
      return () => clearTimeout(t);
    }

    let stopped = false;
    let pc: RTCPeerConnection | null = null;
    let mic: MediaStream | null = null;
    let after: string | null = null;
    let seen = false;
    let lostAt = 0;
    let helloAt = 0;
    let remoteSet = false;
    let queued: RTCIceCandidateInit[] = [];
    let meter: { stop: () => void } | null = null;

    const post = (kind: Signal['kind'], data = '') =>
      fetch(`/api/rooms/${code}/signal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-token': token,
        },
        body: JSON.stringify({ kind, data }),
      }).catch(() => {});

    const listen = (media: MediaStream) => {
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        const ac = new AC();
        const src = ac.createMediaStreamSource(media);
        const an = ac.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const timer = setInterval(() => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, peak / 60));
        }, 120);
        meter = {
          stop: () => {
            clearInterval(timer);
            void ac.close().catch(() => {});
          },
        };
      } catch {
        // no meter: the call works without it
      }
    };

    const close = () => {
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      pc = null;
      remoteSet = false;
      queued = [];
    };

    const open = () => {
      close();
      const next = new RTCPeerConnection({ iceServers: iceServers() });
      pc = next;
      next.onicecandidate = (e) => {
        if (e.candidate) void post('ice', JSON.stringify(e.candidate));
      };
      next.onconnectionstatechange = () => {
        if (stopped || pc !== next) return;
        const s = next.connectionState;
        if (s === 'connected') {
          lostAt = 0;
          setStatus('live');
        } else if (s === 'connecting') {
          setStatus((old) => (old === 'live' ? 'lost' : 'connecting'));
        } else if (s === 'disconnected' || s === 'failed') {
          lostAt ||= Date.now();
          setStatus('lost');
        }
      };
      if (dir === 'receive') {
        next.ontrack = (e) => {
          const el = audio.current;
          if (!el) return;
          el.srcObject = e.streams[0] ?? new MediaStream([e.track]);
          el.muted = deafRef.current;
          el.play().then(
            () => setBlocked(false),
            () => setBlocked(true),
          );
          listen(e.streams[0] ?? new MediaStream([e.track]));
        };
      }
      return next;
    };

    const flush = async () => {
      if (!pc) return;
      for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
      queued = [];
    };

    const handle = async (s: Signal) => {
      try {
        if (s.kind === 'hello' && dir === 'send') {
          // the Blind Monkey is (back) on the line: ring them with a fresh offer
          if (!mic) return;
          const next = open();
          mic.getAudioTracks().forEach((t) => next.addTrack(t, mic!));
          const offer = await next.createOffer();
          await next.setLocalDescription(offer);
          setStatus('connecting');
          await post('offer', JSON.stringify(offer));
        } else if (s.kind === 'offer' && dir === 'receive') {
          const next = open();
          await next.setRemoteDescription(JSON.parse(s.data));
          remoteSet = true;
          await flush();
          const answer = await next.createAnswer();
          await next.setLocalDescription(answer);
          setStatus('connecting');
          await post('answer', JSON.stringify(answer));
        } else if (s.kind === 'answer' && dir === 'send' && pc) {
          await pc.setRemoteDescription(JSON.parse(s.data));
          remoteSet = true;
          await flush();
        } else if (s.kind === 'ice' && pc) {
          const candidate = JSON.parse(s.data) as RTCIceCandidateInit;
          if (remoteSet) await pc.addIceCandidate(candidate).catch(() => {});
          else queued.push(candidate);
        }
      } catch {
        // a broken message: the next hello starts the call again
      }
    };

    const poll = async () => {
      if (stopped) return;
      try {
        const res = await fetch(
          `/api/rooms/${code}/signal${after ? `?after=${after}` : ''}`,
          { cache: 'no-store', headers: { 'x-player-token': token } },
        );
        if (!res.ok || stopped) return;
        const data = (await res.json()) as {
          signals: Signal[];
          last: string | null;
        };
        if (!seen) {
          // whatever was said before this page opened belongs to an old call
          seen = true;
          after = data.last;
        } else {
          // several hellos in a row are one request for a call
          const lastHello = data.signals
            .map((x) => x.kind)
            .lastIndexOf('hello');
          for (const [i, s] of data.signals.entries()) {
            after = s.id;
            if (s.kind !== 'hello' || i === lastHello) await handle(s);
          }
        }
      } catch {
        // offline for a moment: try again
      }
      const now = Date.now();
      if (dir === 'receive') {
        // keep calling until the Deaf Monkey picks up, and again after a drop
        const connected = pc?.connectionState === 'connected';
        const dropped = lostAt && now - lostAt > LOST_AFTER_MS;
        if (!connected && now - helloAt > HELLO_MS) {
          helloAt = now;
          if (dropped) {
            close();
            lostAt = 0;
          }
          void post('hello');
        }
      } else if (lostAt && now - lostAt > LOST_AFTER_MS * 2) {
        // the Deaf Monkey waits for the Blind Monkey to call again
        close();
        lostAt = 0;
        setStatus('waiting');
      }
    };

    const run = async () => {
      if (dir === 'send') {
        setStatus('asking');
        try {
          mic = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (err) {
          if (stopped) return;
          const name = (err as { name?: string }).name;
          setStatus(name === 'NotFoundError' ? 'nomic' : 'denied');
          return;
        }
        if (stopped) {
          mic.getTracks().forEach((t) => t.stop());
          return;
        }
        mic.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
        stream.current = mic;
        listen(mic);
      }
      setStatus('waiting');
      void poll();
    };

    void run();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      meter?.stop();
      close();
      mic?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      if (audio.current) audio.current.srcObject = null;
    };
  }, [code, token, dir, peer, nonce]);

  // the element the Blind Monkey hears through
  React.useEffect(() => {
    if (dir !== 'receive') return;
    const el = document.createElement('audio');
    el.autoplay = true;
    audio.current = el;
    return () => {
      el.srcObject = null;
      audio.current = null;
    };
  }, [dir]);

  return {
    status: voice ? status : 'off',
    muted,
    deafened,
    level,
    blocked,
    toggleMute: () => setMuted((m) => !m),
    toggleDeafen: () => setDeafened((d) => !d),
    retry: () => {
      if (dir === 'receive' && audio.current?.srcObject) {
        void audio.current.play().then(() => setBlocked(false));
      } else {
        setNonce((n) => n + 1);
      }
    },
  };
}
