/** A 32-bit PRNG with a serializable state. */
export function nextRandom(seed: number): [state: number, value: number] {
  const state = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(state ^ (state >>> 15), state | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return [state, ((value ^ (value >>> 14)) >>> 0) / 4294967296];
}

export function seededRandom(seed: number) {
  return () => {
    const [state, value] = nextRandom(seed);
    seed = state;
    return value;
  };
}
