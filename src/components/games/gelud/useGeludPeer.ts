'use client';

import * as React from 'react';

import { iceServers } from '@/lib/rooms/ice-servers';
import { Signal, SIGNAL_KEEP } from '@/lib/rooms/types';

const REQUEST_TIMEOUT_MS = 4000;
const ATTEMPT_MS = 18_000;
const DISCONNECT_GRACE_MS = 3000;
const MAX_ATTEMPTS = 3;
const MAX_BUFFERED_BYTES = 24_000;

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
    if (ch?.readyState === 'open' && ch.bufferedAmount < MAX_BUFFERED_BYTES) {
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
    const reconnectRequest =
      initiator && retryCount > 0 ? crypto.randomUUID() : '';
    let requestSent = false;
    let initialized = false;
    let lastId = '';
    let polling = false;
    let pc: RTCPeerConnection | null = null;
    let attempt = '';
    const retired = new Set<string>();
    let startedAt = Date.now();
    let attemptCount = 0;
    let disconnectedAt: number | null = null;
    let helloAt = 0;
    let online = false;
    let pendingIce: RTCIceCandidateInit[] = [];

    const requestSignal = () =>
      AbortSignal.any([abort.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);

    const post = async (
      kind: Signal['kind'],
      id: string,
      data?: object | null,
    ) => {
      // Offers and answers are resent by the handshake. Each trickled candidate
      // is otherwise sent only once, so retry its delivery separately.
      const askingGuest = kind === 'hello' && id === reconnectRequest;
      const tries = kind === 'ice' || askingGuest ? 2 : 1;
      for (
        let i = 0;
        i < tries && !abort.signal.aborted && (id === attempt || askingGuest);
        i++
      ) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind,
              data: JSON.stringify({ match, attempt: id, data }),
            }),
            cache: 'no-store',
            signal: requestSignal(),
          });
          if (res.ok || (res.status < 500 && res.status !== 429)) return;
        } catch {
          // The next attempt uses a fresh request timeout.
        }
      }
    };

    const markConnected = (value: boolean) => {
      if (abort.signal.aborted || online === value) return;
      online = value;
      if (value) {
        attemptCount = 0;
        disconnectedAt = null;
        setTimedOut(false);
      }
      setConnected(value);
    };

    const close = () => {
      const previous = pc;
      pc = null;
      disconnectedAt = null;
      channelRef.current?.close();
      channelRef.current = null;
      previous?.close();
    };

    const open = (id: string) => {
      if (attempt && attempt !== id) retired.add(attempt);
      close();
      markConnected(false);
      setTimedOut(false);
      const peer = new RTCPeerConnection({ iceServers: iceServers() });
      pc = peer;
      attempt = id;
      startedAt = Date.now();
      attemptCount++;
      pendingIce = [];

      const current = () => pc === peer && !abort.signal.aborted;
      const disconnected = () => {
        if (!current()) return;
        if (online) startedAt = Date.now() - ATTEMPT_MS;
        disconnectedAt = null;
        markConnected(false);
      };
      const attach = (channel: RTCDataChannel) => {
        if (!current()) return;
        channelRef.current = channel;
        channel.onopen = () => {
          if (current()) markConnected(true);
        };
        channel.onclose = disconnected;
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
          disconnectedAt = null;
          markConnected(true);
        } else if (peer.connectionState === 'disconnected' && online) {
          disconnectedAt ??= Date.now();
        } else if (peer.connectionState === 'failed') {
          disconnected();
        }
      };
      return peer;
    };

    const setRemote = async (
      peer: RTCPeerConnection,
      description: RTCSessionDescriptionInit,
    ) => {
      await peer.setRemoteDescription(description);
      if (pc !== peer || abort.signal.aborted) return;
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

      if (kind === 'hello' && !initiator) {
        if (retired.has(id)) return;
        retired.add(id);
        markConnected(false);
        attemptCount = 0;
        startedAt = Date.now() - ATTEMPT_MS;
        helloAt = 0;
        return;
      }
      if (kind === 'hello' && initiator) {
        if (retired.has(id) || (id === attempt && online)) return;
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
        if (online) return;
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
        if (
          disconnectedAt !== null &&
          Date.now() - disconnectedAt >= DISCONNECT_GRACE_MS
        ) {
          disconnectedAt = null;
          markConnected(false);
          startedAt = Date.now() - ATTEMPT_MS;
        }
        const res = await fetch(
          `${url}${lastId ? `?after=${encodeURIComponent(lastId)}` : ''}`,
          {
            headers,
            cache: 'no-store',
            signal: requestSignal(),
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
        if (reconnectRequest && !requestSent && !online) {
          requestSent = true;
          void post('hello', reconnectRequest);
        }
        if (!initiator && !online && now >= helloAt) {
          if (!pc || now - startedAt >= ATTEMPT_MS) {
            if (attemptCount >= MAX_ATTEMPTS) {
              setTimedOut(true);
              return;
            }
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
          !online &&
          Date.now() - startedAt >= ATTEMPT_MS &&
          (!initialized || initiator || attemptCount >= MAX_ATTEMPTS)
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
