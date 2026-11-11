/**
 * A high-quality random generator for shuffling and dealing. `Math.random` is
 * fine statistically but seeded from the moment of first use, so two rooms made
 * in the same tick can share a sequence. This draws fresh entropy from the
 * platform CSPRNG (the Web Crypto `getRandomValues`, present in Node 18+ and
 * the Edge runtime), giving each deck an independent, unpredictable shuffle.
 */
export function cryptoRng(): () => number {
  const g = globalThis as { crypto?: Crypto };
  const webcrypto = g.crypto;
  if (!webcrypto?.getRandomValues) {
    // extremely unlikely; fall back so a deck is still shuffled
    return Math.random;
  }
  const buf = new Uint32Array(64);
  let i = buf.length; // force a refill on first use
  return () => {
    if (i >= buf.length) {
      webcrypto.getRandomValues(buf);
      i = 0;
    }
    // 2^32 so the result is in [0, 1)
    return buf[i++] / 4294967296;
  };
}
