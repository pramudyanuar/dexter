/** @jest-environment node */
import {
  accuracy,
  BASE_RULES,
  DIFFICULTIES,
  DIFFICULTY,
  freeTiles,
  hasMoves,
  hint,
  isFree,
  MahjongState,
  makeBoard,
  newGame,
  Pairing,
  pairsLeft,
  pick,
  remaining,
  replay,
  rulesFor,
  shuffleTiles,
  solvable,
  Tile,
  undo,
  validPairs,
} from '@/lib/games/mahjong';
import {
  extent,
  LAYOUT_IDS,
  layoutPositions,
  Pos,
} from '@/lib/games/mahjong-layouts';
import {
  allPairs,
  canMatch,
  DEFAULT_MATCH,
  FLOWERS,
  matchClass,
  nameOf,
  SEASONS,
  STANDARD_KINDS,
  suitOf,
} from '@/lib/games/mahjong-tiles';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A game on a few hand-placed tiles: 'kind@x,y,z' */
function board(
  spec: string[],
  rules = {},
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
): MahjongState {
  const tiles: Tile[] = spec.map((s, id) => {
    const [kind, at] = s.split('@');
    const [x, y, z] = at.split(',').map(Number);
    return { id, kind, x, y, z, removed: false };
  });
  return {
    layout: 'custom',
    difficulty,
    rules: rulesFor(difficulty, rules),
    tiles,
    selected: null,
    history: [],
    score: 0,
    moves: 0,
    pairs: 0,
    wrong: 0,
    hints: 0,
    shuffles: 0,
    undos: 0,
    streak: 0,
    lastMatchAt: null,
    elapsed: 0,
    status: 'playing',
    hint: null,
    mismatch: null,
  };
}

/** Free tiles are c1, d1 and d2: none of them match, and b1 is buried. */
const STUCK = ['b1@0,0,0', 'c1@0,0,1', 'd1@4,0,0', 'd2@6,0,0'];

const click = (s: MahjongState, i: number, t = s.elapsed) => pick(s, i, t);

describe('the tiles', () => {
  it('has the traditional set of 144', () => {
    expect(STANDARD_KINDS).toHaveLength(34);
    expect(STANDARD_KINDS.filter((k) => suitOf(k) === 'bamboo')).toHaveLength(
      9,
    );
    expect(
      STANDARD_KINDS.filter((k) => suitOf(k) === 'character'),
    ).toHaveLength(9);
    expect(STANDARD_KINDS.filter((k) => suitOf(k) === 'dot')).toHaveLength(9);
    expect(STANDARD_KINDS.filter((k) => suitOf(k) === 'wind')).toHaveLength(4);
    expect(STANDARD_KINDS.filter((k) => suitOf(k) === 'dragon')).toHaveLength(
      3,
    );
    expect(FLOWERS).toHaveLength(4);
    expect(SEASONS).toHaveLength(4);
    expect(34 * 4 + 8).toBe(144);
    expect(nameOf('dr')).toBe('Red dragon');
    expect(nameOf('b5')).toBe('Bamboo 5');
  });

  it('matches identical tiles exactly: same suit, same number', () => {
    expect(canMatch('b3', 'b3', DEFAULT_MATCH)).toBe(true);
    expect(canMatch('b3', 'c3', DEFAULT_MATCH)).toBe(false);
    expect(canMatch('b3', 'b4', DEFAULT_MATCH)).toBe(false);
    expect(canMatch('we', 'ws', DEFAULT_MATCH)).toBe(false);
    expect(canMatch('dr', 'dg', DEFAULT_MATCH)).toBe(false);
  });

  it('lets any flower match any flower, and any season any season', () => {
    expect(canMatch('f1', 'f4', DEFAULT_MATCH)).toBe(true);
    expect(canMatch('s2', 's3', DEFAULT_MATCH)).toBe(true);
    expect(canMatch('f1', 's1', DEFAULT_MATCH)).toBe(false);
  });

  it('can be set to match flowers and seasons exactly', () => {
    const strict = { flowersAny: false, seasonsAny: false };
    expect(canMatch('f1', 'f4', strict)).toBe(false);
    expect(canMatch('f2', 'f2', strict)).toBe(true);
    expect(matchClass('s1', strict)).toBe('s1');
  });

  it('makes 72 pairs, and still 72 when flowers must match exactly', () => {
    expect(allPairs(DEFAULT_MATCH, seeded(1))).toHaveLength(72);
    const strict = allPairs(
      { flowersAny: false, seasonsAny: false },
      seeded(1),
    );
    expect(strict).toHaveLength(72);
    // no flower or season in a set that cannot pair them
    expect(strict.flat().some((k) => suitOf(k) === 'flower')).toBe(false);
    for (const [a, b] of strict) expect(a).toBe(b);
  });
});

