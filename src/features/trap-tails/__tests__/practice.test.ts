import atlas from '../atlas.json';
import { frameRunners, WIDE } from '../camera';
import { type Course, courses, HEIGHT, WIDTH } from '../content';
import {
  BODY_HEIGHT,
  HALF_WIDTH,
  type Input,
  newRun,
  STEP,
  stepRun,
} from '../movement';

const neutral: Input = {
  direction: 0,
  sprint: false,
  jumpPressed: false,
  jumpHeld: false,
};
const course: Course = {
  start: { x: 2, y: 3 },
  goal: { x: 29, y: 14, w: 1, h: 1 },
  surfaces: [{ id: 'floor', type: 'wood', x: 0, y: 2, w: 25, h: 1 }],
  saws: [],
};

function jumpArc(held: boolean, sprint = false) {
  let frame = newRun(course);
  let apex = frame;
  while (frame.tick < 120) {
    frame = stepRun(course, frame, {
      direction: sprint ? 1 : 0,
      sprint,
      jumpHeld: held,
      jumpPressed: frame.tick === 0,
    });
    if (frame.player.y > apex.player.y) apex = frame;
    if (frame.player.ground) break;
  }
  return { frame, apex };
}

test('full and cut jumps have distinct arcs, and a held press does not auto-hop', () => {
  const full = jumpArc(true);
  const cut = jumpArc(false);
  expect(full.apex.player.y - course.start.y).toBeCloseTo(1.925, 2);
  expect(full.apex.tick * STEP).toBeCloseTo(0.35, 2);
  expect(cut.apex.player.y - course.start.y).toBeLessThan(0.4);
  expect(full.frame.player.pose).toBe('land');
  expect(
    stepRun(course, full.frame, { ...neutral, jumpHeld: true }).player.y,
  ).toBe(3);
});

test('sprint reaches 8 units/s and ground braking stops in nine ticks', () => {
  let frame = newRun(course);
  for (let i = 0; i < 20; i++)
    frame = stepRun(course, frame, { ...neutral, direction: 1, sprint: true });
  expect(frame.player.vx).toBe(8);
  for (let i = 0; i < 9; i++) frame = stepRun(course, frame, neutral);
  expect(frame.player.vx).toBe(0);
  expect(jumpArc(true, true).frame.player.x).toBeGreaterThan(5);
});

