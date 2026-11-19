// Thick stone pillars set into the lobby walls (corners, either side of the corridor mouth and
// evenly along the walls), each a little taller than the wall, with a warm yellow-white light beam
// spreading up into the sky and magic dust floating up along it. On every other pillar (going round
// the walls) a tall Bloxity ghost floats, red eyes glowing, watching the lobby (WallGhosts.js). The dust moves on the graphics card (one draw call for all of
// it), so it costs next to nothing.

import * as THREE from 'three';
import { GHOST_HEIGHT, createGhost, pulseGhostEyes } from './WallGhosts.js';

const STONE = ['#8d9196', '#7b7f85', '#9ea2a7', '#6f7378', '#878b90'];
const STONE_DARK = '#565a5f';
const MOSS = ['#4f9a2c', '#5cb033'];
const PILLAR_WIDTH = 13;
const ROW = 6;              // height of one row of stone blocks
const ABOVE_WALL = 14;      // how far the pillar rises over the wall
const CAP = 1.6;            // the flat top the dancer stands on
const GHOST_TALL = 32;       // how tall a ghost is, in world units (the player is about 5)
const GHOST_SCALE = GHOST_TALL / GHOST_HEIGHT;
const WATCH_RANGE = 420;    // within this, a ghost turns its head to follow the player

// The light beams: open cones, narrow at the lamp and wide at the top, glowing brightest at the
// bottom and fading out upwards, soft at their edges. Each beam is a wide warm-yellow cone with a
// narrow white-hot core inside it.
const BEAM_HEIGHT = 190;
const BEAM_YELLOW = '#ffd84a';
const BEAM_WHITE = '#fffbe8';
const cone = (top, bottom) => {
  const g = new THREE.CylinderGeometry(top, bottom, BEAM_HEIGHT, 16, 1, true);
  g.translate(0, BEAM_HEIGHT / 2, 0); // from the lamp upwards
  return g;
};
const outerCone = cone(34, 2);
const innerCone = cone(9, 0.9);
const beamVertex = /* glsl */ `
  varying float vUp;
  varying float vEdge;
  void main() {
    vUp = uv.y;
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vEdge = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uFadePow;
  varying float vUp;
  varying float vEdge;
  void main() {
    float fade = pow(1.0 - vUp, uFadePow);
    float soft = pow(vEdge, 1.3);
    // yellow light that turns white-hot near the lamp
    vec3 hot = mix(uColor, vec3(1.0), fade * fade * 0.6);
    gl_FragColor = vec4(hot, clamp(fade * soft * uPower, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

function beamPart(geometry, color, power, fadePow) {
  const uniforms = { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uFadePow: { value: fadePow } };
  const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms, vertexShader: beamVertex, fragmentShader: beamFragment,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  }));
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// One beam: the wide yellow spread and the bright white core, turned together.
function createBeam() {
  const group = new THREE.Group();
  const outer = beamPart(outerCone, BEAM_YELLOW, 0.75, 1.3);
  const inner = beamPart(innerCone, BEAM_WHITE, 1.1, 2.2);
  group.add(outer.mesh, inner.mesh);
  return { mesh: group, core: inner.mesh, parts: [outer.uniforms, inner.uniforms], base: [0.75, 1.1] };
}

// ------------------------------------------------------------------ the magic dust

// Golden and white specks drifting up each beam, spreading out as they rise and twinkling. Every
// speck's path is worked out in the vertex shader from its seed and the time, so the CPU does
// nothing per frame but set one number.
const DUST_PER_BEAM = 46;
const DUST_RISE = 150;       // how high a speck gets before it starts again
const dustVertex = /* glsl */ `
  attribute vec3 aOrigin;    // the lamp
  attribute vec3 aLean;      // the beam's direction (unit)
  attribute vec4 aSeed;      // random numbers 0..1
  uniform float uTime;
  uniform float uScale;      // pixels per world unit at distance 1 (from the viewport height)
  varying float vAlpha;
  varying float vWarm;
  void main() {
    float speed = 0.05 + aSeed.x * 0.06;
    float t = fract(uTime * speed + aSeed.y);
    float up = t * 150.0;
    vec3 side = normalize(cross(aLean, vec3(0.0, 0.0, 1.0)) + vec3(0.0001));
    vec3 side2 = normalize(cross(aLean, side));
    float a = aSeed.z * 6.2832 + uTime * (0.4 + aSeed.w * 0.6);
    float r = (1.5 + t * 26.0) * (0.35 + aSeed.w * 0.65);
    vec3 p = aOrigin + aLean * up + (side * cos(a) + side2 * sin(a)) * r;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.6 + 0.4 * sin(uTime * (4.0 + aSeed.x * 6.0) + aSeed.z * 30.0);
    vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.65, 1.0, t)) * twinkle;
    vWarm = aSeed.w;
    gl_PointSize = clamp((0.9 + aSeed.x * 1.1) * uScale / -mv.z, 1.5, 22.0);
  }
