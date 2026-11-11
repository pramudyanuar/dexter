import { act, renderHook, waitFor } from '@testing-library/react';

import useVoice from '@/components/games/monkeys/useVoice';

type Call = { url: string; body: { kind: string; data: string } | null };

const calls: Call[] = [];
let incoming: unknown[] = [];

class FakePC {
  static all: FakePC[] = [];
  connectionState = 'new';
  localDescription: unknown = null;
  remoteDescription: unknown = null;
  tracks: unknown[] = [];
  closed = false;
  onicecandidate: ((e: unknown) => void) | null = null;
  ontrack: ((e: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() {
    FakePC.all.push(this);
  }
  addTrack(t: unknown) {
    this.tracks.push(t);
  }
  async createOffer() {
    return { type: 'offer', sdp: 'o' };
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'a' };
  }
  async setLocalDescription(d: unknown) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
  }
  async addIceCandidate() {}
  close() {
    this.closed = true;
  }
}

const track = { enabled: true, stop: jest.fn() };
const fakeStream = { getAudioTracks: () => [track], getTracks: () => [track] };

beforeEach(() => {
  calls.length = 0;
  incoming = [];
  FakePC.all = [];
  track.enabled = true;
  (global as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection =
    FakePC;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return { ok: true, json: async () => ({ ok: true }) };
    }
    const signals = incoming;
    incoming = [];
    return { ok: true, json: async () => ({ signals, last: 'z' }) };
  }) as never;
});

const session = { code: 'ABCDE', token: 't' };

describe('the Deaf Monkey’s microphone', () => {
  it('says so when the microphone is blocked', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('no'), { name: 'NotAllowedError' }),
          ),
      },
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 0, dir: 'send' }),
    );
    await waitFor(() => expect(result.current.status).toBe('denied'));
  });

  it('says so when there is no microphone', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest
          .fn()
          .mockRejectedValue(
            Object.assign(new Error('none'), { name: 'NotFoundError' }),
          ),
      },
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 0, dir: 'send' }),
    );
    await waitFor(() => expect(result.current.status).toBe('nomic'));
  });

  it('waits for the Blind Monkey, then offers the microphone when they call', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(fakeStream) },
    });
    // a hello left over from before this page opened belongs to an old call
    incoming = [{ id: 'a', kind: 'hello', from: 0, to: 2, data: '' }];
    const { result } = renderHook(() =>
      useVoice(session, { peer: 0, dir: 'send' }),
    );
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    expect(FakePC.all).toHaveLength(0);
    incoming = [{ id: 'b', kind: 'hello', from: 0, to: 2, data: '' }];
    await waitFor(() => expect(FakePC.all).toHaveLength(1), { timeout: 3000 });
    expect(FakePC.all[0].tracks).toHaveLength(1);
    await waitFor(() =>
      expect(calls.some((c) => c.body?.kind === 'offer')).toBe(true),
    );
  });

  it('switches the microphone off and on', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(fakeStream) },
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 0, dir: 'send' }),
    );
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    act(() => result.current.toggleMute());
    expect(result.current.muted).toBe(true);
    expect(track.enabled).toBe(false);
    act(() => result.current.toggleMute());
    expect(track.enabled).toBe(true);
  });

  it('lets go of the microphone when the call ends', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(fakeStream) },
    });
    const { result, unmount } = renderHook(() =>
      useVoice(session, { peer: 0, dir: 'send' }),
    );
    await waitFor(() => expect(result.current.status).toBe('waiting'));
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('the Blind Monkey’s call', () => {
  it('calls out until somebody answers, and never asks for a microphone', async () => {
    const getUserMedia = jest.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 2, dir: 'receive' }),
    );
    await waitFor(() =>
      expect(calls.some((c) => c.body?.kind === 'hello')).toBe(true),
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(result.current.status).toBe('waiting');
  });

  it('answers an offer', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 2, dir: 'receive' }),
    );
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    incoming = [
      {
        id: 'o1',
        kind: 'offer',
        from: 2,
        to: 0,
        data: JSON.stringify({ type: 'offer', sdp: 'x' }),
      },
    ];
    await waitFor(
      () => expect(calls.some((c) => c.body?.kind === 'answer')).toBe(true),
      { timeout: 3000 },
    );
    expect(FakePC.all[0].remoteDescription).toEqual({
      type: 'offer',
      sdp: 'x',
    });
    expect(result.current.status).toBe('connecting');
  });

  it('can switch the sound off on its own side', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });
    const { result } = renderHook(() =>
      useVoice(session, { peer: 2, dir: 'receive' }),
    );
    act(() => result.current.toggleDeafen());
    expect(result.current.deafened).toBe(true);
  });
});

describe('a game without voice', () => {
  it('stays off and asks for nothing', async () => {
    const { result } = renderHook(() => useVoice(session, null));
    expect(result.current.status).toBe('off');
    expect(calls).toHaveLength(0);
  });
});
