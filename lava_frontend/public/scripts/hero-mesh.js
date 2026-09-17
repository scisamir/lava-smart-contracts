/*
 * The hero: the Lava mark extruded into 3D, rendered with a molten matcap and
 * rippled by the pointer. Scrolling drives a single progress value. The mark
 * boils, whirls and bursts into a drifting field of smaller marks, ADA coins and
 * embers, which carries the eye into the first section. Draws on a transparent
 * canvas so it sits on the page background rather than carrying its own.
 */
import * as THREE from 'three';
import {
  Fn, positionLocal, normalLocal, positionGeometry,
  uniformArray, uniform, Loop, int, float, vec3,
  length, exp, cos, sin, normalize, transformNormalToView,
} from 'three/tsl';

import { LADA_PIXELS } from './lada-mark.js';

const CELL = 0.13;          // width of one logo pixel, in world units
const DEPTH = 0.42;         // extrusion depth
const IMPULSES = 12;        // concurrent pointer ripples
const WOBBLE = 0.07;        // ripple displacement, in world units
const SWELL = 0.03;         // idle surface swell, in world units
const EPS = 0.04;           // finite-difference step for the deformed normals

const MARK = 1.95;          // the mark is 15 cells square
const MARK_SHARE = 0.46;    // share of viewport height it should occupy
const MARK_CENTRE = 0.5;    // where its centre sits, measured from the top

const COIN_R = 0.5;         // coin radius
const COIN_T = 0.16;        // coin thickness
const RELIEF = 0.042;       // how far the Cardano dots stand off the face

const BLOBS = 9;
const COINS = 11;
const EMBERS = 26;

/*
 * Scroll windows, as a share of the hero's scroll height. The burst finishes
 * before the next section starts covering the stage, so it plays out in full.
 */
const MELT = [0.05, 0.34];
const BURST = [0.08, 0.44];
const FADE = [0.72, 0.95];

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const range = (n, [a, b]) => clamp01((n - a) / (b - a));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/* Overshoots slightly, so each piece pops rather than easing limply into place. */
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.44 * (t - 1) ** 2;

/* Deterministic, so a layout that looks right stays that way across reloads. */
function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/*
 * Extrudes a pixel grid into raw triangles, centred on the origin and skipping
 * the faces between adjacent pixels so the result is a single solid.
 */
function extrudePixels(rows, cell, depth, zCentre = 0) {
  const front = zCentre + depth / 2;
  const back = zCentre - depth / 2;
  const vertices = [];

  const filled = (row, col) =>
    row >= 0 && row < rows.length &&
    col >= 0 && col < rows[row].length &&
    rows[row][col] === '#';

  const quad = (a, b, c, d) => vertices.push(...a, ...b, ...c, ...a, ...c, ...d);

  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < rows[row].length; col++) {
      if (!filled(row, col)) continue;

      const x0 = (col - rows[row].length / 2) * cell, x1 = x0 + cell;
      const y0 = (rows.length / 2 - row - 1) * cell, y1 = y0 + cell;

      quad([x0, y0, front], [x1, y0, front], [x1, y1, front], [x0, y1, front]);
      quad([x0, y1, back], [x1, y1, back], [x1, y0, back], [x0, y0, back]);

      if (!filled(row, col - 1)) quad([x0, y0, back], [x0, y0, front], [x0, y1, front], [x0, y1, back]);
      if (!filled(row, col + 1)) quad([x1, y0, front], [x1, y0, back], [x1, y1, back], [x1, y1, front]);
      if (!filled(row - 1, col)) quad([x0, y1, front], [x1, y1, front], [x1, y1, back], [x0, y1, back]);
      if (!filled(row + 1, col)) quad([x0, y0, back], [x1, y0, back], [x1, y0, front], [x0, y0, front]);
    }
  }
  return vertices;
}

function geometryFrom(vertices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildCoinGeometry() {
  const geometry = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T, 48);
  geometry.rotateX(Math.PI / 2);   // stand it up, so the faces point down +z
  return geometry;
}

function mergeGeometries(geos) {
  const vertices = [];
  for (const geo of geos) {
    const pos = geo.attributes.position;
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        const v = idx.getX(i);
        vertices.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        vertices.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    geo.dispose();
  }
  return geometryFrom(vertices);
}

/*
 * Official Cardano mark: empty centre, then four hexagonal rings of dots.
 * 6 large, 6 medium (offset), 6 small (aligned), 12 outer: 30 dots in all.
 */
