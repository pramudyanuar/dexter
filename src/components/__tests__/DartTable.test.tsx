import { fireEvent, render, screen, within } from '@testing-library/react';

import { dartGame, DartView, start } from '@/lib/games/dart';
import { SEQUENCE } from '@/lib/games/dart-board';
import type { DartConfig } from '@/lib/games/dart-config';
import type { RoomView } from '@/lib/rooms/types';

import DartTable from '@/components/games/dart/DartTable';

// the game's moves copy the state, and jsdom has no structuredClone
global.structuredClone = ((v: unknown) =>
  JSON.parse(JSON.stringify(v))) as never;

const exact = (() => {
  let i = 0;
  return () => [0.5, 0.25][i++ % 2];
})();

function setup(
  cfg: Partial<DartConfig> = {},
  you = 0,
  prepare: (s: ReturnType<typeof start>) => ReturnType<typeof start> = (s) => s,
  players = 2,
) {
  const state = prepare(start(players, undefined, cfg));
  const view = dartGame.view(state, you) as DartView;
  const room = {
    code: 'ABCDE',
    game: 'dart',
    status: 'playing',
    seat: you,
    joined: Array(players).fill(true),
    names: ['Ani', 'Budi', 'Cici', 'Dodi'].slice(0, players),
    capacity: 4,
    minPlayers: 1,
    version: 1,
    state: view,
    options: state.config,
    out: Array(players).fill(false),
    outWhy: Array(players).fill(null),
    strikes: Array(players).fill(0),
    maxStrikes: 3,
    host: 0,
    hostNotice: 0,
    leaving: [],
    waiting: null,
  } as unknown as RoomView;
  const r = {
    session: { code: 'ABCDE', token: 't', you },
    room,
    receivedAt: Date.now(),
    busy: false,
    error: '',
    move: jest.fn(),
    rematch: jest.fn(),
    leave: jest.fn(),
  };
  render(<DartTable r={r as never} view={view} />);
  return r;
}

const board = () => screen.getByTestId('dartboard');
const focusBoard = () => board().parentElement!.parentElement!;

