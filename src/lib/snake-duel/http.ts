import { z } from 'zod';

import { cleanName } from '@/lib/rooms/player-name';
import { RoomError } from '@/lib/rooms/types';
import { DUEL_UNAVAILABLE, DuelStore } from '@/lib/snake-duel/store';

export const NO_STORE = { 'Cache-Control': 'no-store' };
export const duelName = z
  .string()
  .transform((name) => cleanName(name) ?? '')
  .pipe(z.string().min(1));

export function duelFailure(error: unknown) {
  const known = error instanceof RoomError;
  return Response.json(
    { error: known ? error.message : DUEL_UNAVAILABLE },
    { status: known ? error.status : 503, headers: NO_STORE },
  );
}

export async function checkAdmission(store: DuelStore, request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (!(await store.allowAdmission(ip))) {
    throw new RoomError('Terlalu banyak percobaan. Tunggu sebentar.', 429);
  }
}
