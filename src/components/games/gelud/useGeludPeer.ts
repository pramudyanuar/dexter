'use client';

import * as React from 'react';

import { iceServers } from '@/lib/rooms/ice-servers';
import { Signal, SIGNAL_KEEP } from '@/lib/rooms/types';

const RETRY_MS = 12_000;

export default function useGeludPeer({
  code,
  token,
  you,
  match,
  active,
  onMessage,
}: {
  code: string;
  token: string;
  you: number;
  match: number;
  active: boolean;
  onMessage: (raw: string) => void;
}) {
  const [connected, setConnected] = React.useState(false);
  const [timedOut, setTimedOut] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const channelRef = React.useRef<RTCDataChannel | null>(null);
  const onMessageRef = React.useRef(onMessage);

  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = React.useCallback((payload: unknown) => {
    const ch = channelRef.current;
    if (ch && ch.readyState === 'open') {
      try {
        ch.send(JSON.stringify(payload));
      } catch {
        // ignore transient send errors
      }
    }
  }, []);

  React.useEffect(() => {
    if (!active || !code || !token) return;
    if (typeof RTCPeerConnection === 'undefined') return;

    const abort = new AbortController();
    const url = `/api/rooms/${encodeURIComponent(code)}/signal`;
    const headers = { 'x-player-token': token };
    const initiator = you === 0;
    let initialized = false;
    let lastId = '';
    let polling = false;
    let pc: RTCPeerConnection | null = null;
    let attempt = '';
    let waitingSince = Date.now();
    let attemptAt = waitingSince;
    let helloAt = 0;
    let online = false;
    let pendingIce: RTCIceCandidateInit[] = [];

    const post = (kind: Signal['kind'], id: string, data?: object | null) =>
      fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          data: JSON.stringify({ match, attempt: id, data }),
        }),
        cache: 'no-store',
        signal: abort.signal,
      }).catch(() => undefined);

    const markConnected = (value: boolean) => {
      online = value;
      if (value) {
        waitingSince = 0;
        setTimedOut(false);
      } else {
        waitingSince ||= Date.now();
      }
      setConnected(value);
    };

    const close = () => {
      const previous = pc;
      pc = null;
      channelRef.current?.close();
      channelRef.current = null;
      previous?.close();
    };

    const open = (id: string) => {
      close();
      markConnected(false);
      const peer = new RTCPeerConnection({ iceServers: iceServers() });
      pc = peer;
      attempt = id;
      attemptAt = Date.now();
      pendingIce = [];

      const current = () => pc === peer && !abort.signal.aborted;
      const attach = (channel: RTCDataChannel) => {
        if (!current()) return;
        channelRef.current = channel;
        channel.onopen = () => {
          if (current()) markConnected(true);
        };
        channel.onclose = () => {
          if (current()) markConnected(false);
        };
        channel.onmessage = (event) => {
          if (current() && typeof event.data === 'string')
            onMessageRef.current(event.data);
        };
        if (channel.readyState === 'open') markConnected(true);
      };
      if (initiator) attach(peer.createDataChannel('gelud'));
      else peer.ondatachannel = (event) => attach(event.channel);

      peer.onicecandidate = (event) => {
        if (current() && event.candidate)
          void post('ice', id, event.candidate.toJSON());
      };
      peer.onconnectionstatechange = () => {
        if (!current()) return;
        if (
          peer.connectionState === 'connected' &&
          channelRef.current?.readyState === 'open'
        ) {
          markConnected(true);
        } else if (
          peer.connectionState === 'disconnected' ||
          peer.connectionState === 'failed'
        ) {
          markConnected(false);
        }
      };
      return peer;
    };

    const setRemote = async (
      peer: RTCPeerConnection,
      description: RTCSessionDescriptionInit,
    ) => {
      await peer.setRemoteDescription(description);
      for (const candidate of pendingIce.splice(0)) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      }
    };

    const handle = async ({ kind, data }: Signal) => {
      const incoming = JSON.parse(data) as {
        match?: number;
        attempt?: string;
        data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
      } | null;
      const id = incoming?.attempt;
      if (incoming?.match !== match || typeof id !== 'string' || !id) return;

      if (kind === 'hello' && initiator) {
        const peer = pc && attempt === id ? pc : open(id);
        if (!peer.localDescription)
          await peer.setLocalDescription(await peer.createOffer());
        if (peer.signalingState === 'have-local-offer') {
          void post('offer', id, peer.localDescription);
        }
        return;
      }
      const peer = pc;
      if (!peer || id !== attempt || !incoming.data) return;
      if (kind === 'offer' && !initiator) {
        if (!peer.remoteDescription)
          await setRemote(peer, incoming.data as RTCSessionDescriptionInit);
        if (!peer.localDescription)
          await peer.setLocalDescription(await peer.createAnswer());
        void post('answer', id, peer.localDescription);
      } else if (
        kind === 'answer' &&
        initiator &&
        peer.signalingState === 'have-local-offer'
      ) {
        await setRemote(peer, incoming.data as RTCSessionDescriptionInit);
      } else if (kind === 'ice') {
        const candidate = incoming.data as RTCIceCandidateInit;
        if (peer.remoteDescription) await peer.addIceCandidate(candidate);
        else if (pendingIce.length < SIGNAL_KEEP) pendingIce.push(candidate);
      }
    };

    const poll = async () => {
      if (abort.signal.aborted || polling) return;
      polling = true;
      try {
        const res = await fetch(
          `${url}${lastId ? `?after=${encodeURIComponent(lastId)}` : ''}`,
          {
            headers,
            cache: 'no-store',
            signal: abort.signal,
          },
        );
        if (!res.ok || abort.signal.aborted) return;
        const { signals, last } = (await res.json()) as {
          signals: Signal[];
          last?: string;
        };
        // A page reload must ignore offers and candidates from previous peers.
        if (initialized) {
          for (const signal of signals) {
            if (abort.signal.aborted) return;
            await handle(signal).catch(() => undefined);
          }
        }
        initialized = true;
        if (last) lastId = last;
        const now = Date.now();
        if (!initiator && !online && now >= helloAt) {
          if (
            !pc ||
            (waitingSince &&
              now - Math.max(waitingSince, attemptAt) >= RETRY_MS)
          ) {
            open(crypto.randomUUID());
          }
          helloAt = now + 2000;
          void post('hello', attempt);
        }
      } catch {
        // ignore transient poll errors
      } finally {
        if (
          !abort.signal.aborted &&
          waitingSince &&
          Date.now() - waitingSince >= RETRY_MS
        ) {
          setTimedOut(true);
        }
        polling = false;
      }
    };

    const timer = window.setInterval(poll, 750);
    void poll();

    return () => {
      abort.abort();
      window.clearInterval(timer);
      close();
      setConnected(false);
      setTimedOut(false);
    };
  }, [active, code, token, you, match, retryCount]);

  return {
    connected,
    timedOut,
    supported: typeof RTCPeerConnection !== 'undefined',
    send,
    retry: () => setRetryCount((count) => count + 1),
  };
}