`;
const dustFragment = /* glsl */ `
  varying float vAlpha;
  varying float vWarm;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float spark = max(0.0, 1.0 - abs(c.x) * 9.0) * max(0.0, 1.0 - abs(c.y) * 2.2)
                + max(0.0, 1.0 - abs(c.y) * 9.0) * max(0.0, 1.0 - abs(c.x) * 2.2); // a little cross of light
    vec3 color = mix(vec3(1.0, 0.86, 0.35), vec3(1.0), vWarm * 0.7 + core * 0.3);
    gl_FragColor = vec4(color * (core + spark * 0.6) * vAlpha, 1.0);
    #include <colorspace_fragment>
  }
`;

function createDust(beams) {
  const n = beams.length * DUST_PER_BEAM;
  const origin = new Float32Array(n * 3), lean = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  let k = 0;
  let r = 777;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (const b of beams) {
    for (let i = 0; i < DUST_PER_BEAM; i++, k++) {
      origin.set([b.origin.x, b.origin.y, b.origin.z], k * 3);
      lean.set([b.dir.x, b.dir.y, b.dir.z], k * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], k * 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); // unused (the shader places them)
  geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geometry.setAttribute('aLean', new THREE.BufferAttribute(lean, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const uniforms = { uTime: { value: 0 }, uScale: { value: 400 } };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, vertexShader: dustVertex, fragmentShader: dustFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.frustumCulled = false;
  points.renderOrder = 4;
  return { points, uniforms, count: n };
}

// the lamp the beam comes out of: a little dark housing with a glowing lens
function createLamp(color) {
  const group = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 1.6, 12), new THREE.MeshLambertMaterial({ color: '#2a2a30' }));
  housing.position.y = 0.8;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 12), new THREE.MeshBasicMaterial({ color }));
  lens.position.y = 1.7;
  group.add(housing, lens);
  return group;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// One pillar of rough stone blocks. (x, z) = its middle; height = top of the stone (without the cap).
function addPillar(v, x, z, height, rnd) {
  const w = PILLAR_WIDTH;
  // a wider plinth at the bottom
  v.box(x, 0, z, w + 3, 3, w + 3, STONE_DARK);
  v.box(x, 3, z, w + 1.4, 1.2, w + 1.4, STONE[3]);
  // the shaft: rows of blocks, each row two blocks per side, slightly uneven
  for (let y = 4.2, row = 0; y < height; y += ROW, row++) {
    const h = Math.min(ROW, height - y);
    const shift = row % 2 ? w / 4 : -w / 4;
    for (const side of [-1, 1]) {
      const pick = () => STONE[(rnd() * STONE.length) | 0];
      const jut = rnd() * 0.5;
      v.box(x + side * w / 4 + (row % 2 ? 0 : 0), y, z, w / 2 - 0.3 + jut, h - 0.3, w + jut, pick(), { ry: (rnd() - 0.5) * 0.04 });
      v.box(x, y, z + side * w / 4 + shift * 0, w + jut, h - 0.3, w / 2 - 0.3 + jut, pick(), { ry: (rnd() - 0.5) * 0.04 });
    }
    // now and then a patch of moss hanging off a block
    if (rnd() < 0.35) v.box(x + (rnd() - 0.5) * w * 0.6, y + h - 1.2, z + (rnd() < 0.5 ? -1 : 1) * (w / 2 + 0.3), 2 + rnd() * 3, 1.2 + rnd() * 2, 0.6, MOSS[(rnd() * 2) | 0]);
  }
  // the capital: a stepped ledge and a flat top for the dancer
  v.box(x, height, z, w + 2, 1.2, w + 2, STONE[2]);
  v.box(x, height + 1.2, z, w + 3.2, CAP - 1.2 + 0.4, w + 3.2, STONE_DARK);
  // little battlements on the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) v.box(x + sx * (w / 2 + 0.6), height + CAP, z + sz * (w / 2 + 0.6), 2, 2.2, 2, STONE[0]);
}

export class WallDancers {
  // spots: [{ x, z }] pillar middles; wallHeight: the height of the walls they stand in
  constructor(scene, v, physics, spots, wallHeight) {
    const rnd = seeded(4242);
    const height = wallHeight + ABOVE_WALL;
    this.top = height + CAP;
    this.dancers = [];
    const dustBeams = [];
    // every other pillar going round the walls gets a ghost (sorted by the angle round the lobby)
    const cx = spots.reduce((a, p) => a + p.x, 0) / spots.length, cz = spots.reduce((a, p) => a + p.z, 0) / spots.length;
    const order = spots.map((p, i) => [Math.atan2(p.x - cx, p.z - cz), i]).sort((a, b) => a[0] - b[0]);
    const haunted = new Set(order.filter((_, k) => k % 2 === 0).map(([, i]) => i));
    spots.forEach((spot, i) => {
      addPillar(v, spot.x, spot.z, height, rnd);
      physics.addBox(spot.x - PILLAR_WIDTH / 2 - 1.5, spot.x + PILLAR_WIDTH / 2 + 1.5, spot.z - PILLAR_WIDTH / 2 - 1.5, spot.z + PILLAR_WIDTH / 2 + 1.5);

      const dancer = { spot, phase: rnd() * 6, ghost: null };
      if (haunted.has(i)) {
        const ghost = createGhost();
        ghost.root.scale.setScalar(GHOST_SCALE);
        ghost.root.position.set(spot.x, this.top + 1, spot.z);
        ghost.root.rotation.y = spot.face ?? 0; // facing into the lobby
        scene.add(ghost.root);
        dancer.ghost = ghost;
      }
      // the light beam, from a lamp at the back of the pillar top, leaning out over the lobby
      const color = BEAM_WHITE;
      const back = { x: -Math.sin(spot.face ?? 0), z: -Math.cos(spot.face ?? 0) }; // behind the dancer
      const lampAt = new THREE.Vector3(spot.x + back.x * 4.2, this.top, spot.z + back.z * 4.2);
      const lamp = createLamp(color);
      lamp.position.copy(lampAt);
      scene.add(lamp);
      const beam = createBeam();
      beam.mesh.position.copy(lampAt).setY(this.top + 1.7);
      scene.add(beam.mesh);
      dancer.beam = { ...beam, lamp, face: spot.face ?? 0, sway: 0.35 + rnd() * 0.35, speed: 0.3 + rnd() * 0.3 };
      // the dust rises from just above the lamp, along the beam's average lean
      const face = spot.face ?? 0;
      const leanDir = new THREE.Vector3(Math.sin(face) * 0.3, 1, Math.cos(face) * 0.3).normalize();
      dustBeams.push({ origin: lampAt.clone().setY(this.top + 3), dir: leanDir });
      this.dancers.push(dancer);
    });
    this.dust = createDust(dustBeams);
    scene.add(this.dust.points);
  }

  // The quality tier: no dust on Low (no sparkles), less of it on Medium.
  setQuality(q) {
    this.dustOn = q.sparkles !== false;
    this.dust.points.visible = this.dustOn;
    // Low quality: just the wide yellow beams (no white cores, no dust)
    for (const d of this.dancers) d.beam.core.visible = q.sparkles !== false;
    const k = Math.max(0.3, Math.min(1, q.particles ?? 1));
    this.dust.points.geometry.setDrawRange(0, Math.floor(this.dust.count * k));
  }

  // far = the draw distance (Game.fogTarget.far): dancers past it are hidden with their wall chunk
  // viewportHeight (CSS px) sizes the dust specks
  // motion: 1 = the game runs smoothly with a good connection (Game.extrasK, eased 0..1). The ghosts
  // floating, the beams sweeping and the dust rising run only then; otherwise they slow down and hold
  // still (their own clock stops) and the dust is not drawn, so nothing jumps and nothing costs time.
  update(dt, time, viewer, far = Infinity, viewportHeight = 720, motion = 1) {
    this.clock = (this.clock ?? time) + dt * motion;
    time = this.clock;
    this.dust.points.visible = this.dustOn !== false && motion > 0.05;
    this.dust.uniforms.uTime.value = time;
    pulseGhostEyes(time);
    this.dust.uniforms.uScale.value = viewportHeight * 1.1;
    for (const d of this.dancers) {
      const dist = viewer ? Math.hypot(viewer.x - d.spot.x, viewer.z - d.spot.z) : 0;
      // the beam: always shown (it reaches the sky), leaning towards the lobby and sweeping side to side
      const b = d.beam;
      const t0 = time * b.speed + d.phase;
      const lean = 0.32 + Math.sin(t0 * 0.7) * 0.12;
      const swing = Math.sin(t0) * b.sway;
      b.mesh.rotation.set(0, b.face + swing, 0);
      b.mesh.rotateX(lean);
      const pulse = 1 + Math.sin(time * 3 + d.phase) * 0.12;
      b.parts.forEach((u, k) => { u.uPower.value = b.base[k] * pulse; });
      const g = d.ghost;
      if (!g) continue;
      g.root.visible = dist < far + 80;
      if (!g.root.visible) continue;
      const t = time + d.phase;
      // floating up and down, swaying slowly, arms swinging a little
      g.root.position.y = this.top + 1.5 + Math.sin(t * 1.1) * 1.2;
      g.root.rotation.z = Math.sin(t * 0.7) * 0.04;
      g.arms.forEach((arm, k) => { arm.rotation.x = -0.35 + Math.sin(t * 0.9 + k * 1.7) * 0.12; });
      // the head turns to watch the player (up to ~70 degrees either way)
      const face = d.spot.face ?? 0;
      let look = 0;
      if (viewer && dist < WATCH_RANGE) {
        look = Math.atan2(viewer.x - d.spot.x, viewer.z - d.spot.z) - face;
        look = Math.atan2(Math.sin(look), Math.cos(look));
        look = Math.max(-1.2, Math.min(1.2, look));
      } else look = Math.sin(t * 0.3) * 0.5;
      g.head.rotation.y += (look - g.head.rotation.y) * Math.min(1, dt * 1.5 * motion);
      for (const glow of g.glows) glow.scale.setScalar(1.4 + Math.sin(t * 2.1) * 0.25);
    }
  }
}