describe('layouts', () => {
  it.each(LAYOUT_IDS.filter((l) => l !== 'custom'))(
    '%s has an even number of tiles, none on top of each other',
    (id) => {
      const p = layoutPositions(id);
      expect(p.length % 2).toBe(0);
      expect(p.length).toBeLessThanOrEqual(144);
      expect(new Set(p.map((t) => `${t.x},${t.y},${t.z}`)).size).toBe(p.length);
    },
  );

  it('the classic turtle is 144 tiles in five layers', () => {
    const p = layoutPositions('turtle');
    expect(p).toHaveLength(144);
    expect(extent(p).layers).toBe(5);
    expect(p.filter((t) => t.z === 0)).toHaveLength(87);
    expect(p.filter((t) => t.z === 1)).toHaveLength(36);
    expect(p.filter((t) => t.z === 2)).toHaveLength(16);
    expect(p.filter((t) => t.z === 3)).toHaveLength(4);
    expect(p.filter((t) => t.z === 4)).toHaveLength(1);
  });

  it('has stacked tiles on every layer above a tile', () => {
    // every tile above the floor lies on something
    for (const id of LAYOUT_IDS.filter((l) => l !== 'custom')) {
      const p = layoutPositions(id);
      for (const t of p.filter((x) => x.z > 0)) {
        expect(
          p.some(
            (u) =>
              u.z === t.z - 1 &&
              Math.abs(u.x - t.x) < 2 &&
              Math.abs(u.y - t.y) < 2,
          ),
        ).toBe(true);
      }
    }
  });
});

describe('which tiles can be picked', () => {
  it('a tile with another on top is blocked', () => {
    const s = board(['b1@0,0,0', 'b1@0,0,1']);
    expect(isFree(s.tiles, 0)).toBe(false);
    expect(isFree(s.tiles, 1)).toBe(true);
  });

  it('a tile offset by half a tile is still covered', () => {
    const s = board(['b1@0,0,0', 'b1@1,1,1']);
    expect(isFree(s.tiles, 0)).toBe(false);
  });

  it('a tile in the next column over is not covering', () => {
    const s = board(['b1@0,0,0', 'b1@2,0,1']);
    expect(isFree(s.tiles, 0)).toBe(true);
  });

  it('a tile with neighbours on both sides is blocked, with one side open it is free', () => {
    const s = board(['b1@0,0,0', 'b2@2,0,0', 'b3@4,0,0']);
    expect(isFree(s.tiles, 0)).toBe(true); // left end
    expect(isFree(s.tiles, 1)).toBe(false); // in the middle
    expect(isFree(s.tiles, 2)).toBe(true); // right end
  });

  it('counts a neighbour a half step off as touching', () => {
    const s = board(['b1@0,1,0', 'b2@2,0,0', 'b3@4,1,0']);
    expect(isFree(s.tiles, 1)).toBe(false);
  });

  it('a tile in another row does not block', () => {
    const s = board(['b1@0,0,0', 'b2@2,2,0', 'b3@-2,2,0']);
    expect(isFree(s.tiles, 1)).toBe(true);
  });

  it('removing the tiles around it frees a tile', () => {
    const s = board(['b1@0,0,0', 'b2@2,0,0', 'b3@4,0,0']);
    const tiles = s.tiles.map((t) =>
      t.id === 2 ? { ...t, removed: true } : t,
    );
    expect(isFree(tiles, 1)).toBe(true);
  });

  it('on the turtle, only the outside and the top are free at the start', () => {
    const { tiles } = makeBoard('turtle', DEFAULT_MATCH, seeded(3));
    const free = freeTiles(tiles);
    // the top of the stack, and the two ends of the rows and the wings
    expect(
      tiles.filter((t) => t.z === 4).every((t) => free.includes(t.id)),
    ).toBe(true);
    expect(free.length).toBeGreaterThan(8);
    expect(free.length).toBeLessThan(45);
    // nothing in the middle of the first layer is free
    const middle = tiles.find((t) => t.z === 0 && t.x === 12 && t.y === 8)!;
    expect(free).not.toContain(middle.id);
  });
});

