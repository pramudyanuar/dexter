import {
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
} from 'three';

import { artSheets, seatsArt, spriteFrame } from './art';
import { ASPECT, frameRunners, WIDE } from './camera';
import {
  type Course,
  courses,
  SAW_RADIUS,
  WIDTH,
  WORKSHOP_PARTY_SIGN,
} from './content';
import { copy } from './copy';
import {
  at,
  FAN_RANGE,
  GADGET_DIMENSIONS,
  pistonReach,
  SWING_LENGTH,
  SWING_RADIUS,
  swingAngle,
  windup,
} from './mechanisms';
import { type Frame, type Player, STEP } from './movement';
import { partyCopy } from './party-copy';
import { makeRunner } from './rig';

const ROOT = '/games/trap-tails';
type DrawOptions = {
  runners?: { before: Player; player: Player; seat: number }[];
  collected?: Record<string, number>;
};

function labelTexture(text: string, background: string, foreground: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 132;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.moveTo(6, 7);
  ctx.lineTo(490, 0);
  ctx.lineTo(512, 52);
  ctx.lineTo(497, 122);
  ctx.lineTo(22, 132);
  ctx.lineTo(0, 88);
  ctx.closePath();
  ctx.fillStyle = background;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = foreground;
  ctx.globalAlpha = 0.32;
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 12, 478, 106);
  ctx.globalAlpha = 1;
  ctx.fillStyle = foreground;
  ctx.font = `bold ${text.length === 1 ? 104 : 67}px Georgia`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68, 448);
  return new CanvasTexture(canvas);
}

function flagTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 164;
  canvas.height = 88;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a94b3c';
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(62, -8, 94, 32, 163, 16);
  ctx.lineTo(138, 54);
  ctx.lineTo(157, 85);
  ctx.bezierCurveTo(85, 97, 46, 61, 0, 78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e7aa71';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(6, 67);
  ctx.bezierCurveTo(54, 54, 101, 83, 146, 76);
  ctx.stroke();
  return new CanvasTexture(canvas);
}