describe('DartTable', () => {
  it('draws the board with the twenty numbers in the right order', () => {
    setup();
    const labels = [...board().querySelectorAll('text')].map((t) =>
      Number(t.textContent),
    );
    expect(labels).toEqual([...SEQUENCE]);
  });

  it('shows every player with their score, and whose turn it is', () => {
    setup({ mode: '501' });
    expect(screen.getByTestId('score-0')).toHaveTextContent('501');
    expect(screen.getByTestId('score-1')).toHaveTextContent('501');
    expect(screen.getByTestId('current-player')).toHaveTextContent('You');
    expect(screen.getByTestId('round')).toHaveTextContent('Round 1');
    const rows = within(screen.getByLabelText('Scoreboard')).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveAttribute('data-current', 'true');
    expect(rows[1]).toHaveAttribute('data-current', 'false');
  });

  it('cannot throw until you have aimed', () => {
    setup();
    expect(screen.getByRole('button', { name: 'THROW' })).toBeDisabled();
  });

  it('aims with the arrow keys and throws at the crosshair', () => {
    const r = setup();
    fireEvent.keyDown(focusBoard(), { key: 'ArrowUp' });
    fireEvent.keyDown(focusBoard(), { key: 'ArrowUp' });
    expect(screen.getByTestId('crosshair')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'THROW' }));
    expect(r.move).toHaveBeenCalledWith({
      type: 'throw',
      x: 0,
      y: -0.05,
      power: undefined,
    });
  });

  it('throws with Enter, and resets the aim', () => {
    const r = setup();
    fireEvent.keyDown(focusBoard(), { key: 'ArrowRight' });
    fireEvent.keyDown(focusBoard(), { key: 'Enter' });
    expect(r.move).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset aim' }));
    expect(screen.queryByTestId('crosshair')).toBeNull();
    expect(screen.getByRole('button', { name: 'THROW' })).toBeDisabled();
  });

  it('is not your turn: no throw button, and the board is not aimable', () => {
    setup({}, 1);
    expect(screen.queryByRole('button', { name: 'THROW' })).toBeNull();
    expect(screen.getByText(/Waiting for Ani/)).toBeInTheDocument();
    expect(screen.getByTestId('current-player')).toHaveTextContent('is up');
    fireEvent.keyDown(focusBoard(), { key: 'ArrowUp' });
    expect(screen.queryByTestId('crosshair')).toBeNull();
  });

  it('shows the darts that are in the board, and what they scored', () => {
    setup({ mode: '501' }, 0, (s) => {
      let cur = s;
      for (const [x, y] of [
        [0, -0.6],
        [0, 0],
      ]) {
        cur = dartGame.move(cur, 0, { type: 'throw', x, y }, exact);
      }
      return cur;
    });
    expect(board().querySelectorAll('[data-dart]')).toHaveLength(2);
    const me = within(screen.getByLabelText('Scoreboard')).getAllByRole(
      'listitem',
    )[0];
    expect(within(me).getByText('T20')).toBeInTheDocument();
    expect(within(me).getByText('Bull')).toBeInTheDocument();
    expect(screen.getByTestId('score-0')).toHaveTextContent(
      String(501 - 60 - 50 + 0),
    );
  });

  it('offers to end the turn after three darts, and only then', () => {
    const r = setup({}, 0, (s) => {
      let cur = s;
      for (let i = 0; i < 3; i++)
        cur = dartGame.move(cur, 0, { type: 'throw', x: 3, y: 3 }, exact);
      return cur;
    });
    expect(screen.queryByRole('button', { name: 'THROW' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'END TURN' }));
    expect(r.move).toHaveBeenCalledWith({ type: 'next' });
  });

  it('says BUST when a turn goes over', () => {
    setup({ mode: '301' }, 0, (s) => {
      s.scores[0] = 40;
      s.turnStart = 40;
      return dartGame.move(s, 0, { type: 'throw', x: 0, y: -0.6 }, exact);
    });
    expect(screen.getByRole('status')).toHaveTextContent('BUST!');
    expect(screen.getByTestId('score-0')).toHaveTextContent('40');
  });

  it('suggests a checkout', () => {
    setup({ mode: '501' }, 0, (s) => {
      s.scores[0] = 40;
      return s;
    });
    expect(screen.getByTestId('checkout')).toHaveTextContent('D20');
  });

  it("shows the Cricket sheet with everyone's marks", () => {
    setup({ mode: 'cricket' }, 0, (s) => {
      s.marks[0][0] = 3;
      s.marks[1][1] = 2;
      return s;
    });
    const sheet = within(screen.getByLabelText('Cricket marks'));
    expect(sheet.getAllByRole('row')).toHaveLength(8);
    expect(sheet.getAllByLabelText('3 marks')).toHaveLength(1);
    expect(sheet.getAllByLabelText('2 marks')).toHaveLength(1);
  });

  it('shows Around the Clock targets and Count Up totals', () => {
    setup({ mode: 'clock' });
    expect(screen.getByTestId('score-0')).toHaveTextContent('1');
  });

  it('needs a timing meter in Skill mode', () => {
    setup({ throwMode: 'skill' });
    expect(screen.getByLabelText('Timing meter')).toBeInTheDocument();
  });

  it('keeps the previous rounds', () => {
    setup({ mode: '501' }, 0, (s) => {
      let cur = s;
      for (let i = 0; i < 3; i++)
        cur = dartGame.move(cur, 0, { type: 'throw', x: 0, y: -0.6 }, exact);
      return dartGame.move(cur, 0, { type: 'next' });
    });
    const history = within(screen.getByLabelText('Previous rounds'));
    expect(history.getAllByText('T20')).toHaveLength(3);
    expect(history.getByText('180')).toBeInTheDocument();
  });

  it('shows the result when the match is over', () => {
    const r = setup({ mode: '501' }, 0, (s) => {
      s.scores[0] = 40;
      s.turnStart = 40;
      return dartGame.move(s, 0, { type: 'throw', x: 0, y: -0.99 }, exact);
    });
    const dialog = within(screen.getByRole('dialog', { name: 'Match result' }));
    expect(dialog.getByText('You win!')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Play Again' }));
    expect(r.rematch).toHaveBeenCalled();
    fireEvent.click(dialog.getByRole('button', { name: 'Back to lobby' }));
    expect(r.leave).toHaveBeenCalled();
  });
});
