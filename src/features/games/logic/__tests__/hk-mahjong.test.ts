/** @jest-environment node */
import {
  hkMahjongGame as game,
  type Play,
  type TableState,
  tableView,
} from '@/features/games/logic/hk-mahjong/game';
import {
  type Meld,
  meldTiles,
  scoreHand,
  type ScoringContext,
} from '@/features/games/logic/hk-mahjong/score';
import {
  act,
  join,
  leaveRoom,
  newRoom,
  rematch,
  sweep,
  toView,
} from '@/features/rooms/engine';
import { LEAVE_GRACE_MS } from '@/features/rooms/types';

// Short suited groups use the engine's bamboo / characters / dots order.
const tiles = (group: string, suit = 0) =>
  [...group].map((n) => Number(n) - 1 + suit * 9);
const flat = (...groups: number[][]) => groups.flat();
const context: ScoringContext = {
  wind: 1,
  flowers: [34],
  source: 'discard',
  winningTile: 4,
  last: false,
};
function score(
  hand: number[],
  melds: Meld[] = [],
  overrides: Partial<ScoringContext> = {},
) {
  return scoreHand(hand, melds, { ...context, ...overrides });
}
const openChow: Meld = { kind: 'chow', tile: 0 };
const low = flat(tiles('234'), tiles('456', 1), tiles('777', 2), [30, 30]);
const ordinary = flat(tiles('123'), low);

describe('Hong Kong house scoring', () => {
  it('validates shape before scoring even on an opening win', () => {
    expect(score(ordinary)).toMatchObject({ faan: 1, units: 8 });
    expect(score(low, [openChow])).toMatchObject({ faan: 0, units: 8 });
    expect(score(ordinary.slice(1), [], { opening: 'Langit' })).toBeNull();
    expect(score([...tiles('12312312311'), 27, 28, 29])).toBeNull();
    expect(score([...tiles('12312312311'), 8, 9, 10])).toBeNull();
  });
  it('awards matching bonuses, bouquet substitution and both winds', () => {
    const hand = flat(
      tiles('234'),
      tiles('456', 1),
      tiles('77', 2),
      [27, 27, 27],
    );
    const dragon: Meld = { kind: 'pong', tile: 31 };
    expect(score(hand, [dragon], { wind: 0, flowers: [34, 38] })).toMatchObject(
      { faan: 5, units: 24 },
    );
    expect(
      score(hand, [dragon], { wind: 0, flowers: [34, 35, 36, 37, 38] }),
    ).toMatchObject({ faan: 7, units: 48 });
    expect(score(hand, [dragon], { wind: 0, flowers: [] })).toMatchObject({
      faan: 4,
      units: 16,
    });
  });
  it('scores special hands and chooses the best decomposition', () => {
    const orphans = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33];
    expect(score(orphans)?.patterns[0].label).toBe('Tiga belas yatim');
    expect(
      score(tiles('11123456789995'), [], { winningTile: 4 })?.patterns[0].label,
    ).toBe('Sembilan gerbang');
    expect(
      score([
        ...tiles('1122'),
        ...tiles('3344', 1),
        ...tiles('5566', 2),
        29,
        29,
      ])?.faan,
    ).toBe(5);
    expect(
      score([
        ...tiles('1111'),
        ...tiles('3344', 1),
        ...tiles('5566', 2),
        29,
        29,
      ]),
    ).toBeNull();
    const ambiguous = tiles('11122233344455');
    expect(
      score(ambiguous, [], { winningTile: 4 })?.patterns.map((p) => p.label),
    ).toContain('Empat pong tertutup');
  });
  it('distinguishes a discard that closes a pong from one that closes the pair', () => {
    const hand = flat(
      tiles('111'),
      tiles('222', 1),
      tiles('333', 2),
      tiles('444'),
      [29, 29],
    );
    expect(score(hand, [], { winningTile: 29 })?.faan).toBe(8);
    expect(score(hand, [], { winningTile: 0 })?.faan).toBe(4);
    expect(score(hand, [], { source: 'draw' })?.faan).toBe(9);
  });
  it('scores honour families and kong limits without duplicating component patterns', () => {
    const peng = (tile: number): Meld => ({ kind: 'pong', tile });
    expect(
      score([33, 33], [peng(31), peng(32), openChow, { kind: 'chow', tile: 9 }])
        ?.faan,
    ).toBe(5);
    expect(
      score([3, 3], [peng(31), peng(32), peng(33), { kind: 'chow', tile: 9 }])
        ?.patterns,
    ).toContainEqual({ label: 'Tiga naga besar', faan: 8 });
    expect(
      score([30, 30], [peng(27), peng(28), peng(29), openChow], {
        wind: 0,
        flowers: [35],
      })?.patterns,
    ).toEqual([
      { label: 'Satu jenis dengan kehormatan', faan: 3 },
      { label: 'Empat angin kecil', faan: 6 },
    ]);
    expect(score([3, 3], [27, 28, 29, 30].map(peng))?.patterns[0].label).toBe(
      'Empat angin besar',
    );
    expect(
      score(
        [3, 3],
        [0, 9, 18, 27].map((tile) => ({ kind: 'kong', tile })),
      )?.patterns[0].label,
    ).toBe('Empat kong');
  });
});