describe('building a board', () => {
  it.each(['turtle', 'pyramid', 'fortress', 'spider', 'dragon'] as const)(
    '%s is built from a real set, and can be cleared',
    (layout) => {
      for (const seed of [1, 2, 3]) {
        for (const pairing of ['near', 'random', 'far'] as Pairing[]) {
          const { tiles, solution } = makeBoard(
            layout,
            DEFAULT_MATCH,
            seeded(seed),
            pairing,
          );
          expect(replay(tiles, solution, DEFAULT_MATCH)).toBe(true);
          // every tile has a partner somewhere
          const by = new Map<string, number>();
          for (const t of tiles) {
            const c = matchClass(t.kind, DEFAULT_MATCH);
            by.set(c, (by.get(c) ?? 0) + 1);
          }
          for (const n of by.values()) expect(n % 2).toBe(0);
          // never more than the set holds
          for (const k of STANDARD_KINDS) {
            expect(
              tiles.filter((t) => t.kind === k).length,
            ).toBeLessThanOrEqual(4);
          }
        }
      }
    },
  );

  it('the full turtle uses the whole set: four of each kind', () => {
    const { tiles } = makeBoard('turtle', DEFAULT_MATCH, seeded(9));
    for (const k of STANDARD_KINDS) {
      expect(tiles.filter((t) => t.kind === k)).toHaveLength(4);
    }
    expect(tiles.filter((t) => suitOf(t.kind) === 'flower')).toHaveLength(4);
    expect(tiles.filter((t) => suitOf(t.kind) === 'season')).toHaveLength(4);
  });

  it('is not just shuffled: a shuffled turtle is rarely solvable, a built one always is', () => {
    const { tiles, solution } = makeBoard('turtle', DEFAULT_MATCH, seeded(5));
    expect(replay(tiles, solution, DEFAULT_MATCH)).toBe(true);
    // the same tiles thrown on the board in the wrong order fail the replay
    const wrong = [...solution].reverse();
    expect(replay(tiles, wrong, DEFAULT_MATCH)).toBe(false);
  });

  it('can be cleared with exact flower and season matching too', () => {
    const rules = { flowersAny: false, seasonsAny: false };
    const { tiles, solution } = makeBoard('turtle', rules, seeded(2));
    expect(tiles).toHaveLength(144);
    expect(replay(tiles, solution, rules)).toBe(true);
  });

  it('is the same board for the same seed', () => {
    const a = makeBoard('spider', DEFAULT_MATCH, seeded(4)).tiles.map(
      (t) => t.kind,
    );
    const b = makeBoard('spider', DEFAULT_MATCH, seeded(4)).tiles.map(
      (t) => t.kind,
    );
    expect(a).toEqual(b);
  });

  it('builds the custom layouts people draw, and refuses an odd one', () => {
    const custom: Pos[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 6, y: 0, z: 0 },
    ];
    const { tiles, solution } = makeBoard(
      'custom',
      DEFAULT_MATCH,
      seeded(1),
      'random',
      custom,
    );
    expect(tiles).toHaveLength(4);
    expect(replay(tiles, solution, DEFAULT_MATCH)).toBe(true);
    expect(() =>
      makeBoard(
        'custom',
        DEFAULT_MATCH,
        seeded(1),
        'random',
        custom.slice(0, 3),
      ),
    ).toThrow();
  });

  it('a new game of each difficulty starts with a way to play', () => {
    for (const d of DIFFICULTIES) {
      const g = newGame(DIFFICULTY[d].layout, d, seeded(7));
      expect(g.status).toBe('playing');
      expect(hasMoves(g.tiles, g.rules)).toBe(true);
      expect(g.score).toBe(0);
    }
    expect(DIFFICULTY.medium.layout).toBe('turtle');
    expect(rulesFor('hard').hintLimit).toBeLessThan(rulesFor('easy').hintLimit);
  });
});

