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

import atlas from './atlas.json';
import { ASPECT, frameRunners, WIDE } from './camera';
import { type Course, courses, SAW_RADIUS, WIDTH } from './content';
import { copy } from './copy';
import { type Frame, STEP } from './movement';
import { makeMiso } from './rig';

const ROOT = '/games/trap-tails';
type Art = keyof typeof atlas.frames;

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
  ctx.font = 'bold 67px Georgia';
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
    loader.loadAsync(`${ROOT}/cutouts.webp`),
  ]);
  const [sky, sheet] = images;
  if (
    signal.aborted ||
    sky.status === 'rejected' ||
    sheet.status === 'rejected'
  ) {
    for (const image of images)
      if (image.status === 'fulfilled') image.value.dispose();
    if (signal.aborted) return;
    throw new Error('Trap Tails textures could not be loaded');
  }

  const atlasTexture = sheet.value;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: false, antialias: false });
  } catch (error) {
    sky.value.dispose();
    atlasTexture.dispose();
    throw error;
  }
  const geometry = new PlaneGeometry(1, 1);
  const textures = new Set<Texture>([sky.value, atlasTexture]);
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
  setupTexture(sky.value);
  setupTexture(atlasTexture);

  const cutouts = new Map<Art, Texture>();
  function art(name: Art) {
    const cached = cutouts.get(name);
    if (cached) return cached;
    const [x, y, w, h] = atlas.frames[name];
    const { size } = atlas;
    const texture = atlasTexture.clone();
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

  const backdrop = plane(scene, sky.value, 36.5, 20.55, WIDE.x, WIDE.y, -21);
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
  const miso = makeMiso(
    (name, w, h, x, y, z) => plane(rig, art(name), w, h, x, y, z),
    art('alarm'),
  );
  rig.add(miso.root);

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
  let platforms: Mesh[] = [];
  let blades: Mesh[] = [];
  let belts: Mesh[][] = [];
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
      return plane(
        stage,
        art(
          s.type === 'conveyor'
            ? 'belt'
            : s.type === 'spring'
              ? 'spring'
              : 'wood',
        ),
        s.w,
        s.h,
        x,
        y,
        -1.05,
        s.type === 'ledge' ? '#9ea8a3' : '#ffffff',
      );
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
        plane(
          stage,
          art('wood'),
          s.travel * 2 + 0.35,
          0.17,
          s.x,
          s.y,
          -1.8,
          '#ab9ba7',
        );
        for (const end of [-1, 1]) {
          plane(
            stage,
            art('iron'),
            0.28,
            0.28,
            s.x + end * s.travel,
            s.y,
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
  }

  function draw(
    course: Course,
    before: Frame,
    next: Frame,
    alpha: number,
    dt: number,
    fixed: boolean,
    reduced: boolean,
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
    const target = frameRunners([{ x, y }], fixed || reduced || next.tick < 30);
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
      if (s.travel)
        platforms[i].position.y =
          MathUtils.lerp(before.layout.surfaces[i].y, s.y, alpha) + s.h / 2;
      belts[i].forEach((marker, j) => {
        marker.position.x =
          s.x + 0.18 + ((j * 0.37 + time * 2.2) % (s.w - 0.36));
      });
    });
    next.layout.saws.forEach((s, i) => {
      blades[i].position.x = MathUtils.lerp(
        before.layout.saws[i].x,
        s.x,
        alpha,
      );
      blades[i].rotation.z = reduced ? 0 : -time * 9.5;
    });
    miso.update(p, x, y, time, dt, reduced);
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
