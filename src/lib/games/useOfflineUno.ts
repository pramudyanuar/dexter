import * as React from 'react';

import { Move, start, unoGame, UnoState, UnoView } from '@/lib/games/uno';
import { aiMove } from '@/lib/games/uno-ai';
import { cryptoRng } from '@/lib/rooms/rng';
import type { RoomView } from '@/lib/rooms/types';
import useStoredState from '@/lib/useStoredState';

/** Generic bot names; the avatar shows the first letter, so keep them distinct. */
const BOT_NAMES = ['Robo', 'Chip', 'Nova', 'Pixel', 'Zeta', 'Milo', 'Juno'];

/** Milliseconds between automatic AI moves, so they are watchable. */
const AI_DELAY = 750;

/**
 * A single-player Uno game against AI opponents. It drives the same pure engine
 * as the online game and returns the same shape as `useRoom`, so the board
 * renders unchanged. Seat 0 is you; seats 1..n are bots that move on their own.
 */
export function useOfflineUno() {
  const [name, setName] = useStoredState<string>('player-name', '');
  const [game, setGame] = React.useState<UnoState | null>(null);
  const [version, setVersion] = React.useState(0);
  const [error, setError] = React.useState('');
  const [botCount, setBotCount] = React.useState(0);
  const rng = React.useRef<() => number>(Math.random);

  const active = game !== null;

  const apply = React.useCallback((next: UnoState) => {
    setGame(next);
    setVersion((v) => v + 1);
  }, []);

  const begin = React.useCallback(
    (bots: number) => {
      rng.current = cryptoRng();
      setBotCount(bots);
      setError('');
      apply(start(bots + 1, rng.current));
    },
    [apply],
  );

  const leave = React.useCallback(() => {
    setGame(null);
    setError('');
  }, []);

  const move = React.useCallback((m: unknown) => {
    setGame((g) => {
      if (!g) return g;
      try {
        const next = unoGame.move(g, 0, m as Move, rng.current);
        setError('');
        setVersion((v) => v + 1);
        return next;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Langkah tidak valid');
        return g;
      }
    });
  }, []);

  const rematch = React.useCallback(() => {
    setGame((g) => {
      if (!g) return g;
      setVersion((v) => v + 1);
      return unoGame.restart(g, g.players, rng.current);
    });
  }, []);

  // when it is a bot's turn, play one move after a short delay; the resulting
  // state change re-runs this effect for the next bot, then hands back to you
  React.useEffect(() => {
    if (!game || unoGame.isOver(game) || game.turn === 0) return;
    const seat = game.turn;
    const id = setTimeout(() => {
      setGame((g) => {
        if (!g || g.turn !== seat || unoGame.isOver(g)) return g;
        try {
          const next = unoGame.move(
            g,
            seat,
            aiMove(g, seat, rng.current),
            rng.current,
          );
          setVersion((v) => v + 1);
          return next;
        } catch {
          return g; // should not happen: the AI only makes legal moves
        }
      });
    }, AI_DELAY);
    return () => clearTimeout(id);
  }, [game]);

  const names = React.useMemo(
    () => [name || 'Kamu', ...BOT_NAMES.slice(0, botCount)],
    [name, botCount],
  );

  const room: RoomView<UnoView> | null =
    game === null
      ? null
      : {
          code: 'LOKAL',
          game: 'uno',
          status: unoGame.isOver(game) ? 'over' : 'playing',
          seat: 0,
          joined: Array<boolean>(game.players).fill(true),
          names,
          capacity: game.players,
          minPlayers: 2,
          version,
          state: unoGame.view(game, 0) as UnoView,
        };

  const session = active ? { code: 'LOKAL', token: '', you: 0 } : null;

  const noop = React.useCallback(() => {}, []);

  return {
    active,
    begin,
    // useRoom-compatible surface
    session,
    room,
    name,
    setName,
    busy: false,
    error,
    move,
    rematch,
    leave,
    start: noop,
    kick: noop,
    rename: noop,
    create: noop,
    join: noop,
  };
}
