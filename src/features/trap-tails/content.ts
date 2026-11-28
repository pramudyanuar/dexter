import {
  advanceBolts,
  type Bolt,
  type Direction,
  type Gadget,
} from './mechanisms';

export type Rect = { x: number; y: number; w: number; h: number };
export type Surface = Rect & {
  id: string;
  type: 'wood' | 'iron' | 'conveyor' | 'spring' | 'lift' | 'ledge' | 'housing';
  travel?: number;
  belt?: -1 | 1;
  turn?: Direction;
  owner?: number;
};

export type Saw = {
  x: number;
  y: number;
  travel: number;
  period: number;
  phase?: number;
  vertical?: boolean;
  owner?: number;
};
export type Course = {
  surfaces: Surface[];
  saws: Saw[];
  gadgets?: Gadget[];
  start: { x: number; y: number };
  goal: Rect;
};

export const WIDTH = 32;
export const HEIGHT = 18;
export const SAW_RADIUS = 0.47;
export const WORKSHOP_PARTY_SIGN = { x: 5.65, y: 5.14 };

const surface = (
  id: string,
  x: number,
  y: number,
  w: number,
  h = 0.5,
  type: Surface['type'] = 'wood',
): Surface => ({
  id,
  x,
  y,
  w,
  h,
  type,
});

const foundry: Course = {
  start: { x: 2, y: 3 },
  goal: { x: 27.05, y: 10, w: 1.15, h: 1.7 },
  surfaces: [
    surface('start', 0.65, 2.4, 5.8, 0.6),
    surface('wall', 8.35, 2, 0.65, 2.65, 'iron'),
    surface('island', 11.3, 4.5, 3.1),
    surface('tower', 25.45, 9.4, 4.85, 0.6),
  ],
  saws: [],
};

const orchardPieces = [
  surface('step', 6.3, 3.75, 1.6, 0.32, 'ledge'),
  surface('approach', 9.2, 3.55, 1.95, 0.42),
  surface('spring', 12, 5, 1, 0.32, 'spring'),
  surface('starter-bridge', 14.7, 5.85, 2.55, 0.38),
  surface('belt', 16.75, 6.95, 2.6, 0.42, 'conveyor'),
  { ...surface('lift', 20.6, 7.35, 2.0, 0.4, 'lift'), travel: 2 },
  surface('exit-bridge', 23.15, 8.83, 1.95, 0.45),
  surface('crate', 19.9, 3.2, 1.2, 0.95, 'iron'),
  surface('bypass', 12.6, 8.4, 1.4, 0.22, 'ledge'),
];
const orchardSaws = [
  { x: 10.3, y: 6.6, travel: 1.25, period: 240 },
  { x: 18.1, y: 5.9, travel: 1.35, period: 200, phase: 2.3 },
  { x: 24.25, y: 10.2, travel: 0, period: 180 },
];

