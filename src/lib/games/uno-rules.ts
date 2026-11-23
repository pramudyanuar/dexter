export const UNO_PLAYERS = { min: 2, max: 8 } as const;
export const UNO_HAND_SIZE = { min: 2, max: 15, default: 7 } as const;
export const UNO_MERCY_LIMIT = { min: 5, max: 100, default: 25 } as const;
export const UNO_TURN_SECONDS = 40;

export const maxMercyHandSize = (mercyLimit: number) =>
  Math.min(UNO_HAND_SIZE.max, mercyLimit - 1);
