/**
 * @jest-environment node
 */
import { applyAdminAction, summarizeRoom } from '@/lib/rooms/admin';
import { Room } from '@/lib/rooms/types';

function sampleRoom(): Room {
  return {
    code: '123456',
    game: 'uno',
    tokens: ['secret-tok-0', 'secret-tok-1', null],
    names: ['Andi', 'Budi', null],
    status: 'playing',
    state: { turn: 1 },
    version: 3,
    createdAt: 1000,
    stamp: 2000,
    host: 0,
  };
}

describe('admin room helpers', () => {
  it('summarizes a room without exposing player tokens', () => {
    const summary = summarizeRoom(sampleRoom());
    expect(summary.code).toBe('123456');
    expect(summary.playerCount).toBe(2);
    expect(summary.activeCount).toBe(2);
    expect(summary.players[0].isHost).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('secret-tok');
  });

  it('applies kick, setHost, and forceEnd actions', () => {
    const room = sampleRoom();
    const kicked = applyAdminAction(room, { action: 'kick', seat: 1 }, 3000);
    expect(kicked.out?.[1]).toBe(true);
    expect(kicked.why?.[1]).toBe('kicked');
    expect(kicked.version).toBe(4);

    const hosted = applyAdminAction(
      kicked,
      { action: 'setHost', seat: 1 },
      4000,
    );
    expect(hosted.host).toBe(1);
    expect(hosted.hostAt).toBe(4000);

    const ended = applyAdminAction(hosted, { action: 'forceEnd' }, 5000);
    expect(ended.status).toBe('over');
  });

  it('throws on invalid seat', () => {
    expect(() =>
      applyAdminAction(sampleRoom(), { action: 'kick', seat: 2 }),
    ).toThrow();
  });
});