test('coyote and buffered jumps remain edge-triggered around ledges', () => {
  const ledge: Course = {
    ...course,
    start: { x: 0.9, y: 3 },
    surfaces: [{ ...course.surfaces[0], w: 1 }],
  };
  let frame = newRun(ledge);
  while (frame.player.ground && frame.tick < 60)
    frame = stepRun(ledge, frame, { ...neutral, direction: 1 });
  expect(frame.player.ground).toBeNull();
  frame = stepRun(ledge, frame, {
    ...neutral,
    direction: 1,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(frame.player.vy).toBeGreaterThan(10);

  const above: Course = { ...course, start: { x: 2, y: 3.06 } };
  frame = newRun(above);
  frame.player.vy = -5;
  frame = stepRun(above, frame, {
    ...neutral,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(frame.player.ground).toBe('floor');
  frame = stepRun(above, frame, { ...neutral, jumpHeld: true });
  expect(frame.player.vy).toBeGreaterThan(10);
});

test('wall contact caps falling and a kick locks input until the player clears the wall', () => {
  const wall: Course = {
    ...course,
    start: { x: 4 - HALF_WIDTH, y: 5 },
    surfaces: [
      ...course.surfaces,
      { id: 'wall', type: 'iron', x: 4, y: 3, w: 0.1, h: 7 },
    ],
  };
  let frame = newRun(wall);
  frame.player.vy = -10;
  frame = stepRun(wall, frame, { ...neutral, direction: 1 });
  expect(frame.player.pose).toBe('wall');
  expect(frame.player.vy).toBe(-2.8);
  frame = stepRun(wall, frame, {
    ...neutral,
    direction: 1,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(frame.player.pose).toBe('kick');
  expect(frame.player.vx).toBe(-6.8);
  for (let t = 0; t < 5; t++)
    frame = stepRun(wall, frame, { ...neutral, direction: 1, jumpHeld: true });
  expect(frame.player.x).toBeLessThan(3.2);
});

test('one-way ledges admit ascent and stop a descending sweep', () => {
  const ledge: Course = {
    ...course,
    surfaces: [
      ...course.surfaces,
      { id: 'ledge', type: 'ledge', x: 1, y: 4.05, w: 3, h: 0.08 },
    ],
  };
  let frame = newRun(ledge);
  for (let i = 0; i < 50; i++)
    frame = stepRun(ledge, frame, {
      ...neutral,
      jumpPressed: i === 0,
      jumpHeld: true,
    });
  expect(frame.player.y).toBeCloseTo(4.13);
  expect(frame.player.ground).toBe('ledge');
});

test('conveyor adds surface velocity while lift carries and spring launches from the top', () => {
  const conveyor: Course = {
    ...course,
    surfaces: [{ ...course.surfaces[0], type: 'conveyor' }],
  };
  const roll = stepRun(conveyor, newRun(conveyor), neutral);
  expect(roll.player.x - 2).toBeCloseTo(2.2 / 60);
  expect(roll.player.vx).toBe(0);

  const lift: Course = {
    ...course,
    surfaces: [{ ...course.surfaces[0], type: 'lift', travel: 2 }],
  };
  let frame = newRun(lift);
  for (let tick = 0; tick < 205; tick++) {
    frame = stepRun(lift, frame, neutral);
    expect(frame.player.y).toBeCloseTo(frame.layout.surfaces[0].y + 1, 10);
    expect(frame.player.ground).toBe('floor');
  }

  const spring: Course = {
    ...course,
    surfaces: [{ ...course.surfaces[0], type: 'spring' }],
  };
  const launch = stepRun(spring, newRun(spring), neutral);
  expect(launch.player.vy).toBe(15.5);
  expect(launch.player.ground).toBeNull();
  const released = stepRun(spring, launch, neutral);
  expect(released.player.vy).toBeGreaterThan(14);
});

test('a rising lift catches an airborne player and crushes against a ceiling', () => {
  const lift: Course = {
    ...course,
    surfaces: [
      { ...course.surfaces[0], type: 'lift', travel: 2 },
      {
        id: 'ceiling',
        type: 'wood',
        x: 0,
        y: 3 + BODY_HEIGHT + 0.03,
        w: 10,
        h: 1,
      },
    ],
  };
  let frame = newRun(lift);
  frame.player.ground = null;
  frame.player.y += 0.0001;
  frame = stepRun(lift, frame, neutral);
  expect(frame.player.ground).toBe('floor');
  for (let i = 0; i < 15; i++) frame = stepRun(lift, frame, neutral);
  expect(frame.player.pose).toBe('dead');
});

test('a swept saw hits between ticks and takes priority over the finish', () => {
  const lethal: Course = {
    ...course,
    goal: { x: 1.9, y: 3, w: 1, h: 1 },
    saws: [{ x: 0.9, y: 3.4, travel: 2.2, period: 4 }],
  };
  const frame = stepRun(lethal, newRun(lethal), neutral);
  expect(frame.player.pose).toBe('dead');
  const after = stepRun(lethal, frame, {
    ...neutral,
    direction: 1,
    jumpPressed: true,
    jumpHeld: true,
  });
  expect(after.player.x).toBe(frame.player.x);
  expect(after.player.pose).toBe('dead');
  const safe = { ...lethal, saws: [] };
  expect(stepRun(safe, newRun(safe), neutral).player.pose).toBe('finish');
});

test('practice presets expose the documented piece counts and distinct camera framing', () => {
  const base = courses.sparse.surfaces.length;
  expect(
    courses.course.surfaces.length + courses.course.saws.length - base,
  ).toBe(12);
  expect(courses.dense.surfaces.length + courses.dense.saws.length - base).toBe(
    25,
  );
  expect(frameRunners([{ x: 2, y: 3 }], true)).toBe(WIDE);
  expect(frameRunners([{ x: 2, y: 3 }], false).width).toBeLessThan(WIDTH);
  const shared = frameRunners(
    [
      { x: 2, y: 3 },
      { x: 29, y: 16 },
    ],
    false,
  );
  expect(shared.width).toBe(WIDTH);
  expect(shared.y).toBe(HEIGHT / 2);
});

test('a replay from the workshop entrance can reach the tower past the moving obstacles', () => {
  const route = [
    'r',
    'r',
    'r',
    'R',
    'r',
    'r',
    'r',
    'r',
    'R',
    'R',
    'R',
    'r',
    'l',
    'R',
    'L',
    'r',
    'l',
    'R',
    'r',
    'r',
    'r',
    'r',
    'R',
    'R',
    'R',
    'r',
    'r',
    'r',
    'R',
    'r',
    'r',
    'R',
    'R',
    'r',
    'l',
  ];
  let frame = newRun(courses.workshop);
  let wasHeld = false;
  for (const keys of route) {
    const jumpHeld = keys === keys.toUpperCase();
    const direction = keys.toLowerCase() === 'r' ? 1 : -1;
    for (let tick = 0; tick < 6; tick++) {
      frame = stepRun(courses.workshop, frame, {
        direction,
        sprint: true,
        jumpHeld,
        jumpPressed: tick === 0 && jumpHeld && !wasHeld,
      });
    }
    wasHeld = jumpHeld;
  }
  expect(frame.player.pose).toBe('finish');
});

test.each([30, 60, 120])(
  'the same 120 logical steps give the same replay at %i render fps',
  (fps) => {
    const input = (tick: number): Input => ({
      direction: tick < 70 ? 1 : -1,
      sprint: true,
      jumpPressed: tick === 20,
      jumpHeld: tick >= 20 && tick < 45,
    });
    let expected = newRun(course);
    let replay = newRun(course);
    for (let tick = 0; tick < 120; tick++)
      expected = stepRun(course, expected, input(tick));
    let accumulator = 0;
    for (let frame = 0; frame < fps * 2; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-9 >= STEP) {
        replay = stepRun(course, replay, input(replay.tick));
        accumulator = Math.max(0, accumulator - STEP);
      }
    }
    expect(replay).toEqual(expected);
  },
);

test('the atlas addresses every in-game slice within texture bounds', () => {
  for (const [x, y, width, height] of Object.values(atlas.frames)) {
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(x + width).toBeLessThan(atlas.size);
    expect(y + height).toBeLessThan(atlas.size);
  }
});
