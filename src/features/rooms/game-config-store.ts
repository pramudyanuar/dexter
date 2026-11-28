import 'server-only';

import {
  DEFAULT_GAME_CONFIG,
  type GameConfig,
  sanitizeGameConfig,
} from '@/features/rooms/game-config';
import { getSupabaseState } from '@/integrations/supabase/state';

const key = 'game-config';
const local = globalThis as typeof globalThis & { __gameConfig?: GameConfig };

export async function getGameConfig(): Promise<GameConfig> {
  const state = getSupabaseState('admin');
  if (state) {
    const saved = await state.get<GameConfig>(key).catch(() => null);
    return sanitizeGameConfig(saved ?? DEFAULT_GAME_CONFIG);
  }
  return sanitizeGameConfig(local.__gameConfig ?? DEFAULT_GAME_CONFIG);
}

export async function saveGameConfig(raw: unknown): Promise<GameConfig> {
  const clean = sanitizeGameConfig(raw);
  const state = getSupabaseState('admin');
  if (state) await state.set(key, clean);
  else if (process.env.NODE_ENV !== 'production') local.__gameConfig = clean;
  else throw new Error('Supabase is not configured');
  return clean;
}
