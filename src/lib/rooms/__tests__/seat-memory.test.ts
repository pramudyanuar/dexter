import {
  forgetSeat,
  holdSeat,
  recallSeat,
  rememberSeat,
} from '@/lib/rooms/seat-memory';

/** A tiny Web Locks: a lock is held until the callback's promise settles. */
function fakeLocks() {
  const held = new Set<string>();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      query: async () => ({ held: [...held].map((name) => ({ name })) }),
      request: (name: string, cb: () => Promise<void>) => {
        held.add(name);
        return cb().finally(() => held.delete(name));
      },
    },
  });
  return held;
}

beforeEach(() => {
  localStorage.clear();
  fakeLocks();
});

describe('seat memory', () => {
  it('gives back the seat you had in a room', async () => {
    rememberSeat('chess', 'ABCDE', { token: 'tok', you: 1 });
    expect(await recallSeat('chess', 'ABCDE')).toEqual({
      token: 'tok',
      you: 1,
    });
  });

  it('knows nothing about rooms or games it has not seen', async () => {
    rememberSeat('chess', 'ABCDE', { token: 'tok', you: 1 });
    expect(await recallSeat('chess', 'ZZZZZ')).toBeNull();
    expect(await recallSeat('uno', 'ABCDE')).toBeNull();
  });

  it('forgets a room on request', async () => {
    rememberSeat('chess', 'ABCDE', { token: 'tok', you: 1 });
    forgetSeat('chess', 'ABCDE');
    expect(await recallSeat('chess', 'ABCDE')).toBeNull();
  });

  it('does not hand a seat to a second tab while the first still holds it', async () => {
    rememberSeat('chess', 'ABCDE', { token: 'tok', you: 0 });
    const release = holdSeat('tok');
    expect(await recallSeat('chess', 'ABCDE')).toBeNull();

    release(); // the player left the room (or closed the tab)
    await Promise.resolve();
    await Promise.resolve();
    expect(await recallSeat('chess', 'ABCDE')).toEqual({
      token: 'tok',
      you: 0,
    });
  });

  it('remembers two seats in one room, for two tabs of one browser', async () => {
    rememberSeat('chess', 'ABCDE', { token: 'host', you: 0 });
    rememberSeat('chess', 'ABCDE', { token: 'guest', you: 1 });
    const releaseGuest = holdSeat('guest');

    // the guest tab is open, so a returning tab gets the host's seat
    expect(await recallSeat('chess', 'ABCDE')).toEqual({
      token: 'host',
      you: 0,
    });

    const releaseHost = holdSeat('host');
    expect(await recallSeat('chess', 'ABCDE')).toBeNull();
    releaseGuest();
    releaseHost();
  });

  it('keeps only the newest few rooms', async () => {
    jest.useFakeTimers();
    for (let i = 0; i < 12; i++) {
      jest.setSystemTime(1000 + i);
      rememberSeat('uno', `R${i}`, { token: `t${i}`, you: 0 });
    }
    jest.useRealTimers();
    expect(await recallSeat('uno', 'R0')).toBeNull();
    expect(await recallSeat('uno', 'R11')).not.toBeNull();
  });

  it('survives broken storage contents', async () => {
    localStorage.setItem('room-seats-chess', '{not json');
    expect(await recallSeat('chess', 'ABCDE')).toBeNull();
    expect(() =>
      rememberSeat('chess', 'ABCDE', { token: 't', you: 0 }),
    ).not.toThrow();
  });
});