function cardanoDots(scale) {
  const rings = [
    { radius: 0.24, count: 6,  size: 0.078, offset: -Math.PI / 2 },
    { radius: 0.43, count: 6,  size: 0.056, offset: -Math.PI / 2 + Math.PI / 6 },
    { radius: 0.60, count: 6,  size: 0.040, offset: -Math.PI / 2 },
    { radius: 0.74, count: 12, size: 0.028, offset: -Math.PI / 2 },
  ];
  const dots = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = ring.offset + (i / ring.count) * Math.PI * 2;
      dots.push({
        x: Math.cos(a) * ring.radius * scale,
        y: Math.sin(a) * ring.radius * scale,
        r: ring.size * scale,
      });
    }
  }
  return dots;
}

/* Both faces, so the mark reads from either side of a tumbling coin. */
function buildAdaReliefGeometry() {
  const lift = COIN_T / 2 + RELIEF / 2 - 0.003;
  const pieces = [];

  for (const { x, y, r } of cardanoDots(COIN_R * 0.86)) {
    for (const z of [lift, -lift]) {
      const dot = new THREE.CylinderGeometry(r, r, RELIEF, 14);
      dot.rotateX(Math.PI / 2);
      dot.translate(x, y, z);
      pieces.push(dot);
    }
  }

  return mergeGeometries(pieces);
}

/*
 * Paints a matcap: a lit sphere baked into a texture, looked up by view-space
 * normal. Dark body, coloured key light, hot rim at grazing angles.
 */
function buildMatcap(palette, size = 512) {
  const { body, mid, rim: rimColor, spark, cool } = palette;

  const unit = (v) => { const l = Math.hypot(...v); return v.map((n) => n / l); };
  const key = unit([-0.42, 0.55, 0.72]);
  const fill = unit([0.75, -0.2, 0.5]);
  const mix = (a, b, t) => a.map((n, i) => n + (b[i] - n) * t);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let nx = (x / (size - 1)) * 2 - 1;
      let ny = 1 - (y / (size - 1)) * 2;

      // Outside the disc there is no sphere to sample, so clamp to its silhouette.
      if (nx * nx + ny * ny > 1) {
        const a = Math.atan2(ny, nx);
        nx = Math.cos(a) * 0.999;
        ny = Math.sin(a) * 0.999;
      }
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

      const kd = Math.max(0, nx * key[0] + ny * key[1] + nz * key[2]);
      const fd = Math.max(0, nx * fill[0] + ny * fill[1] + nz * fill[2]);
      const rim = (1 - nz) ** 3.2;
      const spec = kd ** 42;

      let c = mix(body, mid, kd ** 0.9);
      c = c.map((n, i) => n + rimColor[i] * rim * 0.9);
      c = c.map((n, i) => n + cool[i] * fd * 0.22);
      c = c.map((n, i) => n + spark[i] * spec * 0.85);

      const i = (y * size + x) * 4;
      data[i] = Math.min(255, c[0] * 255);
      data[i + 1] = Math.min(255, c[1] * 255);
      data[i + 2] = Math.min(255, c[2] * 255);
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const MOLTEN = {
  body: [0.055, 0.05, 0.06], mid: [0.46, 0.13, 0.07], rim: [1.0, 0.36, 0.13],
  spark: [1.0, 0.85, 0.68], cool: [0.16, 0.19, 0.30],
};
const ADA_BLUE = {
  body: [0.01, 0.10, 0.48], mid: [0.08, 0.28, 0.88], rim: [0.45, 0.70, 1.0],
  spark: [0.92, 0.97, 1.0], cool: [0.12, 0.22, 0.55],
};
const ADA_DOT = {
  body: [0.82, 0.88, 0.96], mid: [0.96, 0.98, 1.0], rim: [1.0, 1.0, 1.0],
  spark: [1.0, 1.0, 1.0], cool: [0.70, 0.80, 0.95],
};
const SPARK = {
  body: [0.32, 0.08, 0.03], mid: [1.0, 0.44, 0.13], rim: [1.0, 0.78, 0.42],
  spark: [1.0, 1.0, 0.92], cool: [0.3, 0.12, 0.06],
};

/* Where each piece of the burst travels to, and how it tumbles on the way. */
function layout(count, seed, opts) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (r() - 0.5) * 0.8,
    radius: opts.minR + r() * (opts.maxR - opts.minR),
    squash: 0.78 + r() * 0.34,
    z: (r() * 2 - 1) * opts.depth,
    scale: opts.minScale + r() * (opts.maxScale - opts.minScale),
    delay: r() * 0.5,
    axis: new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize(),
    spin: (0.3 + r() * 0.8) * (r() > 0.5 ? 1 : -1),
    phase: r() * Math.PI * 2,
    bob: 0.35 + r() * 0.55,
  }));
}

