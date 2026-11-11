import type { GameDef } from '@/lib/rooms/game';
import { RoomError } from '@/lib/rooms/types';

export const PICKS = ['batu', 'gunting', 'kertas'] as const;
export type Pick = (typeof PICKS)[number];

/** First to this many round wins takes the match (best of three). */
export const WINS_NEEDED = 2;

const BEATS: Record<Pick, Pick> = {
  batu: 'gunting',
  gunting: 'kertas',
  kertas: 'batu',
};

/** Seat that wins the round, or null for a tie. */
export function roundWinner(a: Pick, b: Pick): 0 | 1 | null {
  if (a === b) return null;
  return BEATS[a] === b ? 0 : 1;
}

export interface SuitState {
  scores: [number, number];
  /** Picks made this round, hidden from the other player until both are in */
  picks: [Pick | null, Pick | null];
  /** The last finished round, revealed to both */
  last: { picks: [Pick, Pick]; winner: 0 | 1 | null } | null;
  round: number;
  /** Winner of the whole match */
  winner: 0 | 1 | null;
}

/** What a player sees: their own pick, and only whether the other has picked. */
export interface SuitView {
  scores: [number, number];
  myPick: Pick | null;
  opponentPicked: boolean;
  last: SuitState['last'];
  round: number;
  winner: 0 | 1 | null;
  target: number;
}

const fresh = (): SuitState => ({
  scores: [0, 0],
  picks: [null, null],
  last: null,
  round: 1,
  winner: null,
});

export const suitGame: GameDef<SuitState> = {
  id: 'suit',
  minPlayers: 2,
  maxPlayers: 2,
  autoStart: true,

  start: fresh,
  restart: fresh,

  move(state, seat, move) {
    const pick = (move as { pick?: unknown } | null)?.pick;
    if (!PICKS.includes(pick as Pick))
      throw new RoomError('Pilihan tidak valid', 400);
    if (state.picks[seat] !== null)
      throw new RoomError('Kamu sudah memilih', 409);

    const picks = [...state.picks] as SuitState['picks'];
    picks[seat] = pick as Pick;
    if (picks[0] === null || picks[1] === null) return { ...state, picks };

    // both are in: reveal, score, and start the next round
    const winner = roundWinner(picks[0], picks[1]);
    const scores = [...state.scores] as [number, number];
    if (winner !== null) scores[winner]++;

    return {
      scores,
      picks: [null, null],
      last: { picks: [picks[0], picks[1]], winner },
      round: state.round + 1,
      winner: winner !== null && scores[winner] >= WINS_NEEDED ? winner : null,
    };
  },

  waiting: (state) => {
    const seats = [0, 1].filter((s) => state.picks[s] === null);
    return state.winner === null && seats.length
      ? { seats, seconds: 25 }
      : null;
  },

  autoMove: (_state, _seat, rng = Math.random) => ({
    pick: PICKS[Math.floor(rng() * PICKS.length)],
  }),

  eliminate: (state, seat) => ({
    ...state,
    picks: [null, null],
    winner: (1 - seat) as 0 | 1,
  }),

  view(state, seat): SuitView {
    return {
      scores: state.scores,
      myPick: seat === null ? null : state.picks[seat],
      opponentPicked: seat === null ? false : state.picks[1 - seat] !== null,
      last: state.last,
      round: state.round,
      winner: state.winner,
      target: WINS_NEEDED,
    };
  },

  isOver: (state) => state.winner !== null,
};
