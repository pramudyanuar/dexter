import { act, renderHook } from '@testing-library/react';

import type { Signal } from '@/lib/rooms/types';

import useGeludPeer from '@/components/games/gelud/useGeludPeer';

class Peer {
  static peers: Peer[] = [];
  connectionState = 'new';
  signalingState = 'stable';
  localDescription: RTCSessionDescriptionInit | null = null;
  onconnectionstatechange?: () => void;
  onicecandidate?: (event: { candidate: { toJSON: () => object } }) => void;
  channel = {
    readyState: 'connecting',
    onopen: () => undefined as void,
    close: jest.fn(),
  };
  close = jest.fn();

  constructor() {
    Peer.peers.push(this);
  }

  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'offer' } as const;
  }
  async setLocalDescription(description: RTCSessionDescriptionInit) {
    this.localDescription = description;
    this.signalingState = 'have-local-offer';
  }
}

const originalPeer = Object.getOwnPropertyDescriptor(
  globalThis,
  'RTCPeerConnection',
);
const originalFetch = global.fetch;
const signal = (attempt: string): Signal => ({
  id: attempt,
  from: 1,
  to: 0,
  kind: 'hello',
  data: JSON.stringify({ match: 0, attempt }),
  at: 0,
});

function setup(you: number) {
  const inbox: Signal[] = [];
  const posted: { kind: Signal['kind']; attempt: string }[] = [];
  let failFirstIce = true;
  global.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const { kind, data } = JSON.parse(init.body as string);
      posted.push({ kind, attempt: JSON.parse(data).attempt });
      if (kind === 'ice' && failFirstIce) {
        failFirstIce = false;
        return { ok: false, status: 503 };
      }
    }
    return { ok: true, json: async () => ({ signals: inbox.splice(0) }) };
  }) as unknown as typeof fetch;
  const hook = renderHook(() =>
    useGeludPeer({
      code: 'ABCDE',
      token: 'token',
      you,
      match: 0,
      active: true,
      onMessage: () => undefined,
    }),
  );
  return { ...hook, inbox, posted };
}

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, 'RTCPeerConnection', {
    configurable: true,
    value: Peer,
  });
  Peer.peers = [];
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
  if (originalPeer)
    Object.defineProperty(globalThis, 'RTCPeerConnection', originalPeer);
  else Reflect.deleteProperty(globalThis, 'RTCPeerConnection');
});

const advance = async (ms: number) => {
  await act(async () => jest.advanceTimersByTimeAsync(ms));
};

it('retries an ICE write, allows a brief disconnect, and ignores an older attempt', async () => {
  const { result, posted, inbox, unmount } = setup(0);
  await advance(0);
  inbox.push(signal('first'));
  await advance(750);
  const first = Peer.peers[0];
  await act(async () =>
    first.onicecandidate?.({
      candidate: { toJSON: () => ({ candidate: 'test' }) },
    }),
  );
  expect(posted.filter(({ kind }) => kind === 'ice')).toHaveLength(2);

  act(() => {
    first.channel.readyState = 'open';
    first.channel.onopen();
    first.connectionState = 'disconnected';
    first.onconnectionstatechange?.();
  });
  await advance(1500);
  expect(result.current.connected).toBe(true);
  act(() => {
    first.connectionState = 'connected';
    first.onconnectionstatechange?.();
  });
  await advance(3000);
  expect(result.current.connected).toBe(true);

  inbox.push(signal('new'), signal('first'));
  await advance(750);
  expect(Peer.peers).toHaveLength(2);
  expect(Peer.peers[1].close).not.toHaveBeenCalled();
  expect(posted.at(-1)).toEqual({ kind: 'offer', attempt: 'new' });
  unmount();
});

it('stops automatic retries and accepts a fresh reconnect request from the host', async () => {
  const { result, inbox, posted, unmount } = setup(1);
  await advance(61_000);
  expect(result.current.timedOut).toBe(true);
  expect(new Set(posted.map(({ attempt }) => attempt)).size).toBe(3);
  expect(Peer.peers).toHaveLength(3);

  inbox.push(signal('host-retry'));
  await advance(1500);
  expect(Peer.peers).toHaveLength(4);
  expect(result.current.timedOut).toBe(false);
  unmount();
});
