import { fireEvent, render, screen, within } from '@testing-library/react';

import { monkeysGame as g, MonkeyState, MonkeyView } from '@/lib/games/monkeys';
import { DEFAULT_MONKEYS, MonkeyConfig } from '@/lib/games/monkeys-config';
import type { RoomView } from '@/lib/rooms/types';

import MonkeyTable from '@/components/games/monkeys/MonkeyTable';

const BLIND = 0;
const MUTE = 1;
const DEAF = 2;
const T0 = 1_000_000;

const cfg = (patch: Partial<MonkeyConfig> = {}): MonkeyConfig => ({
  ...DEFAULT_MONKEYS,
  roles: 'host',
  assign: ['blind', 'mute', 'deaf'],
  ...patch,
});

function bomb(patch: Partial<MonkeyConfig> = {}): MonkeyState {
  let s = g.start(3, () => 0.37, cfg(patch));
  for (const seat of [0, 1, 2])
    s = g.move(s, seat, { t: 'ready' }, () => 0.37, { host: 0, now: T0 });
  return s;
}

function show(state: MonkeyState, you: number, extra: Partial<RoomView> = {}) {
  const view = g.view(state, you, { host: 0, now: T0 + 5000 }) as MonkeyView;
  const r = {
    session: { code: 'ABCDE', token: 't', you },
    room: {
      code: 'ABCDE',
      game: 'monkeys',
      status:
        state.phase === 'playing' || state.phase === 'briefing'
          ? 'playing'
          : 'over',
      seat: you,
      joined: [true, true, true],
      names: ['Ani', 'Budi', 'Cici'],
      capacity: 3,
      minPlayers: 3,
      version: 1,
      state: view,
      options: state.config,
      out: [false, false, false],
      outWhy: [null, null, null],
      strikes: [0, 0, 0],
      maxStrikes: 3,
      host: 0,
      hostNotice: 0,
      leaving: [],
      waiting: null,
      ...extra,
    } as unknown as RoomView,
    receivedAt: Date.now(),
    busy: false,
    error: '',
    move: jest.fn(),
    rematch: jest.fn(),
    leave: jest.fn(),
  };
  render(<MonkeyTable r={r as never} view={view} />);
  return { r, view };
}

describe('the briefing', () => {
  it('tells each monkey its role and sends ready', () => {
    const s = g.start(3, () => 0.4, cfg());
    const { r } = show(s, MUTE);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Mute Monkey',
    );
    fireEvent.click(screen.getByRole('button', { name: /ready/i }));
    expect(r.move).toHaveBeenCalledWith({ t: 'ready' });
  });

  it('lets the Mute Monkey practise the wheel without sending anything', () => {
    const s = g.start(3, () => 0.4, cfg());
    const { r } = show(s, MUTE);
    fireEvent.click(screen.getByRole('button', { name: 'Two fingers' }));
    expect(r.move).not.toHaveBeenCalled();
  });
});

describe('the Mute Monkey', () => {
  it('has the manual and the gesture wheel, and no bomb', () => {
    show(bomb(), MUTE);
    expect(screen.getByText('The manual')).toBeInTheDocument();
    expect(screen.getAllByText(/Start with/).length).toBeGreaterThan(2);
    expect(screen.queryByText(/Mic on/)).toBeNull();
    expect(screen.queryByRole('button', { name: /wire/i })).toBeNull();
  });

  it('sends a gesture when one is tapped', () => {
    const { r } = show(bomb(), MUTE);
    fireEvent.click(screen.getByRole('button', { name: 'Point left' }));
    expect(r.move).toHaveBeenCalledWith({ t: 'gesture', g: 'left' });
  });

  it('offers every gesture on the wheel', () => {
    show(bomb(), MUTE);
    const wheel = screen.getByRole('group', { name: 'Gesture wheel' });
    expect(within(wheel).getAllByRole('button')).toHaveLength(15);
  });
});

describe('the Deaf Monkey', () => {
  it('sees the bomb in colour and the gestures, and has a microphone switch', () => {
    let s = bomb();
    s = g.move(s, MUTE, { t: 'gesture', g: 'three' }, () => 0.5, {
      host: 0,
      now: T0 + 1000,
    });
    show(s, DEAF);
    expect(screen.getAllByLabelText('Three fingers').length).toBeGreaterThan(0);
    expect(screen.queryByText('The manual')).toBeNull();
    expect(screen.getByRole('button', { name: /Mic/ })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(
      /red|blue|yellow|green|white|purple/i,
    );
  });

  it('cannot touch the bomb', () => {
    const { r } = show(bomb(), DEAF);
    document
      .querySelectorAll('ul.grid button')
      .forEach((b) => fireEvent.click(b));
    expect(r.move).not.toHaveBeenCalled();
  });
});

describe('the Blind Monkey', () => {
  it('sees no colour words, no manual and no gestures', () => {
    show(
      bomb({
        mode: 'custom',
        custom: { ...DEFAULT_MONKEYS.custom, modules: 5, difficulty: 3 },
      }),
      BLIND,
    );
    expect(document.body.textContent).not.toMatch(
      /\b(red|blue|yellow|green|white|purple)\b/i,
    );
    expect(screen.queryByText('The manual')).toBeNull();
    expect(screen.queryByText(/Start with/)).toBeNull();
    expect(screen.queryByText(/Lit|Dark|lamp/i)).toBeNull();
  });

  it('cuts a wire with a move the server can check', () => {
    const state = bomb({
      mode: 'custom',
      custom: {
        ...DEFAULT_MONKEYS.custom,
        kinds: ['wires'],
        modules: 3,
        difficulty: 1,
      },
    });
    const { r } = show(state, BLIND);
    fireEvent.click(screen.getAllByRole('button', { name: /^Wire 2/ })[0]);
    expect(r.move).toHaveBeenCalledWith({ t: 'act', m: 0, a: 'cut', i: 1 });
  });

  it('has a way to hear the Deaf Monkey and mute that sound', () => {
    show(bomb(), BLIND);
    expect(screen.getByRole('button', { name: /Sound/ })).toBeInTheDocument();
  });
});

describe('the end', () => {
  it('celebrates a defused bomb, and the campaign goes on', () => {
    const s = {
      ...bomb({ mode: 'campaign', level: 2 }),
      phase: 'won' as const,
      finishedWith: 77,
    };
    const { r } = show(s, BLIND);
    expect(screen.getByText('Bomb defused!')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next level' }));
    expect(r.rematch).toHaveBeenCalled();
  });

  it('blows up on too many mistakes', () => {
    const s = {
      ...bomb(),
      phase: 'exploded' as const,
      cause: 'mistakes' as const,
    };
    show(s, MUTE);
    expect(screen.getByText('BOOM!')).toBeInTheDocument();
    expect(screen.getByText('One mistake too many.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('says so when the team broke up', () => {
    const s = g.eliminate?.(bomb(), 1) as MonkeyState;
    show(s, DEAF);
    expect(screen.getByText('The team broke up')).toBeInTheDocument();
  });
});

describe('a monkey is away', () => {
  it('tells everybody the clock is paused', () => {
    const base = bomb();
    const paused = g.tick?.(base, T0 + 1000, undefined, [MUTE]) as MonkeyState;
    show(paused, DEAF, { leaving: [{ seat: MUTE, goneIn: 7 }] } as never);
    expect(screen.getByRole('alert')).toHaveTextContent(/paused/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/Mute Monkey/);
  });
});
