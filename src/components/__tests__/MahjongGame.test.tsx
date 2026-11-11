import { act, fireEvent, render, screen, within } from '@testing-library/react';

import MahjongGame from '@/components/games/mahjong/MahjongGame';

/** A pair of free tiles that match, found the way a player would: by looking. */
function freePair() {
  const free = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '[data-tile][data-free="true"]:not(:disabled)',
    ),
  ];
  const cls = (k: string) =>
    /^f\d$/.test(k) ? 'f' : /^s\d$/.test(k) ? 's' : k;
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (cls(free[i].dataset.kind!) === cls(free[j].dataset.kind!))
        return [free[i], free[j]];
    }
  }
  return null;
}

const pairs = () =>
  Number(screen.getByTestId('pairs').textContent!.match(/\d+/)![0]);

describe('Mahjong', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  const start = async () => {
    render(<MahjongGame />);
    fireEvent.click(await screen.findByRole('button', { name: 'PLAY' }));
  };

  it('offers the layouts and difficulties, with the classic turtle chosen', async () => {
    render(<MahjongGame />);
    for (const name of [
      'Classic Turtle',
      'Pyramid',
      'Fortress',
      'Spider',
      'Dragon',
      'Custom',
    ]) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('button', { name: /Classic Turtle/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('deals the 144 tiles of the turtle', async () => {
    await start();
    expect(document.querySelectorAll('[data-tile]')).toHaveLength(144);
    expect(pairs()).toBe(72);
    expect(screen.getByTestId('score')).toHaveTextContent('0 pts');
  });

  it('draws tiles with art, not emoji', async () => {
    await start();
    const tile = document.querySelector('[data-tile]')!;
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('marks tiles that are blocked, and will not select them', async () => {
    await start();
    const blocked = document.querySelector<HTMLButtonElement>(
      '[data-free="false"]:not(:disabled)',
    )!;
    expect(blocked).not.toBeNull();
    fireEvent.click(blocked);
    expect(blocked).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('notice')).toHaveTextContent('blocked');
  });

  it('highlights a selected tile, and removes a matching pair', async () => {
    await start();
    const [a, b] = freePair()!;
    fireEvent.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(b);
    expect(pairs()).toBe(71);
    expect(screen.getByTestId('score')).toHaveTextContent('100 pts');
  });

  it('says so when two tiles do not match', async () => {
    await start();
    const free = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[data-tile][data-free="true"]',
      ),
    ];
    const a = free[0];
    const b = free.find(
      (t) =>
        t.dataset.kind !== a.dataset.kind &&
        !(
          /^[fs]\d$/.test(t.dataset.kind!) &&
          t.dataset.kind![0] === a.dataset.kind![0]
        ),
    )!;
    fireEvent.click(a);
    fireEvent.click(b);
    expect(screen.getByTestId('notice')).toHaveTextContent('Not a match');
    expect(pairs()).toBe(72);
  });

  it('undoes the last pair, at a cost', async () => {
    await start();
    const [a, b] = freePair()!;
    fireEvent.click(a);
    fireEvent.click(b);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(pairs()).toBe(72);
    expect(screen.getByTestId('score')).toHaveTextContent('0 pts');
  });

  it('shows a hint, which is a pair that can be taken', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: /^Hint/ }));
    const hinted = document.querySelectorAll('.a-mj-hint');
    expect(hinted).toHaveLength(2);
    for (const t of hinted) expect(t).toHaveAttribute('data-free', 'true');
    expect(hinted[0].getAttribute('data-kind')![0]).toBe(
      hinted[1].getAttribute('data-kind')![0],
    );
  });

  it('shuffles the tiles that are left', async () => {
    await start();
    const before = [...document.querySelectorAll('[data-tile]')]
      .map((t) => t.getAttribute('data-kind')!)
      .sort();
    fireEvent.click(screen.getByRole('button', { name: /^Shuffle/ }));
    const after = [...document.querySelectorAll('[data-tile]')]
      .map((t) => t.getAttribute('data-kind')!)
      .sort();
    expect(after).toEqual(before);
    expect(screen.getByTestId('notice')).toHaveTextContent('shuffled');
    expect(screen.getByRole('button', { name: /^Shuffle/ })).toHaveTextContent(
      '(2)',
    );
  });

  it('pauses: hides the board and stops play, then resumes', async () => {
    await start();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pause' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(dialog).toBeInTheDocument();
    const tile = document.querySelector<HTMLButtonElement>('[data-tile]')!;
    expect(tile).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull();
  });

  it('restarts with a new board and a fresh score', async () => {
    await start();
    const [a, b] = freePair()!;
    fireEvent.click(a);
    fireEvent.click(b);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(pairs()).toBe(72);
    expect(screen.getByTestId('score')).toHaveTextContent('0 pts');
  });

  it('clears a small board and shows the victory screen', async () => {
    // an easy pyramid is the smallest of the ready-made layouts
    render(<MahjongGame />);
    fireEvent.click(await screen.findByRole('button', { name: 'Easy' }));
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(document.querySelectorAll('[data-tile]')).toHaveLength(112);
    // play it out: always take any pair; undo and retry if it gets stuck
    for (
      let i = 0;
      i < 400 && !screen.queryByRole('dialog', { name: 'Board cleared' });
      i++
    ) {
      const pair = freePair();
      if (pair) {
        act(() => {
          fireEvent.click(pair[0]);
          fireEvent.click(pair[1]);
        });
      } else {
        fireEvent.click(screen.getByRole('button', { name: /^Shuffle/ }));
      }
    }
    const dialog = screen.getByRole('dialog', { name: 'Board cleared' });
    expect(within(dialog).getByText('Board cleared!')).toBeInTheDocument();
    for (const label of [
      'Final score',
      'Time',
      'Total moves',
      'Accuracy',
      'Hints used',
    ]) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(dialog).getByRole('button', { name: 'Play Again' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Change Layout' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', { name: 'Game Lobby' }),
    ).toHaveAttribute('href', '/games');
    // the best score is remembered
    expect(
      JSON.parse(localStorage.getItem('mahjong-best')!)['pyramid:easy'].score,
    ).toBeGreaterThan(0);
  });

  it('draws a custom layout and plays it', async () => {
    render(<MahjongGame />);
    fireEvent.click(await screen.findByRole('button', { name: /Custom/ }));
    expect(screen.getByTestId('count')).toHaveTextContent('0 tiles');
    const play = screen.getByRole('button', { name: 'PLAY THIS LAYOUT' });
    expect(play).toBeDisabled();
    for (const col of [1, 2, 3])
      fireEvent.click(screen.getByLabelText(`Row 1, column ${col}`));
    expect(screen.getByTestId('count')).toHaveTextContent('3 tiles');
    expect(play).toBeDisabled(); // an odd tile has no partner
    fireEvent.click(screen.getByLabelText('Row 1, column 4'));
    expect(play).toBeEnabled();
    fireEvent.click(play);
    expect(document.querySelectorAll('[data-tile]')).toHaveLength(4);
    expect(pairs()).toBe(2);
  });
});
