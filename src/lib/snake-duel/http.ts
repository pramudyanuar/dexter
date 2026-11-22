import { ipAddress } from '@vercel/functions';
import { z } from 'zod';

import { cleanName } from '@/lib/rooms/player-name';
import { DUEL_UNAVAILABLE, DuelError, DuelStore } from '@/lib/snake-duel/store';

export const NO_STORE = { 'Cache-Control': 'no-store' };
export const duelName = z
  .string()
  .transform((name) => cleanName(name) ?? '')
  .pipe(z.string().min(1));

export function duelFailure(error: unknown) {
  const known = error instanceof DuelError;
  return Response.json(
    { error: known ? error.message : DUEL_UNAVAILABLE },
    { status: known ? error.status : 503, headers: NO_STORE },
  );
}

export async function checkAdmission(store: DuelStore, request: Request) {
  if (!(await store.allowAdmission(ipAddress(request) ?? 'local'))) {
    throw new DuelError('Terlalu banyak percobaan. Tunggu sebentar.', 429);
  }
}