export async function makeRenderer(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
) {
  const loader = new TextureLoader();
  const images = await Promise.allSettled([
    loader.loadAsync(`${ROOT}/orchard.webp`),
    ...artSheets.map((sheet) => loader.loadAsync(sheet.file)),
  ]);
  if (signal.aborted || images.some((image) => image.status === 'rejected')) {
    for (const image of images)
      if (image.status === 'fulfilled') image.value.dispose();
    if (signal.aborted) return;
    throw new Error('Trap Tails textures could not be loaded');
  }

  const [sky, ...sheets] = images.map(
    (image) => (image as PromiseFulfilledResult<Texture>).value,
  );
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false });
  } catch (error) {
    for (const texture of [sky, ...sheets]) texture.dispose();
    throw error;
  }
  const geometry = new PlaneGeometry(1, 1);
  const textures = new Set<Texture>([sky, ...sheets]);
  const sharedMaterials = new Set<MeshBasicMaterial>();
  const stageMaterials = new Set<MeshBasicMaterial>();
  const scene = new Scene();
  scene.background = new Color('#c88f79');
  const camera = new OrthographicCamera(-16, 16, 9, -9, 0.1, 120);
  camera.position.set(WIDE.x, WIDE.y, 45);
  let framing = { ...WIDE };

  function setupTexture(texture: Texture) {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }
  for (const texture of textures) setupTexture(texture);

  const cutouts = new Map<string, Texture>();
  function art(name: string) {
    const cached = cutouts.get(name);
    if (cached) return cached;
    const { x, y, w, h, size, index } = spriteFrame(name);
    const texture = sheets[index].clone();
    texture.repeat.set(w / size, h / size);
    texture.offset.set(x / size, 1 - (y + h) / size);
    texture.needsUpdate = true;
    textures.add(texture);
    cutouts.set(name, texture);
    return texture;
  }

  const stage = new Group();
  scene.add(stage);
  function plane(
    parent: Group | Scene,
    map: Texture | null,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    tint = '#ffffff',
    opacity = 1,
  ) {
    const material = new MeshBasicMaterial({
      map,
      color: tint,
      opacity,
      transparent: Boolean(map) || opacity !== 1,
      depthWrite: !map && opacity === 1,
    });
    (parent === stage ? stageMaterials : sharedMaterials).add(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    parent.add(mesh);
    return mesh;
  }

  const backdrop = plane(scene, sky, 36.5, 20.55, WIDE.x, WIDE.y, -21);
  const cloudFar = plane(
    scene,
    art('cloud'),
    11.6,
    3.2,
    8,
    12.6,
    -17,
    '#f4ced0',
    0.37,
  );
  const cloudNear = plane(
    scene,
    art('cloud'),
    9.2,
    2.75,
    24.6,
    4.4,
    -15,
    '#d4a4a6',
    0.31,
  );
  const cloudLow = plane(
    scene,
    art('cloud'),
    15,
    4.3,
    7.3,
    0.65,
    -14,
    '#a3899a',
    0.32,
  );
  const rig = new Group();
  scene.add(rig);
  const runners = seatsArt.map(({ mark, color, tint }, seat) => {
    const fox = seat % 2 !== 0;
    const prefix = fox ? 'fox-' : '';
    const person = makeRunner(
      (name, w, h, x, y, z) =>
        plane(rig, art(prefix + name), w, h, x, y, z, tint),
      art(prefix + 'alarm'),
      fox,
    );
    rig.add(person.root);
    const label = setupTexture(labelTexture(mark, '#30343a', color));
    textures.add(label);
    const marker = plane(scene, label, 0.48, 0.32, 0, 0, 1);
    return { ...person, marker };
  });

  const flag = setupTexture(flagTexture());
  textures.add(flag);
  const directionLabel = setupTexture(
    labelTexture(copy.goalDirection, '#823b36', '#fde6b5'),
  );
  textures.add(directionLabel);
  const goalDirection = plane(scene, directionLabel, 1, 1, 0, 0, 2);
  const signs = new Map<string, Texture>();
  function sign(
    text: string,
    x: number,
    y: number,
    w: number,
    color = '#283c39',
  ) {
    let texture = signs.get(text);
    if (!texture) {
      texture = setupTexture(labelTexture(text, color, '#fde6b5'));
      signs.set(text, texture);
      textures.add(texture);
    }
    plane(stage, texture, w, w * 0.258, x, y, 0.8);
  }

  const sparks = Array.from({ length: 8 }, () =>
    plane(scene, art('cloud'), 0.32, 0.13, 0, 0, 1.1, '#f8c78e', 0),
  );
  let current: Course | undefined;
  let platforms: (Mesh | null)[] = [];
  let blades: Mesh[] = [];
  let belts: Mesh[][] = [];
  let gears: Mesh[][] = [];
  const arrows: Mesh[] = [];
  let pennant: Mesh | undefined;
  let width = 0;
  let height = 0;

  function changeCourse(course: Course) {
    current = course;
    stage.clear();
    for (const material of stageMaterials) material.dispose();
    stageMaterials.clear();
    framing = { ...WIDE };

    const start = course.surfaces[0];
    plane(
      stage,
      art('station'),
      start.w * 1.02,
      3.32,
      start.x + start.w / 2,
      1.21,
      -2.8,
    );
    const towerY = course.goal.y;
    const towerFoot = towerY - 0.4;
    const towerX = Math.min(WIDTH - 2.56, course.goal.x + 0.66);
    plane(stage, art('towerTop'), 5.12, 5.92, towerX, towerFoot + 2.96, -2.8);
    plane(
      stage,
      art('towerBase'),
      5.12,
      towerFoot + 0.25,
      towerX,
      (towerFoot - 0.25) / 2,
      -2.8,
    );
    const flagX = Math.min(WIDTH - 1.75, course.goal.x + 2.03);
    const flagY = towerY + 4.05;
    plane(stage, art('iron'), 0.09, 1.68, flagX, flagY - 0.34, -0.9);
    pennant = plane(stage, flag, 1.55, 0.91, flagX + 0.72, flagY + 0.1, -0.65);
    sign(copy.start, start.x + 0.64, start.y + start.h + 0.56, 1.05);
    sign(copy.finish, course.goal.x + 0.57, towerY + 1.8, 1.6, '#823b36');
    if (course === courses.workshop) {
      sign(partyCopy.gate, WORKSHOP_PARTY_SIGN.x, WORKSHOP_PARTY_SIGN.y, 1.55);
      sign(copy.sprintMarker, 6.6, 2.17, 2.58);
      sign(copy.wallSign, 13.67, 7.26, 2.4, '#584355');
      for (let i = 0; i < 5; i++) {
        plane(
          stage,
          null,
          0.032,
          i === 0 || i === 4 ? 0.3 : 0.14,
          4.6 + i * 0.69,
          3.15,
          0.5,
          '#e8d8ac',
          0.77,
        );
      }
    }

    platforms = course.surfaces.map((s) => {
      if (s.type === 'housing') return null;
      const x = s.x + s.w / 2;
      const y = s.y + s.h / 2;
      if (s.type === 'iron') {
        const count = Math.max(1, Math.round(s.h / s.w));
        for (let i = 1; i < count; i++) {
          plane(
            stage,
            art('iron'),
            s.w,
            s.h / count,
            x,
            s.y + ((i + 0.5) * s.h) / count,
            -1.5,
          );
        }
        return plane(
          stage,
          art('iron'),
          s.w,
          s.h / count,
          x,
          s.y + s.h / count / 2,
          -1.5,
        );
      }
      if (s.travel) {
        for (const railX of [s.x + 0.22, s.x + s.w - 0.22]) {
          plane(
            stage,
            art('iron'),
            0.115,
            s.travel + 0.55,
            railX,
            y + s.travel / 2,
            -1.8,
          );
        }
      }
      const turn = s.turn ?? 0;
      const rotated = turn % 2 === 1;
      const board = plane(
        stage,
        art(
          s.type === 'conveyor'
            ? 'belt'
            : s.type === 'spring'
              ? 'spring'
              : 'wood',
        ),
        rotated ? s.h : s.w,
        rotated ? s.w : s.h,
        x,
        y,
        -1.05,
        s.type === 'ledge' ? '#9ea8a3' : '#ffffff',
      );
      if (s.type !== 'conveyor') board.rotation.z = (turn * Math.PI) / 2;
      return board;
    });
    belts = course.surfaces.map((s) =>
      s.type === 'conveyor'
        ? Array.from({ length: Math.floor((s.w - 0.35) / 0.37) + 1 }, () =>
            plane(
              stage,
              null,
              0.035,
              0.06,
              s.x,
              s.y + s.h - 0.055,
              -0.85,
              '#e9b675',
              0.65,
            ),
          )
        : [],
    );
    blades = course.saws.map((s) => {
      if (s.travel) {
        const rail = plane(
          stage,
          art('wood'),
          s.travel * 2 + 0.35,
          0.17,
          s.x,
          s.y,
          -1.8,
          '#ab9ba7',
        );
        if (s.vertical) rail.rotation.z = Math.PI / 2;
        for (const end of [-1, 1]) {
          plane(
            stage,
            art('iron'),
            0.28,
            0.28,
            s.x + (s.vertical ? 0 : end * s.travel),
            s.y + (s.vertical ? end * s.travel : 0),
            -1.7,
          );
        }
      }
      return plane(
        stage,
        art('saw'),
        SAW_RADIUS * 2,
        SAW_RADIUS * 2,
        s.x,
        s.y,
        -1.4,
      );
    });
    gears = (course.gadgets ?? []).map((g) => {
      const [w, h] = GADGET_DIMENSIONS[g.kind];
      const base = plane(stage, art(g.kind), w, h, g.x, g.y, -0.86);
      if (g.kind === 'piston' || g.kind === 'swing') {
        return [
          base,
          plane(stage, art(g.kind + '-rod'), 1, 0.25, g.x, g.y, -0.94),
          plane(stage, art(g.kind + '-head'), 0.6, 0.58, g.x, g.y, -0.82),
        ];
      }
      if (g.kind === 'fan')
        return [
          base,
          ...Array.from({ length: 5 }, () =>
            plane(
              stage,
              art('cloud'),
              0.42,
              0.12,
              g.x,
              g.y,
              -0.62,
              '#dee8cf',
              0.64,
            ),
          ),
        ];
      return [base];
    });
  }

  function draw(
    course: Course,
    before: Frame,
    next: Frame,
    alpha: number,
    dt: number,
    fixed: boolean,
    reduced: boolean,
    options: DrawOptions = {},
  ) {
    if (current !== course) changeCourse(course);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h && (w !== width || h !== height)) {
      width = w;
      height = h;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(w, h, false);
    }
    const p = next.player;
    const time = MathUtils.lerp(before.tick, next.tick, alpha) * STEP;
    const x = MathUtils.lerp(before.player.x, p.x, alpha);
    const y = MathUtils.lerp(before.player.y, p.y, alpha);
    const views = (
      options.runners ?? [{ before: before.player, player: p, seat: 0 }]
    ).map((r) => ({
      ...r,
      x: MathUtils.lerp(r.before.x, r.player.x, alpha),
      y: MathUtils.lerp(r.before.y, r.player.y, alpha),
    }));
    const live = views.filter(
      (r) =>
        (r.player.pose !== 'dead' &&
          (r.player.pose !== 'finish' || r.player.age < 30)) ||
        r.player.age < 30,
    );
    const target = frameRunners(
      live.length ? live : views,
      fixed || reduced || next.tick < 30,
    );
    const ease = fixed || reduced ? 1 : 1 - Math.exp(-11 * dt);
    framing.x = MathUtils.lerp(framing.x, target.x, ease);
    framing.y = MathUtils.lerp(framing.y, target.y, ease);
    framing.width = MathUtils.lerp(framing.width, target.width, ease);
    camera.position.set(framing.x, framing.y, 45);
    camera.left = -framing.width / 2;
    camera.right = framing.width / 2;
    camera.top = framing.width / ASPECT / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    const edge = framing.x + camera.right;
    goalDirection.visible = course.goal.x > edge - 0.25;
    goalDirection.scale.set(framing.width * 0.075, framing.width * 0.018, 1);
    goalDirection.position.set(
      edge - framing.width * 0.067,
      framing.y + camera.top * 0.49,
      2,
    );

    const pan = (factor: number) => (framing.x - WIDE.x) * (1 - factor);
    backdrop.position.x = WIDE.x + pan(0.1);
    backdrop.position.y = WIDE.y + (framing.y - WIDE.y) * 0.75;
    cloudFar.position.x = 8 + pan(0.25);
    cloudNear.position.x = 24.6 + pan(0.5);
    cloudLow.position.x = 7.3 + pan(0.5);
    if (pennant) pennant.rotation.z = reduced ? 0 : Math.sin(time * 4) * 0.09;
    next.layout.surfaces.forEach((s, i) => {
      const platform = platforms[i];
      if (s.travel && platform)
        platform.position.y =
          MathUtils.lerp(before.layout.surfaces[i].y, s.y, alpha) + s.h / 2;
      belts[i].forEach((marker, j) => {
        marker.position.x =
          s.x +
          0.18 +
          ((j * 0.37 + time * 2.2) % (s.w - 0.36)) * (s.belt === -1 ? -1 : 1) +
          (s.belt === -1 ? s.w - 0.36 : 0);
      });
    });
    next.layout.saws.forEach((s, i) => {
      blades[i].position.x = MathUtils.lerp(
        before.layout.saws[i].x,
        s.x,
        alpha,
      );
      blades[i].rotation.z = reduced ? 0 : -time * 9.5;
      blades[i].position.y = MathUtils.lerp(
        before.layout.saws[i].y,
        s.y,
        alpha,
      );
    });
    const tick = time / STEP;
    next.layout.gadgets.forEach((g, i) => {
      const [base, ...extra] = gears[i];
      const old = before.layout.gadgets[i];
      const point = {
        x: MathUtils.lerp(old.x, g.x, alpha),
        y: MathUtils.lerp(old.y, g.y, alpha),
      };
      base.position.x = point.x;
      base.position.y = point.y;
      const angle = (g.turn * Math.PI) / 2;
      base.rotation.z = angle;
      if (g.kind === 'coin') {
        base.visible = options.collected?.[g.id] === undefined;
        base.scale.x =
          0.5 * (reduced ? 1 : 0.25 + Math.abs(Math.sin(time * 6)) * 0.75);
      }
      if (g.kind === 'arrow' || g.kind === 'piston') {
        const material = base.material as MeshBasicMaterial;
        material.color.set(windup(g, next.tick) ? '#ffd39a' : '#ffffff');
      }
      if (g.kind === 'piston') {
        const reach = MathUtils.lerp(
          pistonReach(before.tick),
          pistonReach(next.tick),
          alpha,
        );
        const [rod, head] = extra;
        const mid = at(point, 0.55 + reach / 2, 0, g.turn);
        rod.position.set(mid.x, mid.y, -0.94);
        rod.rotation.z = angle;
        rod.scale.x = Math.max(0.04, reach + 0.15);
        const pad = at(point, 0.64 + reach, 0, g.turn);
        head.position.set(pad.x, pad.y, -0.82);
        head.scale.set(0.38, 0.64, 1);
        head.rotation.z = angle;
      }
      if (g.kind === 'swing') {
        const [rod, head] = extra;
        const theta = swingAngle(g, tick);
        const dx = Math.cos(theta) * SWING_LENGTH;
        const dy = Math.sin(theta) * SWING_LENGTH;
        rod.position.set(point.x + dx / 2, point.y + dy / 2, -0.94);
        rod.rotation.z = theta;
        rod.scale.x = SWING_LENGTH;
        head.position.set(point.x + dx, point.y + dy, -0.82);
        head.rotation.z = theta;
        head.scale.set(SWING_RADIUS * 2, SWING_RADIUS * 2, 1);
      }
      if (g.kind === 'fan') {
        extra.forEach((wind, i) => {
          wind.visible = !reduced;
          const distance =
            0.55 + ((i * 0.93 + time * 3.7) % (FAN_RANGE - 0.55));
          const offset = (i % 2 ? 1 : -1) * (0.18 + distance * 0.16);
          const gust = at(point, distance, offset, g.turn);
          wind.position.set(gust.x, gust.y, -0.62);
          wind.rotation.z = angle;
          (wind.material as MeshBasicMaterial).opacity =
            (1 - distance / (FAN_RANGE + 0.3)) * 0.78;
        });
      }
    });
    next.layout.bolts.forEach((bolt, i) => {
      const mesh =
        arrows[i] ?? plane(scene, art('bolt'), 0.43, 0.16, 0, 0, -0.55);
      arrows[i] = mesh;
      mesh.visible = !bolt.stopped;
      mesh.rotation.z = (bolt.turn * Math.PI) / 2;
      mesh.position.set(
        MathUtils.lerp(bolt.from.x, bolt.x, alpha),
        MathUtils.lerp(bolt.from.y, bolt.y, alpha),
        -0.55,
      );
    });
    for (let i = next.layout.bolts.length; i < arrows.length; i++)
      arrows[i].visible = false;
    runners.forEach((r) => {
      r.root.visible = false;
      r.marker.visible = false;
    });
    for (const view of views) {
      const runner = runners[view.seat];
      runner.update(view.player, view.x, view.y, time, dt, reduced);
      runner.marker.visible = Boolean(options.runners) && runner.root.visible;
      runner.marker.position.set(view.x, view.y + 1.52, 1);
    }
    const impact =
      !reduced && (p.pose === 'land' || p.pose === 'dead' || p.pose === 'kick');
    sparks.forEach((spark, i) => {
      const progress = Math.min(1, p.age / (p.pose === 'dead' ? 36 : 7));
      (spark.material as MeshBasicMaterial).opacity = impact
        ? (1 - progress) * 0.76
        : 0;
      spark.visible = impact && progress < 1;
      const angle = (i * Math.PI) / 4;
      spark.position.x = x + Math.cos(angle) * (0.17 + progress * 0.62);
      spark.position.y = y + Math.sin(angle) * (0.05 + progress * 0.32);
    });
    renderer.render(scene, camera);
  }

  return {
    draw,
    dispose() {
      geometry.dispose();
      for (const material of [...stageMaterials, ...sharedMaterials])
        material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