describe('the solvability check', () => {
  it('says yes for a board that can be cleared', () => {
    const s = board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']);
    expect(solvable(s.tiles, s.rules)).toBe(true);
  });

  it('says no for a board that cannot', () => {
    // the free tiles never pair: the matching tile is buried under the other
    const s = board(STUCK);
    // b1(0) is under b2(1); b2(2) and b1(3) are free but differ; taking none works
    expect(solvable(s.tiles, s.rules)).toBe(false);
  });

  it('can clear a whole generated pyramid', () => {
    const { tiles } = makeBoard('pyramid', DEFAULT_MATCH, seeded(6), 'near');
    expect(solvable(tiles, DEFAULT_MATCH, 400_000)).not.toBe(false);
  });
});

describe('picking tiles', () => {
  const two = () => board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']);

  it('selects a free tile, and picking it again deselects it', () => {
    let { state, result } = click(two(), 0);
    expect(result).toBe('selected');
    expect(state.selected).toBe(0);
    ({ state, result } = click(state, 0));
    expect(result).toBe('deselected');
    expect(state.selected).toBeNull();
  });

  it('cannot select a blocked tile', () => {
    const s = board(['b1@0,0,0', 'b1@0,0,1', 'b2@4,0,0', 'b2@6,0,0']);
    const { state, result } = click(s, 0);
    expect(result).toBe('blocked');
    expect(state.selected).toBeNull();
    // nor one boxed in on both sides
    const m = board(['b1@0,0,0', 'b2@2,0,0', 'b3@4,0,0', 'b1@8,0,0']);
    expect(click(m, 1).result).toBe('blocked');
  });

  it('removes a matching pair', () => {
    const s = click(two(), 0).state;
    const r = click(s, 1);
    expect(r.result).toBe('matched');
    expect(r.state.tiles[0].removed && r.state.tiles[1].removed).toBe(true);
    expect(r.state.pairs).toBe(1);
    expect(r.state.selected).toBeNull();
    expect(remaining(r.state.tiles)).toBe(2);
    expect(pairsLeft(r.state)).toBe(1);
  });

  it('tells you when they do not match, and moves the selection to the new tile', () => {
    const s = click(two(), 0).state;
    const r = click(s, 2);
    expect(r.result).toBe('mismatch');
    expect(r.state.selected).toBe(2);
    expect(r.state.mismatch).toEqual([0, 2]);
    expect(r.state.wrong).toBe(1);
    expect(r.state.tiles.every((t) => !t.removed)).toBe(true);
  });

  it('any flower matches any flower, any season any season', () => {
    const f = board(['f1@0,0,0', 'f3@2,0,0', 's1@0,2,0', 's4@2,2,0']);
    expect(click(click(f, 0).state, 1).result).toBe('matched');
    expect(click(click(f, 2).state, 3).result).toBe('matched');
    // but a flower is not a season
    expect(click(click(f, 0).state, 3).result).toBe('mismatch');
  });

  it('can require flowers to match exactly', () => {
    const f = board(['f1@0,0,0', 'f3@2,0,0', 'f1@0,2,0', 'f3@2,2,0'], {
      flowersAny: false,
    });
    expect(click(click(f, 0).state, 1).result).toBe('mismatch');
    expect(click(click(f, 0).state, 2).result).toBe('matched');
  });

  it('ignores a click on a tile that is already gone', () => {
    const s = click(click(two(), 0).state, 1).state;
    expect(click(s, 0).result).toBe('ignored');
  });
});

