import {
  chord,
  fromLayout,
  LEVELS,
  newGame,
  reveal,
  toggleFlag,
} from '@/lib/games/minesweeper';

/** Deterministic rng so placements are repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const at = (g: ReturnType<typeof fromLayout>, x: number, y: number) =>
  g.cells[y * g.width + x];

describe('placing mines', () => {
  it('starts with no mines and places them on the first reveal', () => {
    const g = newGame('mudah');
    expect(g.status).toBe('ready');
    expect(g.cells.some((c) => c.mine)).toBe(false);

    const next = reveal(g, 4, 4, seeded(1));
    expect(next.status).toBe('playing');
    expect(next.cells.filter((c) => c.mine)).toHaveLength(LEVELS.mudah.mines);
  });

  it('never puts a mine on or next to the first click, on any seed or corner', () => {
    for (const [x, y] of [
      [0, 0],
      [8, 8],
      [0, 8],
      [4, 4],
      [8, 0],
    ]) {
      for (let seed = 1; seed <= 60; seed++) {
        const g = reveal(newGame('mudah'), x, y, seeded(seed));
        expect(g.status).toBe('playing');
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < 9 && ny < 9) {
              expect(g.cells[ny * 9 + nx].mine).toBe(false);
            }
          }
        }
      }
    }
  });

  it('counts adjacent mines correctly', () => {
    const g = fromLayout(['*..', '...', '..*']);
    expect(at(g, 1, 1).adjacent).toBe(2);
    expect(at(g, 1, 0).adjacent).toBe(1);
    expect(at(g, 2, 0).adjacent).toBe(0);
    expect(at(g, 0, 0).adjacent).toBe(0); // a mine counts its neighbours only
  });
});

describe('revealing', () => {
  it('opens a number without spreading', () => {
    const g = reveal(fromLayout(['*..', '...', '...']), 1, 1);
    expect(g.opened).toBe(1);
    expect(at(g, 1, 1).state).toBe('open');
    expect(at(g, 2, 2).state).toBe('hidden');
  });

  it('spreads across empty cells and stops at numbers', () => {
    const g = reveal(
      fromLayout(['.....', '.....', '..*..', '.....', '.....']),
      0,
      0,
    );
    // everything but the mine is reachable
    expect(g.opened).toBe(24);
    expect(g.status).toBe('won');
  });

  it('does not spread through flags', () => {
    const base = toggleFlag(fromLayout(['....', '....', '....', '*...']), 1, 1);
    const g = reveal(base, 3, 0);
    expect(at(g, 1, 1).state).toBe('flag');
  });

  it('loses on a mine and shows all mines', () => {
    const g = reveal(fromLayout(['*.', '.*']), 0, 0);
    expect(g.status).toBe('lost');
    expect(at(g, 1, 1).state).toBe('open');
  });

  it('wins when every safe cell is open, and flags the mines', () => {
    let g = fromLayout(['*..', '...']);
    g = reveal(g, 1, 0);
    expect(g.status).toBe('playing');
    for (const [x, y] of [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ])
      g = reveal(g, x, y);
    expect(g.status).toBe('won');
    expect(at(g, 0, 0).state).toBe('flag');
    expect(g.flags).toBe(1);
  });

  it('ignores moves after the game ended and clicks on opened or flagged cells', () => {
    const lost = reveal(fromLayout(['*.', '..']), 0, 0);
    expect(reveal(lost, 1, 1)).toBe(lost);
    expect(toggleFlag(lost, 1, 1)).toBe(lost);

    const g = toggleFlag(fromLayout(['*..', '...']), 1, 0);
    expect(reveal(g, 1, 0)).toBe(g); // flagged cells are protected
  });

  it('does not change the game it was given', () => {
    const g = fromLayout(['*..', '...']);
    const before = JSON.stringify(g);
    reveal(g, 2, 1);
    toggleFlag(g, 1, 0);
    expect(JSON.stringify(g)).toBe(before);
  });
});

describe('flags', () => {
  it('toggles and counts flags, but not on opened cells', () => {
    let g = fromLayout(['*..', '...']);
    g = toggleFlag(g, 0, 0);
    expect([at(g, 0, 0).state, g.flags]).toEqual(['flag', 1]);
    g = toggleFlag(g, 0, 0);
    expect([at(g, 0, 0).state, g.flags]).toEqual(['hidden', 0]);

    g = reveal(g, 1, 1);
    expect(toggleFlag(g, 1, 1)).toBe(g);
  });
});

describe('chord', () => {
  const layout = ['*..', '...', '...'];

  it('opens the neighbours when the flags match the number', () => {
    let g = reveal(fromLayout(layout), 1, 1);
    g = toggleFlag(g, 0, 0);
    g = chord(g, 1, 1);
    expect(at(g, 2, 2).state).toBe('open');
    expect(g.status).toBe('won');
  });

  it('does nothing when the flag count is wrong', () => {
    let g = reveal(fromLayout(layout), 1, 1);
    expect(chord(g, 1, 1)).toBe(g);
    g = toggleFlag(g, 2, 2); // flag on the wrong cell
    g = toggleFlag(g, 0, 1);
    expect(chord(g, 1, 1)).toBe(g);
  });

  it('loses if a flag was wrong', () => {
    let g = reveal(fromLayout(layout), 1, 1);
    g = toggleFlag(g, 2, 2); // wrong: the mine is at 0,0
    g = chord(g, 1, 1);
    expect(g.status).toBe('lost');
  });
});
