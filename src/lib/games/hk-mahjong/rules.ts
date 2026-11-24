import { WIND_NAMES } from '@/lib/games/hk-mahjong/score';

/** Each discard decision and each shared claim window has its own deadline. */
export const DECISION_SECONDS = 25;
export const DECISION_LIMITS = { min: 10, max: 120 };

export function tileLabel(tile: number) {
  if (tile < 27)
    return `${(tile % 9) + 1} ${['bambu', 'karakter', 'lingkaran'][Math.floor(tile / 9)]}`;
  if (tile < 31) return `angin ${WIND_NAMES[tile - 27]}`;
  if (tile < 34) return `naga ${['merah', 'hijau', 'putih'][tile - 31]}`;
  return `${tile < 38 ? 'bunga' : 'musim'} ${((tile - 34) % 4) + 1}`;
}
