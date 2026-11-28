import { Group, MathUtils, Mesh, Texture } from 'three';

import type { Player, Pose } from './movement';

export type Cutout = (
  name: 'head' | 'alarm' | 'arm' | 'leg' | 'tail' | 'torso',
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
) => Mesh;

type Joint = { group: Group; rest: number };
type Stance = {
  lean: number;
  frontArm: number;
  backArm: number;
  frontLeg: number;
  backLeg: number;
  tail: number;
  stretch: number;
  alarm?: boolean;
};

const still: Stance = {
  lean: 0,
  frontArm: 0,
  backArm: 0,
  frontLeg: 0,
  backLeg: 0,
  tail: 0,
  stretch: 1,
};

const stances: Partial<Record<Pose, Stance>> = {
  rise: {
    lean: -0.13,
    frontArm: 1.95,
    backArm: -0.6,
    frontLeg: 0.82,
    backLeg: -0.48,
    tail: 0.35,
    stretch: 1.1,
  },
  apex: {
    lean: -0.04,
    frontArm: 1.55,
    backArm: -1.05,
    frontLeg: 0.96,
    backLeg: -0.6,
    tail: 0.21,
    stretch: 0.93,
  },
  fall: {
    lean: 0.12,
    frontArm: 2.2,
    backArm: -1.35,
    frontLeg: 0.46,
    backLeg: -0.39,
    tail: -0.52,
    stretch: 1.05,
    alarm: true,
  },
  wall: {
    lean: -0.18,
    frontArm: 2.3,
    backArm: 1.5,
    frontLeg: 0.85,
    backLeg: 0.4,
    tail: 0.28,
    stretch: 0.94,
  },
  kick: {
    lean: -0.36,
    frontArm: 1.34,
    backArm: -0.9,
    frontLeg: 0.94,
    backLeg: -1.05,
    tail: 0.36,
    stretch: 1.05,
  },
  land: {
    lean: -0.21,
    frontArm: 1.25,
    backArm: -0.5,
    frontLeg: 0.42,
    backLeg: -0.42,
    tail: -0.37,
    stretch: 0.75,
  },
  dead: {
    lean: 0.15,
    frontArm: 1.5,
    backArm: -1.4,
    frontLeg: 0.65,
    backLeg: -0.6,
    tail: -0.42,
    stretch: 0.92,
    alarm: true,
  },
  finish: {
    lean: 0,
    frontArm: 2.42,
    backArm: -2.42,
    frontLeg: 0.24,
    backLeg: -0.3,
    tail: -0.15,
    stretch: 1.04,
  },
};

function joint(root: Group, mesh: Mesh, x: number, y: number): Joint {
  const group = new Group();
  group.position.set(x, y, 0);
  group.add(mesh);
  root.add(group);
  return { group, rest: y };
}

export function makeRunner(cutout: Cutout, alarm: Texture, fox = false) {
  const body = new Group();
  const tail = joint(
    body,
    cutout('tail', fox ? 0.78 : 0.64, 0.51, fox ? -0.34 : -0.27, 0.13, 0.01),
    -0.16,
    0.39,
  );
  const farLeg = joint(
    body,
    cutout('leg', 0.176, 0.29, 0.025, -0.125, 0.02),
    -0.105,
    0.28,
  );
  const farArm = joint(
    body,
    cutout('arm', 0.142, 0.28, 0, -0.1, 0.03),
    0.12,
    0.66,
  );
  body.add(cutout('torso', fox ? 0.42 : 0.49, 0.59, -0.018, 0.54, 0.04));
  const nearLeg = joint(
    body,
    cutout('leg', 0.19, 0.31, 0.026, -0.135, 0.05),
    0.095,
    0.29,
  );
  const nearArm = joint(
    body,
    cutout('arm', 0.153, 0.3, 0, -0.105, 0.06),
    -0.14,
    0.63,
  );
  const head = cutout(
    'head',
    fox ? 0.56 : 0.71,
    fox ? 0.72 : 0.6,
    0.11,
    fox ? 0.99 : 0.96,
    0.07,
  );
  body.add(head);
  const headMaterial = head.material as import('three').MeshBasicMaterial;
  const happy = headMaterial.map;
  const root = new Group();
  root.add(body);
  let stride = 0;

  function update(
    p: Player,
    x: number,
    y: number,
    time: number,
    dt: number,
    reduced: boolean,
  ) {
    const terminal = p.pose === 'dead' || p.pose === 'finish';
    const age = (p.age + 1) / 60;
    const running = p.pose === 'run' || p.pose === 'sprint';
    if (running) stride += dt * (p.pose === 'sprint' ? 21 : 16);
    else stride = 0;
    const swing = Math.sin(stride) * (p.pose === 'sprint' ? 1.02 : 0.78);
    const stance = running
      ? {
          ...still,
          lean: p.pose === 'sprint' ? -0.28 : -0.16,
          frontArm: -swing * 0.73,
          backArm: swing * 0.77,
          frontLeg: swing,
          backLeg: -swing,
          tail: 0.14 - Math.cos(stride) * 0.15,
        }
      : (stances[p.pose] ?? still);
    const settle = 1 - Math.exp(-26 * dt);
    const turn = (part: Joint, angle: number) => {
      part.group.rotation.z = MathUtils.lerp(
        part.group.rotation.z,
        angle,
        settle,
      );
    };
    turn(tail, stance.tail + (!reduced ? Math.sin(time * 5) * 0.09 : 0));
    turn(nearArm, stance.frontArm);
    turn(farArm, stance.backArm);
    turn(nearLeg, stance.frontLeg);
    turn(farLeg, stance.backLeg);
    nearLeg.group.position.y = nearLeg.rest - Math.max(0, -swing) * 0.04;
    farLeg.group.position.y = farLeg.rest - Math.max(0, swing) * 0.04;
    head.rotation.z = -stance.lean * 0.5;
    headMaterial.map = stance.alarm ? alarm : happy;
    const hop =
      p.pose === 'finish' && !reduced ? Math.abs(Math.sin(age * 9)) * 0.28 : 0;
    const tumble = p.pose === 'dead' && !reduced ? Math.min(age * 6, 3.6) : 0;
    body.position.y =
      hop - (p.pose === 'dead' ? Math.min(age * age * 4, 4) : 0);
    const breathing =
      p.pose === 'idle' && !reduced ? Math.sin(time * 4) * 0.018 : 0;
    body.scale.set(
      1 + (1 - stance.stretch) * 0.57,
      stance.stretch + breathing,
      1,
    );
    body.rotation.z = MathUtils.lerp(
      body.rotation.z,
      stance.lean - tumble,
      settle,
    );
    root.scale.x = p.facing;
    root.visible = !terminal || p.pose === 'finish' || age < 0.75 || reduced;
    root.position.set(x, y, 0);
  }

  return { root, update };
}
