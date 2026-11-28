import {
  FLOWERS,
  SEASONS,
  STANDARD_KINDS,
} from '@/features/games/logic/mahjong-tiles';

export const TILE_CODES = [...STANDARD_KINDS, ...FLOWERS, ...SEASONS];
export const WIND_NAMES = ['Timur', 'Selatan', 'Barat', 'Utara'];
export type Meld = {
  kind: 'chow' | 'pong' | 'kong';
  tile: number;
  concealed?: boolean;
};
export type WinSource = 'draw' | 'discard' | 'replacement' | 'rob';
export type Pattern = { label: string; faan: number };
export interface Score {
  patterns: Pattern[];
  faan: number;
  units: number;
}
export interface ScoringContext {
  wind: number;
  flowers: number[];
  source: WinSource;
  winningTile: number;
  last: boolean;
  opening?: 'Langit' | 'Bumi' | 'Manusia';
}

const terminal = (tile: number) =>
  tile < 27 && (tile % 9 === 0 || tile % 9 === 8);
const outside = (tile: number) => tile >= 27 || terminal(tile);
export const meldTiles = ({ kind, tile }: Meld) =>
  kind === 'chow'
    ? [tile, tile + 1, tile + 2]
    : Array<number>(kind === 'kong' ? 4 : 3).fill(tile);
export const PAYMENTS = [8, 8, 8, 8, 16, 24, 32, 48, 64, 96, 128];

function total(patterns: Pattern[]): Score {
  const faan = Math.min(
    10,
    patterns.reduce((sum, p) => sum + p.faan, 0),
  );
  return { patterns, faan, units: PAYMENTS[faan] };
}
const limit = (label: string) => total([{ label, faan: 10 }]);

// Taking the first remaining tile bounds the search while still finding every
// decomposition, including tiles which can be used in either a chow or a pong.
function partitions(
  tiles: number[],
  sets: Meld[],
  visit: (sets: Meld[]) => void,
) {
  if (!tiles.length) {
    visit(sets);
    return;
  }
  const tile = tiles[0];
  if (tiles[2] === tile) {
    partitions(tiles.slice(3), [...sets, { kind: 'pong', tile }], visit);
  }
  if (
    tile >= 27 ||
    tile % 9 > 6 ||
    !tiles.includes(tile + 1) ||
    !tiles.includes(tile + 2)
  )
    return;
  const rest = tiles.slice(1);
  rest.splice(rest.indexOf(tile + 1), 1);
  rest.splice(rest.indexOf(tile + 2), 1);
  partitions(rest, [...sets, { kind: 'chow', tile }], visit);
}

// Dexter uses an East-round HK Old Style table. See the in-game rule sheet.
export function scoreHand(
  hand: number[],
  melds: Meld[],
  ctx: ScoringContext,
): Score | null {
  if (hand.length !== 14 - 3 * melds.length) return null;
  const sorted = [...hand].sort((a, b) => a - b);
  const all = [...hand, ...melds.flatMap(meldTiles)];
  const suits = new Set(
    all.filter((t) => t < 27).map((t) => Math.floor(t / 9)),
  );
  const honours = all.some((t) => t >= 27);
  const counts = Array<number>(34).fill(0);
  for (const t of sorted) counts[t]++;
  const closed = melds.every((m) => m.concealed);
  const self = ctx.source === 'draw' || ctx.source === 'replacement';
  let best: Score | null = null;

  function evaluate(sets: Meld[], pair: number, special?: 'pairs' | 'orphans') {
    const groups = sets.filter((m) => m.kind !== 'chow').map((m) => m.tile);
    const winds = groups.filter((t) => t >= 27 && t < 31).length;
    const dragons = groups.filter((t) => t >= 31).length;
    const nineGates =
      !melds.length &&
      suits.size === 1 &&
      !honours &&
      sorted
        .filter((_, i) => i !== sorted.indexOf(ctx.winningTile))
        .map((t) => (t % 9) + 1)
        .join('') === '1112345678999';
    const cap =
      ctx.opening ||
      (special === 'orphans' && 'Tiga belas yatim') ||
      (nineGates && 'Sembilan gerbang') ||
      (!suits.size && 'Semua kehormatan') ||
      (all.every(terminal) && 'Semua terminal') ||
      (winds === 4 && 'Empat angin besar') ||
      (melds.filter((m) => m.kind === 'kong').length === 4 && 'Empat kong');
    if (cap) {
      best = limit(cap);
      return;
    }

    const patterns: Pattern[] = [];
    const add = (label: string, faan: number) => patterns.push({ label, faan });
    const concealedPongs =
      groups.length === 4 && closed && (self || pair === ctx.winningTile);
    const mixedTerminals = all.every(outside) && honours && suits.size > 0;
    if (special === 'pairs') add('Tujuh pasang', 4);
    if (concealedPongs) add('Empat pong tertutup', 8);
    else if (!special && mixedTerminals) add('Terminal dan kehormatan', 4);
    else if (groups.length === 4) add('Semua pong', 3);
    if (!special && !groups.length && pair < 31 && pair !== 27 + ctx.wind)
      add('Semua chow', 1);
    if (suits.size === 1)
      add(
        honours ? 'Satu jenis dengan kehormatan' : 'Satu jenis murni',
        honours ? 3 : 7,
      );
    if (dragons === 3) add('Tiga naga besar', 8);
    else if (dragons === 2 && pair >= 31) add('Tiga naga kecil', 5);
    else if (dragons) add('Pong naga', dragons);
    if (winds === 3 && pair >= 27 && pair < 31) add('Empat angin kecil', 6);
    else {
      if (groups.includes(27 + ctx.wind)) add('Angin kursi', 1);
      if (groups.includes(27)) add('Angin ronde', 1);
    }
    if (self) add('Ambil sendiri', 1);
    else if (closed && !concealedPongs) add('Tangan tertutup', 1);
    if (ctx.source === 'rob') add('Rebut kong', 1);
    if (ctx.source === 'replacement') add('Pengganti kong', 1);
    if (ctx.last) add(self ? 'Ubin terakhir' : 'Buangan terakhir', 1);
    if (!ctx.flowers.length) add('Tanpa bunga', 1);
    for (const base of [34, 38]) {
      if ([0, 1, 2, 3].every((i) => ctx.flowers.includes(base + i)))
        add(base === 34 ? 'Empat bunga' : 'Empat musim', 3);
      else if (ctx.flowers.includes(base + ctx.wind))
        add(base === 34 ? 'Bunga kursi' : 'Musim kursi', 1);
    }
    const score = total(patterns);
    if (!best || score.faan > best.faan) best = score;
  }
  if (hand.length === 14 && all.every(outside) && new Set(hand).size === 13)
    evaluate([], -1, 'orphans');
  if (counts.filter((n) => n === 2).length === 7) evaluate([], -1, 'pairs');
  counts.forEach((count, pair) => {
    if (count < 2) return;
    const rest = [...sorted];
    rest.splice(rest.indexOf(pair), 2);
    partitions(rest, melds, (sets) => evaluate(sets, pair));
  });
  return best;
}
