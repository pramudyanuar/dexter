import { bestPokerHand } from '@/lib/games/poker';
import { makeDeck, parse, shuffle } from '@/lib/games/remo-cards';
import { seededRandom } from '@/lib/games/seeded-random';

export const ARCHIVE_TARGETS = [25, 42, 55, 72, 88] as const;
export const ARCHIVE_BASE_POINTS = [5, 10, 16, 22, 28, 34, 42, 52, 64] as const;
const ATTEMPTS = 3;
const PROOF_POINTS = 8;
const MAX_HAND_SIZE = 11;

export const CONTRACTS = {
  red: { name: 'Segel merah', rule: 'Kedua bukti harus hati atau wajik.' },
  adjacent: {
    name: 'Nomor berurutan',
    rule: 'Nilai kedua bukti berselisih satu. As dihitung 1.',
  },
  suit: {
    name: 'Lambang serupa',
    rule: 'Kedua bukti harus memiliki lambang yang sama.',
  },
  high: {
    name: 'Koleksi kartu tinggi',
    rule: 'Kedua bukti harus bernilai 9, 10, J, Q, atau K.',
  },
  mixed: {
    name: 'Warna silang',
    rule: 'Gunakan satu bukti merah dan satu bukti hitam.',
  },
} as const;

export const ARCHIVE_UPGRADES = {
  space: {
    name: 'Map tambahan',
    description: '+1 kartu di setiap pengambilan.',
  },
  redraw: {
    name: 'Akses gudang',
    description: '+1 kesempatan tukar setiap ronde.',
  },
  proof: {
    name: 'Segel kurator',
    description: '+3 poin untuk setiap kontrak yang cocok.',
  },
} as const;

type Contract = keyof typeof CONTRACTS;
export type ArchiveUpgrade = keyof typeof ARCHIVE_UPGRADES;
type Award = { category: number; base: number; bonus: number };
type Loadout = { size: number; redraws: number; proofBoost: number };

export type ArchiveRun = {
  seed: number;
  contracts: Contract[];
  round: number;
  deck: string[];
  cards: string[];
  loadout: Loadout;
  points: number;
  attempts: number;
  redraws: number;
  phase: 'playing' | 'upgrade' | 'won' | 'lost';
  last: Award | null;
};

function beginRound(
  seed: number,
  contracts: Contract[],
  round: number,
  loadout: Loadout,
): ArchiveRun {
  // Separate seeds for the contract order and for each round's deck.
  const rng = seededRandom((seed + (round + 1) * 0x9e3779b9) >>> 0);
  const deck = shuffle(makeDeck(), rng);
  return {
    seed,
    contracts,
    round,
    loadout,
    cards: deck.splice(0, loadout.size),
    deck,
    points: 0,
    attempts: ATTEMPTS,
    redraws: loadout.redraws,
    phase: 'playing',
    last: null,
  };
}

export function startArchive(seed: number) {
  const contracts = shuffle(
    Object.keys(CONTRACTS) as Contract[],
    seededRandom(seed),
  );
  return beginRound(seed, contracts, 0, { size: 9, redraws: 2, proofBoost: 0 });
}

function validCards(run: ArchiveRun, cards: string[]) {
  return (
    new Set(cards).size === cards.length &&
    cards.every((card) => run.cards.includes(card))
  );
}

function matches(contract: Contract, cards: string[]) {
  if (cards.length !== 2) return false;
  const [a, b] = cards.map(parse);
  const red = (card: ReturnType<typeof parse>) =>
    card.suit === 'H' || card.suit === 'D';
  switch (contract) {
    case 'red':
      return red(a) && red(b);
    case 'adjacent':
      return Math.abs(a.rank - b.rank) === 1;
    case 'suit':
      return a.suit === b.suit;
    case 'high':
      return a.rank >= 9 && b.rank >= 9;
    case 'mixed':
      return red(a) !== red(b);
  }
}

export const archiveProofPoints = (run: ArchiveRun) =>
  PROOF_POINTS + run.loadout.proofBoost;

export function archiveAward(
  run: ArchiveRun,
  scored: string[],
  proof: string[],
): Award | null {
  if (
    scored.length !== 5 ||
    proof.length > 2 ||
    !validCards(run, [...scored, ...proof])
  )
    return null;
  const [category] = bestPokerHand(scored);
  const bonus = matches(run.contracts[run.round], proof)
    ? archiveProofPoints(run)
    : 0;
  return { category, base: ARCHIVE_BASE_POINTS[category], bonus };
}

export function submitArchive(
  run: ArchiveRun,
  scored: string[],
  proof: string[],
): ArchiveRun {
  if (run.phase !== 'playing') return run;
  const award = archiveAward(run, scored, proof);
  if (!award) return run;
  const points = run.points + award.base + award.bonus;
  const attempts = run.attempts - 1;
  if (points >= ARCHIVE_TARGETS[run.round]) {
    const phase = run.round === ARCHIVE_TARGETS.length - 1 ? 'won' : 'upgrade';
    return { ...run, points, attempts, phase, last: award };
  }
  if (!attempts)
    return { ...run, points, attempts, phase: 'lost', last: award };
  return {
    ...run,
    points,
    attempts,
    last: award,
    cards: run.deck.slice(0, run.loadout.size),
    deck: run.deck.slice(run.loadout.size),
  };
}

export function redrawArchive(run: ArchiveRun, cards: string[]): ArchiveRun {
  if (
    run.phase !== 'playing' ||
    run.redraws === 0 ||
    !validCards(run, cards) ||
    cards.length < 1 ||
    cards.length > 3 ||
    cards.length > run.deck.length
  )
    return run;
  const fresh = run.deck.slice(0, cards.length);
  let next = 0;
  return {
    ...run,
    redraws: run.redraws - 1,
    deck: run.deck.slice(cards.length),
    cards: run.cards.map((card) =>
      cards.includes(card) ? fresh[next++] : card,
    ),
  };
}

export function canUpgradeArchive(run: ArchiveRun, upgrade: ArchiveUpgrade) {
  return upgrade !== 'space' || run.loadout.size < MAX_HAND_SIZE;
}

export function upgradeArchive(
  run: ArchiveRun,
  upgrade: ArchiveUpgrade,
): ArchiveRun {
  if (run.phase !== 'upgrade' || !canUpgradeArchive(run, upgrade)) return run;
  const loadout = {
    size: run.loadout.size + Number(upgrade === 'space'),
    redraws: run.loadout.redraws + Number(upgrade === 'redraw'),
    proofBoost: run.loadout.proofBoost + (upgrade === 'proof' ? 3 : 0),
  };
  return beginRound(run.seed, run.contracts, run.round + 1, loadout);
}