describe('scoring', () => {
  const four = () =>
    board([
      'b1@0,0,0',
      'b1@2,0,0',
      'c2@0,2,0',
      'c2@2,2,0',
      'd3@0,4,0',
      'd3@2,4,0',
    ]);

  it('scores a pair, and a bonus for matches in a row', () => {
    let s = four();
    s = click(click(s, 0, 1000).state, 1, 1000).state;
    expect(s.score).toBe(100);
    s = click(click(s, 2, 2000).state, 3, 2000).state;
    expect(s.score).toBe(100 + 125); // one in a row
    expect(s.streak).toBe(1);
  });

  it('loses the streak when you take too long', () => {
    let s = four();
    s = click(click(s, 0, 1000).state, 1, 1000).state;
    s = click(click(s, 2, 1000 + 60_000).state, 3, 1000 + 60_000).state;
    expect(s.score).toBe(200);
    expect(s.streak).toBe(0);
  });

  it('adds the completion bonus and wins', () => {
    let s = four();
    for (const [a, b] of [
      [0, 1],
      [2, 3],
      [4, 5],
    ]) {
      s = click(click(s, a, 100).state, b, 100).state;
    }
    expect(s.status).toBe('won');
    expect(s.score).toBe(100 + 125 + 150 + 1000);
    expect(s.moves).toBe(3);
    expect(accuracy(s)).toBe(1);
    // and nothing more can be played
    expect(click(s, 0).result).toBe('ignored');
  });

  it('counts accuracy from the wrong tries', () => {
    let s = four();
    s = click(click(s, 0).state, 2).state; // wrong
    s = click(click(s, 0).state, 1).state; // right (selection moved to 2, then 0 → mismatch?)
    expect(accuracy(s)).toBeLessThan(1);
    expect(s.wrong).toBeGreaterThan(0);
  });
});

describe('undo', () => {
  const play = () => {
    const s = board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']);
    return click(click(s, 0, 500).state, 1, 500).state;
  };

  it('puts the last pair back, takes the points off, and costs a little', () => {
    const s = play();
    expect(s.score).toBe(100);
    const { state } = undo(s);
    expect(state.tiles.every((t) => !t.removed)).toBe(true);
    expect(state.pairs).toBe(0);
    expect(state.undos).toBe(1);
    expect(state.score).toBe(0); // never below zero
    expect(state.history).toHaveLength(0);
  });

  it('can go back more than one step', () => {
    let s = board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']);
    s = click(click(s, 0, 100).state, 1, 100).state;
    s = click(click(s, 2, 200).state, 3, 200).state;
    expect(s.status).toBe('won');
    s = { ...s, status: 'playing', score: 1000 }; // no undo from the win screen
    s = undo(s).state;
    expect(remaining(s.tiles)).toBe(2);
    s = undo(s).state;
    expect(remaining(s.tiles)).toBe(4);
    expect(undo(s).denied).toBe('empty');
  });

  it('has a limit', () => {
    let s = board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0'], {
      undoLimit: 1,
    });
    s = click(click(s, 0, 100).state, 1, 100).state;
    s = undo(s).state;
    s = click(click(s, 0, 100).state, 1, 100).state;
    expect(undo(s).denied).toBe('limit');
  });
});

describe('hints', () => {
  it('shows a pair that can really be taken, and costs points', () => {
    let s = board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']);
    s = { ...s, score: 300 };
    const { state } = hint(s);
    expect(state.hint).not.toBeNull();
    const [a, b] = state.hint!;
    expect(isFree(state.tiles, a)).toBe(true);
    expect(isFree(state.tiles, b)).toBe(true);
    expect(
      canMatch(state.tiles[a].kind, state.tiles[b].kind, state.rules),
    ).toBe(true);
    expect(state.hints).toBe(1);
    expect(state.score).toBe(250);
  });

  it('never points at a blocked tile', () => {
    const { tiles, rules } = newGame('turtle', 'medium', seeded(8));
    for (const [a, b] of validPairs(tiles, rules)) {
      expect(isFree(tiles, a) && isFree(tiles, b)).toBe(true);
    }
  });

  it('says so when there is no move, and when the hints run out', () => {
    const none = board(STUCK);
    expect(hint(none).denied).toBe('none');
    const s = board(['b1@0,0,0', 'b1@2,0,0'], { hintLimit: 1 });
    const once = hint(s).state;
    expect(hint(once).denied).toBe('limit');
  });

  it('is cleared when you pick a tile', () => {
    const s = hint(
      board(['b1@0,0,0', 'b1@2,0,0', 'c2@0,2,0', 'c2@2,2,0']),
    ).state;
    expect(click(s, 0).state.hint).toBeNull();
  });
});

