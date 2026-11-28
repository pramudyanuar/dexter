import {
  GAME_CATEGORIES,
  GAME_PAGES,
  type GameCategory,
  type GameEntry,
  GAMES,
} from '@/features/games/catalog';

export type DiscoveryCategory = 'all' | 'multiplayer' | GameCategory;
export type PlayFilter = 'all' | 'solo' | 'online';

export const FEATURED_GAME_IDS = ['dart', 'sekata', 'monkeys'] as const;
const RECOMMENDED_GAME_IDS = ['quiz', 'mahjong', 'remo'] as const;

export function gameById(id: string) {
  return GAME_PAGES.find((game) => game.id === id);
}

export function gameDetailHref(id: string) {
  return `/games/info/${id}`;
}

export function hasSoloMode(game: GameEntry) {
  return !game.online || Boolean(game.solo);
}

export function gameModes(game: GameEntry): string[] {
  switch (game.id) {
    case 'snake':
      return ['Classic', 'Harian', 'Duel online'];
    case 'gelud':
      return ['Lawan AI', 'Dua pemain satu keyboard', 'Room online'];
    case 'dart':
      return ['Solo dalam room', 'Room online'];
    case 'uno':
      return ['Klasik online', 'Flip online', 'No Mercy online'];
    default:
      return [game.online ? 'Room online' : 'Solo'];
  }
}

function searchable(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function discoverGames(
  query: string,
  category: DiscoveryCategory,
  mode: PlayFilter,
) {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  return GAMES.filter((game) => {
    if (mode === 'solo' && !hasSoloMode(game)) return false;
    if (mode === 'online' && !game.online) return false;
    if (category === 'multiplayer' && !game.online) return false;
    if (
      category !== 'all' &&
      category !== 'multiplayer' &&
      !game.categories.includes(category)
    )
      return false;
    if (terms.length === 0) return true;
    const haystack = searchable(
      [
        game.title,
        game.id,
        game.description,
        ...game.categories.map((genre) => GAME_CATEGORIES[genre]),
        ...gameModes(game),
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}

export type GameVisits = Record<
  string,
  { count: number; lastOpenedAt: number }
>;

export function readGameVisits(value: unknown): GameVisits {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return {};
  const entries = value as Record<string, Partial<GameVisits[string]> | null>;
  return Object.fromEntries(
    GAME_PAGES.flatMap(({ id }) => {
      const visit = entries[id];
      return visit &&
        typeof visit.count === 'number' &&
        Number.isSafeInteger(visit.count) &&
        visit.count > 0 &&
        typeof visit.lastOpenedAt === 'number' &&
        Number.isFinite(visit.lastOpenedAt)
        ? [[id, { count: visit.count, lastOpenedAt: visit.lastOpenedAt }]]
        : [];
    }),
  );
}

export function discoveryShelves(visits: GameVisits, last: string | null) {
  const opened = GAME_PAGES.filter(({ id }) => visits[id]);
  const recent = [...opened].sort(
    (a, b) => visits[b.id].lastOpenedAt - visits[a.id].lastOpenedAt,
  );
  const legacy = last ? gameById(last) : undefined;
  if (legacy && !visits[legacy.id]) recent.unshift(legacy);
  const popular = [...opened].sort(
    (a, b) =>
      visits[b.id].count - visits[a.id].count ||
      visits[b.id].lastOpenedAt - visits[a.id].lastOpenedAt,
  );

  const familiarGenres = new Set(
    recent.slice(0, 3).flatMap(({ categories }) => categories),
  );
  const related = GAMES.filter(
    (game) =>
      !visits[game.id] &&
      game.id !== legacy?.id &&
      game.categories.some((genre) => familiarGenres.has(genre)),
  );
  const recommended = [
    ...related,
    ...RECOMMENDED_GAME_IDS.flatMap((id) => {
      const game = gameById(id);
      return game && !related.includes(game) ? [game] : [];
    }),
  ];
  return {
    recent: recent.slice(0, 3),
    popular: popular.slice(0, 3),
    recommended: recommended.slice(0, 3),
  };
}
