/**
 * Sliding-window limiter, kept in memory. On serverless each instance counts
 * for itself, so this slows abuse down rather than stopping it.
 */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return {
    /** Records an attempt and says whether it is within the limit. */
    allow(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      // forget idle keys so the map cannot grow without bound
      if (hits.size > 5000) {
        for (const [k, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }
      return true;
    },
  };
}