function start() {
  return game.start(4, () => 0.23);
}
function fixture() {
  const s = start();
  s.players = s.players.map(() => ({
    hand: [],
    river: [],
    flowers: [35],
    melds: [],
  }));
  s.discards = 5;
  s.turn = 0;
  s.dealer = 0;
  s.drawn = 4;
  s.wall = [2, 3, 5, 6, 9];
  return s;
}
const play = (s: TableState, seat: number, action: Play) =>
  game.move(s, seat, { ...action, revision: s.revision }, () => 0.2, {
    host: 0,
    now: 1000,
  });
const actions = (s: TableState, seat: number) => tableView(s, seat).actions;

describe('four-seat Mahjong table', () => {
  it('shows and enforces 25 seconds for a discard, even with a global override or a late move before the next poll', () => {
    const tokens = ['a', 'b', 'c', 'd'];
    const started = 10_000;
    let room = newRoom('mahjong-hk', 'ABCDE', tokens[0], started);
    room.options = { turnSeconds: 90 };
    for (const token of tokens.slice(1))
      room = join(room, undefined, token, () => 0.23, undefined, started).room;
    const state = room.state as TableState;
    const player = tokens[state.turn];
    expect(toView(room, player, started).waiting).toMatchObject({
      remaining: 25,
      seconds: 25,
    });
    expect(sweep(room, started + 24_999)).toBe(room);
    const move = {
      type: 'discard',
      tile: state.players[state.turn].hand.find((t) => t !== state.drawn),
      revision: state.revision,
    };
    const onTime = act(room, player, move, undefined, started + 24_999);
    expect(onTime.strikes?.[state.turn]).toBe(0);
    const expired = sweep(room, started + 25_000);
    expect(expired.strikes?.[state.turn]).toBe(1);
    const late = act(room, player, move, undefined, started + 25_000);
    expect(late.strikes?.[state.turn]).toBe(1);
    expect((late.state as TableState).players[state.turn].river).toEqual([
      state.drawn,
    ]);
  });
  it('accepts exactly three faan and scores a concealed kong replacement draw', () => {
    const s = fixture();
    s.players[0].hand = low;
    s.players[0].melds = [openChow];
    s.players[0].flowers = [34, 38];
    s.drawn = 30;
    expect(play(s, 0, { type: 'win' }).result?.score).toMatchObject({
      faan: 3,
      units: 8,
    });
    s.players[0].flowers = [34];
    expect(play(s, 0, { type: 'win' }).result?.score).toMatchObject({
      faan: 2,
      units: 8,
    });
    s.players[0].hand = [
      ...tiles('5555'),
      ...tiles('234'),
      ...tiles('456', 1),
      ...tiles('777', 2),
      30,
    ];
    s.players[0].melds = [];
    s.wall = [1, 2, 30];
    const kong = play(s, 0, { type: 'kong', tile: 4 });
    const win = play(kong, 0, { type: 'win' });
    expect(win.result?.score?.patterns).toContainEqual({
      label: 'Pengganti kong',
      faan: 1,
    });
    expect(win.result?.deltas).toEqual([24, -8, -8, -8]);
  });
  it('awards the appropriate limit only for an uninterrupted opening win', () => {
    const s = fixture();
    s.discards = 0;
    s.players[0].hand = ordinary;
    s.drawn = 30;
    expect(play(s, 0, { type: 'win' }).result?.score?.patterns).toEqual([
      { label: 'Langit', faan: 10 },
    ]);
    s.players[1].hand = ordinary.slice(0, -1);
    const opening = play(s, 0, { type: 'discard', tile: 30 });
    expect(play(opening, 1, { type: 'win' }).result?.score?.patterns).toEqual([
      { label: 'Bumi', faan: 10 },
    ]);
    s.players[1].river = [];
    s.turn = 1;
    s.discards = 1;
    s.players[1].hand = ordinary;
    expect(play(s, 1, { type: 'win' }).result?.score?.patterns).toEqual([
      { label: 'Manusia', faan: 10 },
    ]);
    s.players[0].melds = [openChow];
    expect(
      play(s, 1, { type: 'win' }).result?.score?.patterns,
    ).not.toContainEqual({ label: 'Manusia', faan: 10 });
  });
  it('lets a wall draw complete four sets and a pair and reveals all hands only once settled', () => {
    let s = fixture();
    s.players[0].hand = [5, 14];
    s.players[1].hand = low.slice(0, -1);
    s.players[1].melds = [openChow];
    s.players[2].hand = [9];
    s.players[3].hand = [18];
    s.wall = [30, 8];
    s = play(s, 0, { type: 'discard', tile: 5 });
    expect(s.drawn).toBe(30);
    expect(s.turn).toBe(1);
    expect(tableView(s, 0).players[1].revealed).toBeNull();
    expect(actions(s, 1)).toContainEqual({ type: 'win' });
    s = play(s, 1, { type: 'win' });
    expect(s.result).toMatchObject({
      seat: 1,
      payer: null,
      kind: 'win',
      score: { faan: 2, units: 8 },
    });
    expect(tableView(s, null).players.map((p) => p.revealed)).toEqual(
      s.players.map((p) => [...p.hand].sort((a, b) => a - b)),
    );
  });
  it('honours a submitted pong on timeout even if a possible winner never answers', () => {
    let s = fixture();
    s.players[0].hand = [4];
    s.players[1].hand = [4, 4];
    s.players[2].hand = tiles('1122334466775');
    s = play(s, 0, { type: 'discard', tile: 4 });
    s = play(s, 1, { type: 'pong' });
    const next = game.tick!(s, s.offer!.until)!;
    expect(next.turn).toBe(1);
    expect(next.players[1].melds).toEqual([{ kind: 'pong', tile: 4 }]);
    expect(() => play(next, 2, { type: 'win' })).toThrow();
  });
  it('deals all 144 tiles, replaces bonus tiles and keeps hands private', () => {
    const s = start();
    const tiles = s.players
      .flatMap((p) => [...p.hand, ...p.flowers])
      .concat(s.wall);
    expect(tiles).toHaveLength(144);
    for (let t = 0; t < 42; t++)
      expect(tiles.filter((k) => k === t)).toHaveLength(t < 34 ? 4 : 1);
    for (const [i, p] of s.players.entries()) {
      expect(p.hand).toHaveLength(i === s.dealer ? 14 : 13);
      expect(p.hand.every((t) => t < 34)).toBe(true);
      const v = tableView(s, i);
      expect(
        v.players.every((p) => p.revealed === null && !('hand' in p)),
      ).toBe(true);
      expect(v.wall).toBe(s.wall.length);
      expect(v.hand).toEqual([...p.hand].sort((a, b) => a - b));
    }
    expect(tableView(s, null)).toMatchObject({
      actions: [],
      hand: [],
      drawn: null,
    });
  });
  it('orders win, pong and chow independently of response arrival and breaks win ties by seat', () => {
    let s = fixture();
    s.players[0].hand = [4];
    s.players[1].hand = [2, 3, 5, 6];
    s.players[2].hand = [4, 4];
    s.players[3].hand = tiles('1122334466775');
    s = play(s, 0, { type: 'discard', tile: 4 });
    expect(actions(s, 1).filter((a) => a.type === 'chow')).toHaveLength(3);
    expect(actions(s, 2).some((a) => a.type === 'chow')).toBe(false);
    s = play(s, 1, { type: 'chow', tile: 2 });
    expect(() => play(s, 1, { type: 'pass' })).toThrow();
    s = play(s, 2, { type: 'pong' });
    s = play(s, 3, { type: 'win' });
    expect(s.result).toMatchObject({ seat: 3, payer: 0, kind: 'win' });
    expect(s.scores.reduce((a, b) => a + b, 0)).toBe(0);
    expect(s.players[0].river).toEqual([]);
    let tie = fixture();
    tie.players[0].hand = [4];
    tie.players[1].hand = tiles('1122334466775');
    tie.players[3].hand = [...tie.players[1].hand];
    tie = play(tie, 0, { type: 'discard', tile: 4 });
    tie = play(tie, 3, { type: 'win' });
    expect(play(tie, 1, { type: 'win' }).result?.seat).toBe(1);
  });
  it('rejects an incomplete hand and an illegal or stale discard', () => {
    let s = fixture();
    const incomplete = ordinary.slice(1);
    s.players[0].hand = incomplete;
    s.players[0].flowers = [35];
    s.drawn = 30;
    expect(() => play(s, 0, { type: 'win' })).toThrow();
    expect(() => play(s, 1, { type: 'discard', tile: 2 })).toThrow();
    expect(() => play(s, 0, { type: 'discard', tile: 35 })).toThrow();
    const old = s;
    s = play(s, 0, { type: 'discard', tile: 30 });
    expect(() =>
      game.move(s, s.turn, {
        type: 'discard',
        tile: s.drawn,
        revision: old.revision,
      }),
    ).toThrow();
    expect(old.players[0].hand).toEqual(incomplete);
  });
  it('passes unanswered claims at the deadline and chains replacement flowers from the tail', () => {
    let s = fixture();
    s.players[0].hand = [4];
    s.players[1].hand = [4, 4];
    s.wall = [34, 8, 16, 41];
    s = play(s, 0, { type: 'discard', tile: 4 });
    expect(game.tick!(s, 25_999)).toBeNull();
    const next = game.tick!(s, 26_000)!;
    expect(next.drawn).toBe(16);
    expect(next.players[1].flowers).toEqual([35, 34, 41]);
    expect(next.wall).toEqual([8]);
  });
  it('uses the room decision time for discard claims', () => {
    const s = fixture();
    s.decisionSeconds = 37;
    s.players[0].hand = [4];
    s.players[1].hand = [4, 4];
    const next = play(s, 0, { type: 'discard', tile: 4 });
    expect(next.offer?.until).toBe(38_000);
    expect(game.tick!(next, 37_999)).toBeNull();
    expect(game.tick!(next, 38_000)?.offer).toBeNull();
  });
  it('melds an exposed kong and draws from the back; a chow consumes only its two matching tiles', () => {
    let s = fixture();
    s.players[0].hand = [4];
    s.players[2].hand = [4, 4, 4];
    s = play(play(s, 0, { type: 'discard', tile: 4 }), 2, {
      type: 'kong',
      tile: 4,
    });
    expect(s.players[2].hand).toEqual([9]);
    expect(s.players[2].melds).toEqual([{ kind: 'kong', tile: 4 }]);
    expect(s.players[0].river).toEqual([]);
    let c = fixture();
    c.players[0].hand = [4];
    c.players[1].hand = [2, 3, 5];
    c = play(play(c, 0, { type: 'discard', tile: 4 }), 1, {
      type: 'chow',
      tile: 2,
    });
    expect(c.players[1].hand).toEqual([5]);
    expect(c.drawn).toBeNull();
    expect(actions(c, 1)).toEqual([{ type: 'discard', tile: 5 }]);
  });
  it('allows robbing only an added kong and keeps a robbed pong intact', () => {
    let s = fixture();
    s.players[0].melds = [{ kind: 'pong', tile: 4 }];
    s.players[0].hand = [4];
    s.players[1].hand = tiles('1231236786785');
    s = play(s, 0, { type: 'add', tile: 4 });
    expect(actions(s, 1)).toEqual([{ type: 'win' }, { type: 'pass' }]);
    const rob = play(s, 1, { type: 'win' });
    expect(rob.result?.score?.patterns.map((p) => p.label)).toContain(
      'Rebut kong',
    );
    expect(rob.players[0].melds[0].kind).toBe('pong');
    const pass = play(s, 1, { type: 'pass' });
    expect(pass.players[0].melds[0].kind).toBe('kong');
    expect(pass.drawn).toBe(9);
    s = fixture();
    s.players[0].hand = [4, 4, 4, 4];
    s.players[1].hand = tiles('1231236786785');
    s = play(s, 0, { type: 'kong', tile: 4 });
    expect(s.offer).toBeNull();
    expect(s.players[0].melds[0].concealed).toBe(true);
  });
  it('allows the last discard to win; otherwise draws and repeats the dealer', () => {
    let s = fixture();
    s.wall = [];
    s.players[0].hand = [4];
    s.players[1].hand = tiles('1122334466775');
    s = play(s, 0, { type: 'discard', tile: 4 });
    expect(actions(s, 1)).toEqual([{ type: 'win' }, { type: 'pass' }]);
    expect(
      play(s, 1, { type: 'win' }).result?.score?.patterns.map((p) => p.label),
    ).toContain('Buangan terakhir');
    s = play(s, 1, { type: 'pass' });
    expect(s.result?.kind).toBe('draw');
    expect(tableView(s, null).players.map((p) => p.revealed)).toEqual(
      s.players.map((p) => [...p.hand].sort((a, b) => a - b)),
    );
    const firstVote = play(s, 2, { type: 'next' });
    expect(firstVote).toMatchObject({
      number: 1,
      ready: [2],
      revision: s.revision,
    });
    expect(actions(firstVote, 2)).toEqual([]);
    const moreVotes = [0, 3].reduce(
      (state, seat) => play(state, seat, { type: 'next' }),
      firstVote,
    );
    expect(moreVotes.number).toBe(1);
    expect(play(moreVotes, 1, { type: 'next' })).toMatchObject({
      number: 2,
      dealer: 0,
      rotation: 0,
    });
  });
  it('settles self-draw across three opponents and finishes East after four dealer losses', () => {
    let s = fixture();
    s.turn = 2;
    s.players[2].hand = tiles('11122233344455');
    s.drawn = 4;
    s = play(s, 2, { type: 'win' });
    expect(s.scores).toEqual([-128, -128, 384, -128]);
    expect(
      [3, 1, 0, 2].reduce(
        (state, seat) => play(state, seat, { type: 'next' }),
        s,
      ),
    ).toMatchObject({
      rotation: 1,
      dealer: 1,
      scores: s.scores,
    });
    expect(game.isOver({ ...s, rotation: 3 })).toBe(true);
    expect(game.isOver({ ...s, dealer: 2, rotation: 3 })).toBe(false);
  });
  it('waits for all four seats to agree to a rematch after the East round', () => {
    const tokens = ['a', 'b', 'c', 'd'];
    let room = newRoom('mahjong-hk', 'ABCDE', tokens[0], 1000);
    for (const token of tokens.slice(1))
      room = join(room, undefined, token).room;
    const state = fixture();
    state.rotation = 3;
    state.turn = 1;
    state.players[1].hand = tiles('11122233344455');
    room = { ...room, status: 'over', state: play(state, 1, { type: 'win' }) };

    room = rematch(room, 'b');
    expect(rematch(room, 'b')).toBe(room);
    expect(rematch(leaveRoom(room, 'c'), 'a').status).toBe('waiting');
    room = rematch(rematch(room, 'c'), 'a');
    expect(room.status).toBe('over');
    expect(toView(room, 'a').state).toMatchObject({ ready: [1, 2, 0] });
    room = rematch(room, 'd');
    expect(room.status).toBe('playing');
    expect(toView(room, 'a').state).toMatchObject({
      ready: [],
      number: 1,
      scores: [0, 0, 0, 0],
    });
  });
  it('runs a legal hand to completion with every physical tile accounted for', () => {
    let s = start();
    for (let i = 0; !s.result && i < 450; i++) {
      const actor = [0, 1, 2, 3].find((seat) => actions(s, seat).length)!;
      const legal = actions(s, actor);
      const chosen =
        legal.find((a) => a.type === 'win') ??
        legal.find(
          (a) =>
            a.type === 'kong' ||
            a.type === 'add' ||
            a.type === 'pong' ||
            a.type === 'chow',
        ) ??
        legal[0];
      s = play(s, actor, chosen);
      const tiles = [
        ...s.wall,
        ...s.players.flatMap((p) => [
          ...p.hand,
          ...p.flowers,
          ...p.river,
          ...p.melds.flatMap(meldTiles),
        ]),
      ];
      if (s.offer?.rob) tiles.push(s.offer.tile);
      expect(tiles).toHaveLength(144);
      for (let t = 0; t < 42; t++)
        expect(tiles.filter((k) => k === t)).toHaveLength(t < 34 ? 4 : 1);
    }
    expect(s.result).toBeTruthy();
  });
  it('joins, resumes, and handles permanent departures through the shared room engine', () => {
    let r = newRoom('mahjong-hk', 'ABCDE', 'a', 1000);
    for (const token of ['b', 'c', 'd']) r = join(r, undefined, token).room;
    expect(r.status).toBe('playing');
    expect(() => join(r, undefined, 'e')).toThrow();
    const s = r.state as TableState;
    const tokens = ['a', 'b', 'c', 'd'];
    expect(
      (toView(r, tokens[s.turn]).state as { hand: number[] }).hand,
    ).toHaveLength(14);
    r = act(r, tokens[s.turn], {
      type: 'discard',
      tile: s.drawn,
      revision: s.revision,
    });
    r = leaveRoom(r, 'b', 2000);
    r = join(r, 'b', 'b').room;
    expect(r.left?.[1]).toBeNull();
    r = sweep(leaveRoom(r, 'b', 3000), 3001 + LEAVE_GRACE_MS);
    expect(r.status).toBe('over');
    r = rematch(r, 'a');
    expect(r.status).toBe('waiting');
    expect(join(r, undefined, 'replacement').room.status).toBe('playing');
  });
});
