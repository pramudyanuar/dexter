/**
 * A standard dartboard. Positions are in board units: the centre is (0, 0),
 * x grows to the right and y grows downward (like the screen), and 1 is the
 * outer edge of the double ring. Real sizes (in mm, from the centre) are
 * divided by 170 to get there.
 */

/** The numbers clockwise from the top. */
export const SEQUENCE = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

const MM = 170;

/** Ring boundaries, as fractions of the double ring's outer edge. */
export const RADII = {
  innerBull: 6.35 / MM,
  outerBull: 15.9 / MM,
  tripleIn: 99 / MM,
  tripleOut: 107 / MM,
  doubleIn: 162 / MM,
  doubleOut: 1,
} as const;

export type Ring = 'ibull' | 'obull' | 'single' | 'triple' | 'double' | 'miss';

export interface Hit {
  ring: Ring;
  /** The segment's number, or null for the bull and for a miss */
  number: number | null;
  /** 0 for a miss, 1 single, 2 double, 3 triple (the bull counts 1 and 2) */
  multiplier: 0 | 1 | 2 | 3;
  points: number;
  /** "T20", "D16", "20", "25", "Bull", "Miss" */
  label: string;
}

/** Degrees clockwise from straight up. */
export const angleOf = (x: number, y: number) =>
  ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;

/** Which of the 20 segments a point lies in (0 is the one at the top). */
export const segmentAt = (x: number, y: number) =>
  Math.floor(((angleOf(x, y) + 9) % 360) / 18);

/** What a dart that lands at (x, y) scores. */
export function hitAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (!Number.isFinite(r) || r > RADII.doubleOut) {
    return {
      ring: 'miss',
      number: null,
      multiplier: 0,
      points: 0,
      label: 'Miss',
    };
  }
  if (r <= RADII.innerBull) {
    return {
      ring: 'ibull',
      number: null,
      multiplier: 2,
      points: 50,
      label: 'Bull',
    };
  }
  if (r <= RADII.outerBull) {
    return {
      ring: 'obull',
      number: null,
      multiplier: 1,
      points: 25,
      label: '25',
    };
  }
  const number = SEQUENCE[segmentAt(x, y)];
  if (r > RADII.tripleIn && r <= RADII.tripleOut) {
    return {
      ring: 'triple',
      number,
      multiplier: 3,
      points: number * 3,
      label: `T${number}`,
    };
  }
  if (r > RADII.doubleIn) {
    return {
      ring: 'double',
      number,
      multiplier: 2,
      points: number * 2,
      label: `D${number}`,
    };
  }
  return {
    ring: 'single',
    number,
    multiplier: 1,
    points: number,
    label: String(number),
  };
}

/** The middle of a zone, as a position. Handy for aiming and for tests. */
export function pointAt(
  number: number,
  ring: 'single' | 'triple' | 'double' | 'inner',
): { x: number; y: number } {
  const idx = SEQUENCE.indexOf(number as (typeof SEQUENCE)[number]);
  const a = (idx * 18 * Math.PI) / 180;
  const r =
    ring === 'triple'
      ? (RADII.tripleIn + RADII.tripleOut) / 2
      : ring === 'double'
        ? (RADII.doubleIn + RADII.doubleOut) / 2
        : ring === 'inner'
          ? (RADII.outerBull + RADII.tripleIn) / 2
          : (RADII.tripleOut + RADII.doubleIn) / 2;
  return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
}

/** One score a single dart can make, for working out finishes. */
export interface Shot {
  label: string;
  points: number;
  double: boolean;
}

export const SHOTS: Shot[] = (() => {
  const out: Shot[] = [
    { label: 'Bull', points: 50, double: true },
    { label: '25', points: 25, double: false },
  ];
  for (let n = 20; n >= 1; n--) {
    out.push({ label: `T${n}`, points: n * 3, double: false });
    out.push({ label: `D${n}`, points: n * 2, double: true });
    out.push({ label: String(n), points: n, double: false });
  }
  return out.sort((a, b) => b.points - a.points);
})();