export async function initHeroMesh(canvas) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const moltenMatcap = buildMatcap(MOLTEN);
  const markGeometry = geometryFrom(extrudePixels(LADA_PIXELS, CELL, DEPTH));

  const material = new THREE.MeshMatcapNodeMaterial({ matcap: moltenMatcap });
  const logo = new THREE.Mesh(markGeometry, material);
  scene.add(logo);

  // Each impulse is a ripple expanding from where the pointer crossed the mesh.
  const impulsePos = Array.from({ length: IMPULSES }, () => new THREE.Vector3());
  const impulseAge = new Array(IMPULSES).fill(1e3);
  const impulseStr = new Array(IMPULSES).fill(0);

  const uPos = uniformArray(impulsePos);
  const uAge = uniformArray(impulseAge);
  const uStr = uniformArray(impulseStr);
  const uWobble = uniform(WOBBLE);

  const ripple = Fn(([p]) => {
    const sum = float(0).toVar();
    Loop({ start: int(0), end: int(IMPULSES), type: 'int' }, ({ i }) => {
      const age = uAge.element(i);
      const strength = uStr.element(i);
      const origin = uPos.element(i);

      const dist = length(p.sub(origin));
      const front = dist.sub(age.mul(0.4));          // ring travelling outwards
      const band = exp(front.mul(front).mul(-6));    // only near the ring
      const wave = cos(dist.mul(9).sub(age.mul(11)));
      const decay = exp(age.mul(-2.6));

      sum.addAssign(wave.mul(band).mul(decay).mul(strength));
    });
    return sum;
  });

  /*
   * A flat extrusion gives every front-facing pixel the same normal, so without
   * this the face would shade as one dead slab. The swell keeps it molten, and
   * uMelt drives it up into a full boil just before the mark comes apart.
   */
  const uTime = uniform(0);
  const uMelt = uniform(0);
  const swell = (p) => sin(p.x.mul(2.6).add(uTime.mul(0.8)))
    .mul(sin(p.y.mul(2.2).sub(uTime.mul(0.6))))
    .mul(float(SWELL).mul(uMelt.mul(7).add(1)));

  const displace = (p) => ripple(p).mul(uWobble).add(swell(p));
  const radial = normalize(positionGeometry);
  material.positionNode = positionLocal.add(radial.mul(displace(positionGeometry)));

  // The displacement happens on the GPU, so re-derive normals from its gradient.
  material.normalNode = Fn(() => {
    const p = positionGeometry;
    const dx = displace(p.add(vec3(EPS, 0, 0))).sub(displace(p.add(vec3(-EPS, 0, 0))));
    const dy = displace(p.add(vec3(0, EPS, 0))).sub(displace(p.add(vec3(0, -EPS, 0))));
    const dz = displace(p.add(vec3(0, 0, EPS))).sub(displace(p.add(vec3(0, 0, -EPS))));
    const gradient = vec3(dx, dy, dz).mul(float(1 / (2 * EPS)));
    return transformNormalToView(normalize(normalLocal.sub(gradient.mul(0.7))));
  })();

  /* ---------------------------------------------------------------- *
   * The burst: mini marks, ADA coins and embers, all instanced.
   * ---------------------------------------------------------------- */
  const swarmMat = (matcap) => new THREE.MeshMatcapNodeMaterial({
    matcap, transparent: true, opacity: 1,
  });

  const blobMesh = new THREE.InstancedMesh(markGeometry, swarmMat(moltenMatcap), BLOBS);
  const coinMesh = new THREE.InstancedMesh(buildCoinGeometry(), swarmMat(buildMatcap(ADA_BLUE)), COINS);
  const reliefMesh = new THREE.InstancedMesh(buildAdaReliefGeometry(), swarmMat(buildMatcap(ADA_DOT)), COINS);
  const emberMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), swarmMat(buildMatcap(SPARK)), EMBERS);

  const swarm = [blobMesh, coinMesh, reliefMesh, emberMesh];
  swarm.forEach((mesh) => {
    // Instances are placed far outside the base geometry's bounds.
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
  });

  const blobs = layout(BLOBS, 11, { minR: 0.30, maxR: 0.72, depth: 1.1, minScale: 0.16, maxScale: 0.34 });
  const coins = layout(COINS, 29, { minR: 0.26, maxR: 0.78, depth: 1.3, minScale: 0.55, maxScale: 1.05 });
  const embers = layout(EMBERS, 47, { minR: 0.18, maxR: 0.95, depth: 1.8, minScale: 0.35, maxScale: 1.1 });

  const mtx = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  let visibleHeight = MARK / MARK_SHARE;

  function placeSwarm(progress, elapsed) {
    const burst = range(progress, BURST);
    const drift = range(progress, [BURST[1], 1]);
    const opacity = 1 - range(progress, FADE);
    const live = burst > 0.001 && opacity > 0.001;

    swarm.forEach((mesh) => {
      mesh.visible = live;
      mesh.material.opacity = opacity;
    });
    if (!live) return;

    const halfH = visibleHeight / 2;
    const halfW = halfH * camera.aspect;
    const baseY = logo.position.y;
    const spread = 1 + drift * 0.24;
    const rise = drift * halfH * 0.12;

    const write = (mesh, parts, twin) => {
      parts.forEach((part, i) => {
        // Staggered starts, but every piece still lands as the window closes.
        const t = clamp01((burst - part.delay * 0.45) / (1 - part.delay * 0.45));
        const reach = easeOut(t) * spread;
        const wander = t * 0.09;

        pos.set(
          Math.cos(part.angle) * part.radius * halfW * reach
            + Math.sin(elapsed * part.bob + part.phase) * wander,
          baseY + Math.sin(part.angle) * part.radius * part.squash * halfH * reach
            + Math.cos(elapsed * part.bob * 0.8 + part.phase) * wander + rise * t,
          part.z * reach,
        );

        quat.setFromAxisAngle(part.axis, elapsed * part.spin + part.phase);
        scl.setScalar(Math.max(0, part.scale * easeOutBack(t)));

        mtx.compose(pos, quat, scl);
        mesh.setMatrixAt(i, mtx);
        if (twin) twin.setMatrixAt(i, mtx);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (twin) twin.instanceMatrix.needsUpdate = true;
    };

    write(blobMesh, blobs);
    write(coinMesh, coins, reliefMesh);
    write(emberMesh, embers);
  }

  /* ---------------------------------------------------------------- *
   * Pointer ripples
   * ---------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastPoint = null;
  let lastSpawn = 0;

  function spawn(point, strength) {
    // Recycle the oldest ripple.
    let slot = 0;
    for (let i = 1; i < IMPULSES; i++) {
      if (impulseAge[i] > impulseAge[slot]) slot = i;
    }
    impulsePos[slot].copy(point);
    impulseAge[slot] = 0;
    impulseStr[slot] = strength;
  }

  function onPointerMove(event) {
    if (!logo.visible) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hit = raycaster.intersectObject(logo, false)[0];
    if (!hit) { lastPoint = null; return; }

    const now = performance.now();
    if (now - lastSpawn < 30) return;

    const local = logo.worldToLocal(hit.point.clone());
    const speed = lastPoint ? local.distanceTo(lastPoint) : 0.05;
    spawn(local, THREE.MathUtils.clamp(speed * 8, 0.4, 0.8));

    lastSpawn = now;
    lastPoint = local.clone();
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;

    const aspect = w / h;

    // Size to height, unless the viewport is narrow enough that width binds first.
    visibleHeight = Math.max(MARK / MARK_SHARE, (MARK / 0.8) / aspect);

    camera.aspect = aspect;
    camera.position.z = visibleHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.updateProjectionMatrix();

    logo.position.y = (0.5 - MARK_CENTRE) * visibleHeight;

    renderer.setSize(w, h, false);
  }
  window.addEventListener('resize', resize);

  const timer = new THREE.Timer();
  let running = false;
  let elapsed = 0;
  let progress = 0;
  let target = 0;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);

    const dt = Math.min(timer.update().getDelta(), 0.05);
    elapsed += dt;
    for (let i = 0; i < IMPULSES; i++) impulseAge[i] += dt;
    uTime.value = elapsed;

    // Chase the scroll rather than snap to it: the burst reads as motion, not as
    // a slider being dragged.
    progress += (target - progress) * (1 - Math.exp(-dt * 7));

    const melt = range(progress, MELT);
    const scale = 1 - easeInOut(melt);
    uMelt.value = melt;
    logo.visible = scale > 0.002;
    logo.scale.setScalar(Math.max(0.002, scale));

    // A sway rather than a spin: the mark has to stay legible as a logo. Once it
    // starts melting it whirls away instead.
    logo.rotation.y = Math.sin(elapsed * 0.32) * 0.46 + melt * Math.PI * 1.1;
    logo.rotation.x = Math.sin(elapsed * 0.24) * 0.17;
    logo.rotation.z = melt * 0.6;

    placeSwarm(progress, elapsed);

    renderer.render(scene, camera);
  }

  function resume() {
    if (running) return;
    running = true;
    timer.update();
    frame();
  }

  await renderer.init();
  resize();
  resume();

  return {
    pause: () => { running = false; },
    resume,
    setProgress: (p) => { target = clamp01(p); },
  };
}