describe('no moves left, and the shuffle', () => {
  const stuck = () => board(STUCK);

  it('notices when no pair can be taken', () => {
    // the last move leaves two free tiles that do not match
    let s = board([
      'b1@0,0,0',
      'b1@2,0,0',
      'c2@8,0,0',
      'd3@12,0,0',
      'd3@14,0,0',
      'c2@16,0,0',
    ]);
    s = click(click(s, 0).state, 1).state;
    expect(s.status).toBe('playing');
    s = click(click(s, 3).state, 4).state;
    // c2 and c2 are free again, so this still has a move
    expect(s.status).toBe('playing');
    const blocked = { ...stuck(), tiles: stuck().tiles };
    expect(hasMoves(blocked.tiles, blocked.rules)).toBe(false);
  });

  it('keeps the same tiles in new places, and leaves the removed ones alone', () => {
    let s = newGame('pyramid', 'medium', seeded(3));
    s = click(
      click(s, validPairs(s.tiles, s.rules)[0][0]).state,
      validPairs(s.tiles, s.rules)[0][1],
    ).state;
    const before = s.tiles.filter((t) => !t.removed);
    const { state } = shuffleTiles(s, seeded(99));
    const after = state.tiles.filter((t) => !t.removed);
    expect(after.map((t) => `${t.x},${t.y},${t.z}`)).toEqual(
      before.map((t) => `${t.x},${t.y},${t.z}`),
    );
    expect(after.map((t) => t.kind).sort()).toEqual(
      before.map((t) => t.kind).sort(),
    );
    expect(state.tiles.filter((t) => t.removed).map((t) => t.id)).toEqual(
      s.tiles.filter((t) => t.removed).map((t) => t.id),
    );
    expect(state.shuffles).toBe(1);
  });

  it('leaves the board with a way through', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = newGame('turtle', 'medium', seeded(seed));
      const { state } = shuffleTiles(g, seeded(seed + 100));
      expect(hasMoves(state.tiles, state.rules)).toBe(true);
      expect(state.status).toBe('playing');
    }
  });

  it('costs points, can be switched off, and has a limit', () => {
    const g = { ...newGame('pyramid', 'medium', seeded(1)), score: 500 };
    expect(shuffleTiles(g, seeded(1)).state.score).toBe(400);
    const off = newGame('pyramid', 'medium', seeded(1), {
      rules: { shuffleEnabled: false },
    });
    expect(shuffleTiles(off).denied).toBe('disabled');
    const once = newGame('pyramid', 'hard', seeded(1));
    const first = shuffleTiles(once, seeded(2)).state;
    expect(shuffleTiles(first).denied).toBe('limit');
  });

  it('recovers a stuck game: after the shuffle it can be played again', () => {
    // the free tiles (c1 and b1) do not match, the ones under them do
    let s = board(['b1@0,0,0', 'c1@0,0,1', 'c1@10,0,0', 'b1@10,0,1']);
    s = { ...s, status: 'stuck' };
    expect(hasMoves(s.tiles, s.rules)).toBe(false);
    const { state } = shuffleTiles(s, seeded(5));
    expect(state.status).toBe('playing');
    expect(hasMoves(state.tiles, state.rules)).toBe(true);
  });

  it('keeps the base rules in one place', () => {
    expect(BASE_RULES.scoring).toMatchObject({
      match: 100,
      complete: 1000,
      hint: 50,
      shuffle: 100,
      undo: 25,
    });
  });
});
