import {
  type Course,
  courses,
  HEIGHT,
  type Rect,
  SAW_RADIUS,
  type Surface,
  WIDTH,
} from './content';
import {
  type Direction,
  distanceToRect,
  footprint,
  GADGET_DIMENSIONS,
  type GadgetKind,
  overlaps,
  type Point,
  VECTOR,
} from './mechanisms';

const cardinal = [0, 1, 2, 3] as const;
const still = [0] as const;
export const ITEMS = {
  plank: { art: 'wood', w: 3, h: 0.5, turns: cardinal, group: 'path' },
  steel: { art: 'iron', w: 1, h: 1.5, turns: cardinal, group: 'path' },
  shelf: { art: 'wood', w: 2, h: 0.3, turns: still, group: 'path' },
  spikes: { art: 'spikes', w: 2, h: 0.5, turns: cardinal, group: 'hazard' },
  saw: {
    art: 'saw',
    w: SAW_RADIUS * 2,
    h: SAW_RADIUS * 2,
    turns: still,
    group: 'hazard',
  },
  rail: {
    art: 'saw',
    w: SAW_RADIUS * 2,
    h: SAW_RADIUS * 2,
    turns: [0, 1],
    group: 'hazard',
  },
  arrow: { art: 'arrow', w: 1, h: 1, turns: cardinal, group: 'hazard' },
  spring: { art: 'spring', w: 1, h: 0.5, turns: cardinal, group: 'path' },
  conveyor: { art: 'belt', w: 2.5, h: 0.5, turns: [0, 2], group: 'path' },
  lift: { art: 'wood', w: 2, h: 0.5, turns: still, group: 'path' },
  bomb: { art: 'bomb', w: 0.9, h: 0.9, turns: still, group: 'utility' },
  coin: { art: 'coin', w: 0.5, h: 0.5, turns: still, group: 'utility' },
  fan: { art: 'fan', w: 1, h: 1, turns: cardinal, group: 'utility' },
  piston: { art: 'piston', w: 1.25, h: 0.85, turns: cardinal, group: 'hazard' },
  swing: { art: 'swing', w: 0.75, h: 0.75, turns: cardinal, group: 'hazard' },
} as const satisfies Record<
  string,
  {
    art: string;
    w: number;
    h: number;
    turns: readonly Direction[];
    group: 'path' | 'hazard' | 'utility';
  }
>;

export type ItemId = keyof typeof ITEMS;
export type Part = Point & {
  id: string;
  item: ItemId;
  turn: Direction;
  owner: number;
  mount?: string;
};
type Position = Point & { turn: Direction };
export type PlacementError =
  'bounds' | 'protected' | 'blocked' | 'mount' | 'empty' | 'cap' | 'turn';
export type Preview = {
  point: Position;
  base: Rect;
  error?: PlacementError;
  targets: string[];
  mount?: string;
};
export const BLAST = 1.6;
export const RAIL_TRAVEL = 1.65;
export const LIFT_TRAVEL = 2.5;
export const BOARD_LIMIT = 64;
const HAZARD_LIMIT = 24;
const MOVING_LIMIT = 8;
export const itemIds = Object.keys(ITEMS) as ItemId[];

export const partyBase: Course = {
  ...courses.course,
  surfaces: courses.course.surfaces.filter(
    (s) => s.id !== 'bypass' && s.id !== 'crate',
  ),
  saws: [],
};

const terrain = {
  plank: 'wood',
  steel: 'iron',
  shelf: 'ledge',
  conveyor: 'conveyor',
  spring: 'spring',
  lift: 'lift',
  arrow: 'housing',
  fan: 'housing',
  swing: 'housing',
  piston: 'housing',
} satisfies Partial<Record<ItemId, Surface['type']>>;

export function itemRect(item: ItemId, point: Position) {
  const data = ITEMS[item];
  return footprint(point, data.w, data.h, point.turn);
}

function sweepRect(item: ItemId, point: Position) {
  const base = itemRect(item, point);
  if (item === 'lift') return { ...base, h: base.h + LIFT_TRAVEL };
  return base;
}

function moving(item: ItemId) {
  return ['rail', 'lift', 'swing', 'piston'].includes(item);
}

export function assembledCourse(parts: Part[], base = partyBase): Course {
  const surfaces = [...base.surfaces];
  const saws = [...base.saws];
  const gadgets = [...(base.gadgets ?? [])];
  for (const part of parts) {
    const type = terrain[part.item as keyof typeof terrain];
    const travel =
      part.item === 'lift'
        ? LIFT_TRAVEL
        : surfaces.find((s) => s.id === part.mount)?.travel;
    if (type) {
      surfaces.push({
        ...itemRect(part.item, part),
        id: part.id,
        type,
        owner: part.owner,
        turn: part.turn,
        travel,
        ...(part.item === 'conveyor' ? { belt: part.turn === 2 ? -1 : 1 } : {}),
      });
    }
    if (part.item === 'saw' || part.item === 'rail') {
      saws.push({
        x: part.x,
        y: part.y,
        travel: part.item === 'rail' ? RAIL_TRAVEL : 0,
        vertical: part.turn === 1,
        owner: part.owner,
        period: 225,
      });
    }
    if (Object.hasOwn(GADGET_DIMENSIONS, part.item)) {
      gadgets.push({ ...part, kind: part.item as GadgetKind });
    }
  }
  return { ...base, surfaces, saws, gadgets };
}

