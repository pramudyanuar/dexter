import type { RoomStore } from '@/lib/rooms/store';
import { Room, RoomError } from '@/lib/rooms/types';

/**
 * Applies `change` to the room and saves it, but only over the version it was
 * computed from. If someone else changed the room in between (a move, or the
 * clock removing a player), it starts over from the fresh room, so no change
 * ever silently overwrites another. `change` may throw a RoomError.
 */
export async function mutate(
  store: RoomStore,
  room: Room,
  change: (current: Room) => Room,
  tries = 3,
): Promise<Room> {
  let current = room;
  for (let i = 0; i < tries; i++) {
    const next = change(current);
    if (next === current) return next;
    if (await store.saveIf(next, current.version)) return next;
    const fresh = await store.get(current.code);
    if (!fresh)
      throw new RoomError('Room tidak ditemukan atau sudah kedaluwarsa', 404);
    current = fresh;
  }
  throw new RoomError('Server sedang sibuk, coba lagi', 409);
}
