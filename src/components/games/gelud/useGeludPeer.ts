'use client';

import * as React from 'react';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type SignalKind = 'hello' | 'offer' | 'answer' | 'ice';

interface SignalMsg {
  id: string;
  kind: SignalKind;
  data: string;
}

export default function useGeludPeer({
  code,
  token,
  you,
  active,
  onMessage,
}: {
  code: string;
  token: string;
  you: number;
  active: boolean;
  onMessage: (raw: string) => void;
}) {
  const [connected, setConnected] = React.useState(false);
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

    let stopped = false;
    let lastId = '';
    let makingOffer = false;
    const isInitiator = you === 0;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const postSignal = async (kind: SignalKind, data: string) => {
      if (stopped) return;
      try {
        await fetch(`/api/rooms/${encodeURIComponent(code)}/signal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-player-token': token,
          },
          body: JSON.stringify({ kind, data }),
          cache: 'no-store',
        });
      } catch {
        // ignore transient errors
      }
    };

    const attachChannel = (ch: RTCDataChannel) => {
      channelRef.current = ch;
      ch.onopen = () => {
        if (!stopped) setConnected(true);
      };
      ch.onclose = () => {
        if (!stopped) setConnected(false);
      };
      ch.onmessage = (e) => {
        if (typeof e.data === 'string') onMessageRef.current(e.data);
      };
    };

    if (isInitiator) {
      attachChannel(pc.createDataChannel('gelud', { ordered: true }));
    } else {
      pc.ondatachannel = (e) => attachChannel(e.channel);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        void postSignal('ice', JSON.stringify(e.candidate));
      }
    };

    const startOffer = async () => {
      if (makingOffer || pc.signalingState !== 'stable') return;
      makingOffer = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal('offer', JSON.stringify(pc.localDescription));
      } catch {
        // ignore
      } finally {
        makingOffer = false;
      }
    };

    if (!isInitiator) {
      void postSignal('hello', '1');
    }

    const poll = async () => {
      if (stopped) return;
      try {
        const url = `/api/rooms/${encodeURIComponent(code)}/signal${
          lastId ? `?after=${encodeURIComponent(lastId)}` : ''
        }`;
        const res = await fetch(url, {
          headers: { 'x-player-token': token },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          signals?: SignalMsg[];
          last?: string | null;
        };
        if (data.last) lastId = data.last;
        for (const s of data.signals ?? []) {
          if (s.kind === 'hello' && isInitiator) {
            await startOffer();
          } else if (s.kind === 'offer' && !isInitiator) {
            await pc.setRemoteDescription(JSON.parse(s.data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await postSignal('answer', JSON.stringify(pc.localDescription));
          } else if (s.kind === 'answer' && isInitiator) {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(JSON.parse(s.data));
            }
          } else if (s.kind === 'ice') {
            try {
              await pc.addIceCandidate(JSON.parse(s.data));
            } catch {
              // ignore late/duplicate ICE candidate
            }
          }
        }
      } catch {
        // ignore transient poll errors
      }
    };

    const timer = window.setInterval(poll, 750);
    void poll();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      channelRef.current?.close();
      channelRef.current = null;
      pc.close();
      setConnected(false);
    };
  }, [active, code, token, you]);

  return { connected, send };
}
