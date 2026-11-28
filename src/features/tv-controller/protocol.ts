export interface ControllerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  ax?: number;
  ay?: number;
  a: boolean;
  b: boolean;
}

export const EMPTY_INPUT: ControllerInput = {
  left: false,
  right: false,
  up: false,
  down: false,
  ax: 0,
  ay: 0,
  a: false,
  b: false,
};

export interface PlayerSlotTheme {
  label: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

export const TV_SLOTS: readonly PlayerSlotTheme[] = [
  {
    label: 'Merah',
    color: '#ef4444',
    bg: 'bg-red-500/15',
    border: 'border-red-500/50',
    text: 'text-red-400',
  },
  {
    label: 'Biru',
    color: '#3b82f6',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
  },
  {
    label: 'Hijau',
    color: '#22c55e',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
  },
  {
    label: 'Kuning',
    color: '#eab308',
    bg: 'bg-amber-400/15',
    border: 'border-amber-400/50',
    text: 'text-amber-300',
  },
] as const;

export type RacePhase = 'lobby' | 'playing' | 'over';

export type TvMessage =
  | { type: 'join'; clientId: string; name: string }
  | { type: 'leave'; clientId: string }
  | {
      type: 'welcome';
      clientId: string;
      slot: number;
      phase: RacePhase;
    }
  | { type: 'full'; clientId: string }
  | {
      type: 'input';
      clientId: string;
      slot: number;
      input: ControllerInput;
      seq: number;
    }
  | {
      type: 'phase';
      phase: RacePhase;
      winnerSlot: number | null;
      laps: number[];
    };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Generate a 5-character room code that avoids ambiguous characters (0/O, 1/I). */
export function createTvRoomCode(): string {
  let code = '';
  const bytes = new Uint8Array(5);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 5; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeTvRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
}