export const courses = {
  lab: {
    ...foundry,
    goal: { x: 28, y: 6, w: 1.15, h: 1.7 },
    surfaces: [
      surface('start', 0.65, 2.4, 5.8, 0.6),
      surface('spike-floor', 6.45, 2.45, 4.25, 0.55),
      surface('arrow-floor', 10.7, 2.45, 4.25, 0.55),
      surface('shield', 12, 4.3, 0.45, 0.7, 'iron'),
      surface('fan-floor', 14.95, 3.05, 3.8, 0.5),
      surface('fan-spring', 15.8, 3.55, 1, 0.36, 'spring'),
      surface('piston-floor', 18.75, 3.8, 4.9, 0.5),
      surface('swing-floor', 23.65, 4.25, 3.6, 0.5),
      surface('tower', 26.2, 5.4, 4.5, 0.6),
    ],
    gadgets: [
      { id: 'lab-spikes', kind: 'spikes', x: 8.25, y: 3.25, turn: 0 },
      { id: 'lab-arrow', kind: 'arrow', x: 14.5, y: 4.72, turn: 2 },
      { id: 'lab-fan', kind: 'fan', x: 17.15, y: 3.05, turn: 1 },
      { id: 'lab-coin', kind: 'coin', x: 17.2, y: 6.25, turn: 0 },
      { id: 'lab-piston', kind: 'piston', x: 20, y: 4.75, turn: 0 },
      { id: 'lab-swing', kind: 'swing', x: 25.1, y: 7.65, turn: 0 },
    ],
  },
  workshop: {
    start: foundry.start,
    goal: { x: 28.5, y: 7.1, w: 1.15, h: 1.7 },
    surfaces: [
      surface('start', 0.65, 2.4, 7.55, 0.6),
      surface('runup', 8.8, 2.8, 2.8, 0.5),
      surface('shaft-left', 11.6, 3.3, 0.55, 1.1, 'iron'),
      surface('shaft-right', 13.8, 2.1, 0.64, 3.9, 'iron'),
      surface('shaft-floor', 11.45, 1.85, 3.0, 0.45),
      surface('spring', 12.45, 2.3, 0.95, 0.35, 'spring'),
      surface('belt', 15.05, 6.05, 3.25, 0.45, 'conveyor'),
      surface('bypass', 15.05, 4.35, 2.95, 0.36, 'ledge'),
      surface('low-road', 18.55, 4.75, 2.55, 0.35),
      { ...surface('lift', 21.5, 4.85, 2.45, 0.5, 'lift'), travel: 2.4 },
      surface('tower', 25, 6.55, 5.3, 0.55),
    ],
    saws: [{ x: 19.2, y: 5.95, travel: 0.96, period: 240, phase: 2.65 }],
  },
  sparse: foundry,
  course: {
    ...foundry,
    surfaces: [...foundry.surfaces, ...orchardPieces],
    saws: orchardSaws,
  },
  dense: {
    ...foundry,
    surfaces: [
      ...foundry.surfaces,
      ...orchardPieces,
      surface('high1', 3.35, 7.6, 2.25, 0.3, 'ledge'),
      surface('high2', 6.45, 8.65, 2.85, 0.5, 'conveyor'),
      surface('high3', 9.9, 9.85, 2.05, 0.42),
      surface('high4', 14.55, 10.65, 2.95, 0.54),
      surface('beam', 18.75, 9.4, 0.62, 3.3, 'iron'),
      surface('high5', 20.35, 11.55, 2.65, 0.4, 'ledge'),
      surface('high6', 25, 12.1, 1.95, 0.4),
      surface('low1', 5.65, 0.6, 1.7, 0.4),
      surface('low2', 10.15, 1.75, 2.65, 0.4),
      surface('low3', 16.9, 2.25, 2.25, 0.4),
    ],
    saws: [
      ...orchardSaws,
      { x: 5.95, y: 9.65, travel: 1.9, period: 215 },
      { x: 15.8, y: 11.7, travel: 1.4, period: 260, phase: 1.6 },
      { x: 21.45, y: 2, travel: 0, period: 180 },
    ],
  },
} satisfies Record<string, Course>;

export type CourseId = keyof typeof courses;

export function courseAt(
  course: Course,
  tick: number,
  previousBolts: Bolt[] = [],
) {
  const surfaces = course.surfaces.map((s) =>
    s.travel
      ? {
          ...s,
          y: s.y + (s.travel * (1 - Math.cos((tick * Math.PI) / 120))) / 2,
        }
      : s,
  );
  const gadgets = (course.gadgets ?? []).map((gadget) => {
    if (!gadget.mount) return gadget;
    const i = surfaces.findIndex((s) => s.id === gadget.mount);
    return i === -1
      ? gadget
      : { ...gadget, y: gadget.y + surfaces[i].y - course.surfaces[i].y };
  });
  return {
    surfaces,
    saws: course.saws.map((s) => {
      const offset =
        s.travel * Math.sin((tick * 2 * Math.PI) / s.period + (s.phase ?? 0));
      return {
        x: s.x + (s.vertical ? 0 : offset),
        y: s.y + (s.vertical ? offset : 0),
        owner: s.owner,
      };
    }),
    gadgets,
    bolts: advanceBolts(gadgets, surfaces, tick, previousBolts),
  };
}