export function protectedZones(base = partyBase) {
  return [
    { x: base.start.x - 1.4, y: base.start.y - 0.35, w: 4.15, h: 2.2 },
    {
      x: base.goal.x - 0.45,
      y: base.goal.y - 0.36,
      w: base.goal.w + 0.9,
      h: base.goal.h + 0.77,
    },
  ];
}

export function demolitionTargets(parts: Part[], center: Point) {
  const targets = new Set(
    parts
      .filter(
        (part) => distanceToRect(center, itemRect(part.item, part)) <= BLAST,
      )
      .map((part) => part.id),
  );
  // Mounts point to earlier objects, so one pass reaches every descendant.
  for (const part of parts)
    if (part.mount && targets.has(part.mount)) targets.add(part.id);
  return [...targets];
}

export function previewPlacement(
  parts: Part[],
  item: ItemId,
  position: Position,
  base = partyBase,
  board = assembledCourse(parts, base),
): Preview {
  let point: Position = {
    x: Math.round(position.x * 2) / 2,
    y: Math.round(position.y * 2) / 2,
    turn: position.turn,
  };
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !ITEMS[item].turns.some((turn) => turn === point.turn)
  ) {
    return {
      point,
      base: { x: 0, y: 0, w: 0, h: 0 },
      targets: [],
      error: 'turn',
    };
  }
  let rect = itemRect(item, point);
  const targets = item === 'bomb' ? demolitionTargets(parts, point) : [];
  let mount: string | undefined;
  const result = (error?: PlacementError): Preview => ({
    point,
    base: rect,
    targets,
    mount,
    error,
  });
  if (item === 'bomb') {
    if (point.x < 0 || point.y < 0 || point.x > WIDTH || point.y > HEIGHT)
      return result('bounds');
    return result(targets.length ? undefined : 'empty');
  }
  if (item === 'spikes' || item === 'arrow') {
    const normal = VECTOR[(point.turn + 1) % 4];
    let best = 0.27;
    let offset = 0;
    for (const s of board.surfaces) {
      if (s.type === 'housing') continue;
      const gap = normal.y
        ? normal.y > 0
          ? s.y + s.h - rect.y
          : s.y - rect.y - rect.h
        : normal.x > 0
          ? s.x + s.w - rect.x
          : s.x - rect.x - rect.w;
      const support = normal.y
        ? Math.min(rect.x + rect.w, s.x + s.w) - Math.max(rect.x, s.x)
        : Math.min(rect.y + rect.h, s.y + s.h) - Math.max(rect.y, s.y);
      if (support >= 0.24 && Math.abs(gap) < best) {
        mount = s.id;
        best = Math.abs(gap);
        offset = gap;
      }
    }
    if (mount) {
      point = normal.y
        ? { ...point, y: point.y + offset }
        : { ...point, x: point.x + offset };
      rect = itemRect(item, point);
    } else if (item === 'spikes') return result('mount');
  }
  const swept = sweepRect(item, point);
  const attachedLift = board.surfaces.find((s) => s.id === mount)?.travel ?? 0;
  const occupied = { ...swept, h: swept.h + attachedLift };
  if (
    occupied.x < 0 ||
    occupied.y < 0 ||
    occupied.x + occupied.w > WIDTH ||
    occupied.y + occupied.h > HEIGHT
  )
    return result('bounds');
  if (protectedZones(base).some((zone) => overlaps(occupied, zone)))
    return result('protected');
  if (
    parts.length >= BOARD_LIMIT ||
    (ITEMS[item].group === 'hazard' &&
      parts.filter((p) => ITEMS[p.item].group === 'hazard').length >=
        HAZARD_LIMIT) ||
    (moving(item) &&
      parts.filter((part) => moving(part.item)).length >= MOVING_LIMIT)
  )
    return result('cap');
  if (
    base.surfaces.some(
      (surface) =>
        surface.id !== mount &&
        overlaps(occupied, {
          ...surface,
          h: surface.h + (surface.travel ?? 0),
        }),
    ) ||
    parts.some((part) => {
      if (part.id === mount) return false;
      const bounds = sweepRect(part.item, part);
      const travel =
        board.surfaces.find((s) => s.id === part.mount)?.travel ?? 0;
      return overlaps(occupied, { ...bounds, h: bounds.h + travel });
    })
  )
    return result('blocked');
  return result();
}

export function startPositions(course: Course, seats: number) {
  return Array.from({ length: seats }, (_, seat) => ({
    x: course.start.x + seat * 0.73,
    y: course.start.y,
  }));
}
