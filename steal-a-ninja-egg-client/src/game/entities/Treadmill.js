// The round training arena outside each pen (like the video; it took the treadmill's place, so saves
// and messages still call it the treadmill): a low ring wall of cream stone blocks on a dark wooden
// base, brown and gold blocks standing up round the rim, a yellow band round the outside and a sandy
// floor with big yellow arrows chasing round it. Stand inside and you spin in a whirlwind, getting
// faster with every turn (see Player.js and Whirlwind.js).
//
// Each upgrade changes it: the band, the gold blocks and the arrows take the arena's own colour, and
// from the third arena on glowing crystals stand on the rim. Upgrading sends up a cloud of coloured
// smoke and the arena changes inside it. A locked arena has rope across its way in.

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { canvasTexture } from '../util/canvasText.js';
import { ARENA, TREADMILLS, treadmillById } from '../../shared/gameData.js';
import { glowMap } from './Effects.js';

const SEGMENTS = 28;              // blocks round the ring wall
const WALL_R = (ARENA.floor + ARENA.wall) / 2;
const WALL_T = ARENA.wall - ARENA.floor;
const H = ARENA.height;
const SMOKE_SECONDS = 2.8;
const SWAP_AT = 0.55;             // the arena changes this long into the smoke
const SMOKE_PUFFS = 44;
const WHITE = new THREE.Color('#ffffff');

const tierOf = (id) => Math.max(0, TREADMILLS.indexOf(treadmillById(id)));
// the arena's colour: the band, the gold blocks, the floor arrows (gold for the first one)
export const arenaColor = (id) => treadmillById(id).color || '#ffd21f';
const mix = (a, b, k) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

// angle of a ring position in the arena's own frame (x = cos, z = sin), and is it in the doorway?
// four ways in, evenly round the ring (the first one facing the pen's gate)
export const ARENA_DOORS = [0, 1, 2, 3].map((k) => ARENA.door + (k * Math.PI) / 2);
const inDoor = (a) => ARENA_DOORS.some((door) => {
  const d = Math.abs(((a - door) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  return d < ARENA.doorHalf;
});

// The places of the wall's blocks (for PlayerBase's colliders): [x, z] round the ring, none in the door.
export function arenaWallBlocks() {
  const out = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    if (!inDoor(a)) out.push([Math.cos(a) * WALL_R, Math.sin(a) * WALL_R]);
  }
  return out;
}
export const ARENA_BLOCK = 1.7; // a wall block's collider size (plot units)

// Every arena level has its own look (like the video, where each upgrade changes the colours):
//   stone / cap: the ring wall's blocks; ring: the thick outer ring round its foot; band: the stripe
//   round it; post: the pillars standing up on the rim; lamp: a light on each pillar; plant: what grows
//   round it; floor / target / dash: the floor's colour, the target in its middle, the dashed track.
const STYLES = [
  // 0 locked: plain wood and dull sand
  { bubble: '#c8b48a', stone: ['#d8c8a8', '#ccbc9a'], cap: '#bca880', ring: '#6e3e22', band: '#8a6a4a', post: '#5a321b', lamp: false, plant: null, floor: '#cdbd9c', target: '#8a6a4a', dash: '#a8987a' },
  // 1 Wooden: cream stone on a dark wooden ring, gold trim
  { bubble: '#ffd21f', stone: ['#efdcb2', '#e2c998', '#d9bc86'], cap: '#cfae74', ring: '#6e3e22', band: '#ffd21f', post: '#7a4a26', lamp: false, plant: null, floor: '#e8cf9c', target: '#7a4a26', dash: '#ffd21f' },
  // 2 Bamboo (the video's): pale stone on a red ring with a yellow band, red pillars with lamps, bamboo
  { bubble: '#ff3a3a', stone: ['#f4ede0', '#ebe2d0'], cap: '#e0d6c0', ring: '#d6202e', band: '#ffd21f', post: '#d6202e', lamp: true, plant: 'bamboo', floor: '#f4efe2', target: '#d6202e', dash: '#ffd21f' },
  // 3 Purple Blossom (the second upgrade): lilac stone on a deep purple ring, purple pillars, purple blossom trees
  { bubble: '#b05aff', stone: ['#f4ecff', '#e8dafa'], cap: '#d4c0f0', ring: '#6a22b8', band: '#e0c8ff', post: '#9a3aff', lamp: true, plant: 'blossom', bloom: ['#b878ff', '#e0c4ff'], floor: '#f4ecfc', target: '#8a3ae0', dash: '#c89aff' },
  // 4 Golden Temple (the third upgrade): golden stone on a bronze ring, gold pillars, glowing yellow crystals
  { bubble: '#ffd21f', stone: ['#ffe68a', '#f6d86c'], cap: '#e8c24a', ring: '#a8781a', band: '#fff27a', post: '#d8a01a', lamp: true, plant: 'crystal', crystal: '#ffe14a', floor: '#fff4c8', target: '#d89a1a', dash: '#ffd21f' },
  // 5 Fire Dragon: dark stone, red ring, black pillars, fire spikes
  { bubble: '#ff5a1a', stone: ['#4a3a38', '#3a2e2c'], cap: '#2a1e1c', ring: '#ff3a1a', band: '#ffcc33', post: '#1e1414', lamp: true, plant: 'flame', floor: '#5a3a30', target: '#ff3a1a', dash: '#ffcc33' },
  // 6 Ice Peak: white ice, pale blue ring, ice shards
  { bubble: '#9be8ff', stone: ['#f4fbff', '#e2f2fc'], cap: '#c8e8f8', ring: '#6ac8f0', band: '#ffffff', post: '#9be8ff', lamp: true, plant: 'ice', floor: '#eaf6fc', target: '#3aa8e0', dash: '#9be8ff' },
];
const styleOf = (id) => STYLES[Math.min(STYLES.length - 1, tierOf(id))];

// The floor: studs, the dashed track, chevrons that turn with the spin, the target in the middle.
function floorTexture(st) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = st.floor;
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = 16; x < 512; x += 32) for (let y = 16; y < 512; y += 32) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 6;
  for (const r of [236, 200]) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = st.dash;
  g.lineWidth = 10;
  g.setLineDash([26, 30]);
  g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.fillStyle = st.dash;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 6;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    g.save();
    g.translate(256 + Math.cos(a) * 140, 256 + Math.sin(a) * 140);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(-50, -26); g.lineTo(0, 26); g.lineTo(50, -26); g.lineTo(50, 4); g.lineTo(0, 56); g.lineTo(-50, 4);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  // the target: a ring, a gap, a dot
  g.fillStyle = st.target;
  g.beginPath(); g.arc(256, 256, 74, 0, Math.PI * 2); g.fill();
  g.fillStyle = st.floor;
  g.beginPath(); g.arc(256, 256, 48, 0, Math.PI * 2); g.fill();
  g.fillStyle = st.target;
  g.beginPath(); g.arc(256, 256, 22, 0, Math.PI * 2); g.fill();
  return canvasTexture(c);
}

// What grows round the arena, at a point outside the ring.
function plantAt(v, glow, kind, x, z, rnd, st = {}) {
  if (kind === 'bamboo') {
    for (const [dx, dz, h] of [[0, 0, 4.6], [0.7, 0.4, 3.6], [-0.5, 0.6, 3.0]]) {
      for (let y = 0; y < h; y += 1.2) {
        v.box(x + dx, y, z + dz, 0.55, Math.min(1.15, h - y), 0.55, '#3fae3a');
        v.box(x + dx, y + 1.1, z + dz, 0.62, 0.1, 0.62, '#2a8a2a');
      }
    }
  } else if (kind === 'blossom') {
    v.box(x, 0, z, 0.5, 2.6, 0.5, '#6a3a2a');
    const [bloom, light] = st.bloom || ['#ff9ac8', '#ffc8e0'];
    v.box(x, 2.4, z, 2.6, 1.2, 2.4, bloom, { ry: rnd() });
    v.box(x + 0.3, 3.3, z - 0.2, 1.8, 0.9, 1.8, light, { ry: rnd() });
  } else if (kind === 'crystal') {
    for (const [dx, dz, h, rz] of [[0, 0, 3.2, 0], [0.6, 0.3, 2.2, 0.35], [-0.6, 0.2, 2.0, -0.35]]) glow.box(x + dx, 0, z + dz, 0.7, h, 0.7, st.crystal || '#8ae8ff', { rz, ry: 0.785 });
  } else if (kind === 'flame') {
    for (const [dx, dz, h] of [[0, 0, 2.8], [0.6, 0.3, 1.9], [-0.5, 0.4, 1.6]]) {
      glow.box(x + dx, 0, z + dz, 0.8, h, 0.8, '#ff5a1a', { ry: 0.785 });
      glow.box(x + dx, 0, z + dz, 0.4, h * 0.7, 0.4, '#ffd23a', { ry: 0.785 });
    }
  } else if (kind === 'ice') {
    for (const [dx, dz, h, rz] of [[0, 0, 3.4, 0.1], [0.7, 0.2, 2.4, 0.4], [-0.6, 0.4, 2.0, -0.4]]) v.box(x + dx, 0, z + dz, 0.8, h, 0.8, '#d8f4ff', { rz, ry: 0.785 });
  }
}

function addRing(v, glow, id) {
  const tier = tierOf(id);
  const st = styleOf(id);
  const locked = tier === 0;
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  // the thick outer ring round its foot (the arena's colour), a band round it, a second ring below
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const ry = -a;
    v.box(Math.cos(a) * (ARENA.wall + 0.5), 0, Math.sin(a) * (ARENA.wall + 0.5), 2.0, 0.5, 1.95, mix(st.ring, '#000000', 0.25), { ry });
    v.box(Math.cos(a) * (ARENA.wall + 0.25), 0.5, Math.sin(a) * (ARENA.wall + 0.25), 1.5, 0.35, 1.85, st.band, { ry });
    v.box(Math.cos(a) * (ARENA.wall - 0.4), 0, Math.sin(a) * (ARENA.wall - 0.4), 1.5, H, 1.7, st.ring, { ry });
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    if (inDoor(a)) continue;
    const x = Math.cos(a) * WALL_R, z = Math.sin(a) * WALL_R, ry = -a;
    // the wall: a ring-coloured brick course under stone blocks with a cap
    v.box(x, 0, z, WALL_T + 0.1, 0.8, 1.66, st.ring, { ry });
    v.box(x, 0.8, z, WALL_T, ARENA.wallHeight - 0.8, 1.62, st.stone[i % st.stone.length], { ry });
    v.box(x, ARENA.wallHeight, z, WALL_T + 0.2, 0.28, 1.7, st.cap, { ry });
    // pillars standing up on the rim, every few blocks, with a light on top from the second arena on
    if (i % 4 === 0) {
      v.box(x, ARENA.wallHeight + 0.28, z, 1.1, 1.8, 1.1, st.post, { ry });
      if (st.lamp) glow.box(x, ARENA.wallHeight + 2.08, z, 0.8, 0.6, 0.8, '#fffbe8', { ry });
      else v.box(x, ARENA.wallHeight + 2.08, z, 1.2, 0.3, 1.2, st.band, { ry });
    }
    // what grows round it, outside the ring
    if (st.plant && i % 7 === 3 && !inDoor(a + Math.PI / SEGMENTS)) plantAt(v, glow, st.plant, Math.cos(a) * (ARENA.wall + 2.2), Math.sin(a) * (ARENA.wall + 2.2), rnd, st);
  }
  // every doorway: two posts with caps, a step down into the arena
  for (const door of ARENA_DOORS) {
  for (const s of [-1, 1]) {
    const a = door + s * (ARENA.doorHalf + 0.06);
    const x = Math.cos(a) * WALL_R, z = Math.sin(a) * WALL_R;
    v.box(x, 0, z, 1.4, ARENA.wallHeight + 1.1, 1.4, st.post, { ry: -a });
    v.box(x, ARENA.wallHeight + 1.1, z, 1.6, 0.5, 1.6, st.band, { ry: -a });
  }
  const sx = Math.cos(door) * (ARENA.wall + 0.9), sz = Math.sin(door) * (ARENA.wall + 0.9);
  v.box(sx, 0, sz, 1.6, H * 0.5, 3.4, st.cap, { ry: -door });
  if (locked) {
    // rope across the way in, with a red tag
    const a0 = door - ARENA.doorHalf, a1 = door + ARENA.doorHalf;
    const p0 = [Math.cos(a0) * WALL_R, Math.sin(a0) * WALL_R], p1 = [Math.cos(a1) * WALL_R, Math.sin(a1) * WALL_R];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const ry = -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    for (const y of [1.0, 2.0]) v.box((p0[0] + p1[0]) / 2, y, (p0[1] + p1[1]) / 2, len, 0.22, 0.22, '#c8a060', { ry });
    v.box((p0[0] + p1[0]) / 2, 1.2, (p0[1] + p1[1]) / 2, 0.9, 0.7, 0.3, '#d6283a', { ry });
  }
  }
}

// A see-through bubble of the arena's colour over it (a dome, clear in the middle, coloured at its
// edge), a little wider than the arena and its plants so it never reaches the pen's fence.
export const BUBBLE_R = ARENA.wall + 3.4;
function bubble(color) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform vec3 uColor;
      void main() { float rim = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(mix(uColor, vec3(1.0), rim * 0.3), 0.06 + rim * 0.42); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BUBBLE_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), material);
  mesh.renderOrder = 4;
  return mesh;
}

export class TreadmillView {
  static fancy = false; // a smooth frame rate and a good connection: thicker smoke when it upgrades
  constructor(parent, x, z) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    parent.add(this.group);
    this.model = null;
    this.id = null;
    this.smoke = [];
    this.time = 0;
    this.spin = 0;
  }

  // Builds the model for this arena (and drops the old one).
  build(id) {
    if (this.model) {
      this.group.remove(this.model);
      this.model.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    const v = new Voxels();
    const glow = new Voxels();
    addRing(v, glow, id);
    this.model = new THREE.Group();
    this.model.add(v.mesh());
    this.model.add(new THREE.Mesh(glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    this.floorTexture?.dispose();
    this.floorTexture = floorTexture(styleOf(id));
    this.floorTexture.center.set(0.5, 0.5);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA.floor + 0.35, 48), new THREE.MeshLambertMaterial({ map: this.floorTexture }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = H + 0.01;
    floor.receiveShadow = true;
    this.model.add(floor);
    // the bubble of the arena's colour over it (once it is unlocked)
    // the see-through bubble over it, in the arena's own colour (every arena, the first one too)
    const st = styleOf(id);
    this.model.add(bubble(st.bubble));
    this.setDust(st.bubble, tierOf(id) > 0);
    this.group.add(this.model);
    this.running = treadmillById(id).gain > 0;
  }

  // state: the owner's player state (null for a free pen)
  sync(state) {
    const id = state?.treadmill || 'none';
    if (id === this.id) return;
    const upgraded = this.id !== null && state && tierOf(id) > tierOf(this.id);
    this.id = id;
    if (upgraded) this.puff(arenaColor(id)); // the model is swapped inside the smoke (see update)
    else this.build(id);
  }

  // The owner is spinning in it: the floor's arrows turn faster.
  setSpinning(on) { this.spinning = on; }

  // A cloud of coloured smoke rising off the arena.
  puff(color) {
    this.smokeT = 0;
    this.pendingBuild = true;
    for (const s of this.smoke) this.group.remove(s.sprite);
    this.smoke = [];
    const tint = new THREE.Color(color);
    const n = TreadmillView.fancy ? SMOKE_PUFFS : SMOKE_PUFFS / 2;
    for (let i = 0; i < n; i++) {
      const c = tint.clone().lerp(WHITE, Math.random() * 0.25);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: c, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.renderOrder = 6;
      const a = Math.random() * Math.PI * 2, r = Math.random() * ARENA.wall;
      sprite.position.set(Math.cos(a) * r, 1 + Math.random() * 2, Math.sin(a) * r);
      this.group.add(sprite);
      this.smoke.push({
        sprite, delay: Math.random() * 0.5,
        vel: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2), 5 + Math.random() * 6, Math.sin(a) * (1 + Math.random() * 2)),
        size: 6 + Math.random() * 6, spin: (Math.random() - 0.5) * 2,
      });
    }
  }

  // Magic dust swirling round and round inside the arena as it rises, in the arena's colour (and
  // white and gold). One Points per arena; a weak device or a slow connection draws a third of it.
  setDust(color, on) {
    const N = 60;
    if (!this.dust) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
        map: glowMap(), size: 0.75, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      this.dust.frustumCulled = false;
      this.dust.renderOrder = 6;
      this.group.add(this.dust);
      this.grains = Array.from({ length: N }, (_, i) => ({ a: Math.random() * Math.PI * 2, t: Math.random(), r: 1 + Math.random() * (ARENA.floor - 1), v: 0.18 + Math.random() * 0.2, k: i % 3 }));
    }
    this.dustColors = [new THREE.Color(color), new THREE.Color('#ffffff'), new THREE.Color('#ffe08a')];
    this.dust.material.opacity = on ? 1 : 0.5; // dimmer while the arena is still locked
  }

  updateDust(dt) {
    if (!this.dust) return;
    const fancy = TreadmillView.fancy;
    const n = fancy ? this.grains.length : Math.floor(this.grains.length / 3);
    this.dust.geometry.setDrawRange(0, n);
    const pos = this.dust.geometry.attributes.position, col = this.dust.geometry.attributes.color;
    const fast = this.spinning ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const g = this.grains[i];
      g.t += dt * g.v * fast;
      if (g.t > 1) { g.t -= 1; g.a = Math.random() * Math.PI * 2; }
      g.a += dt * (1.6 + g.t) * fast; // round and round as it rises
      const r = g.r * (1 - g.t * 0.35);
      pos.setXYZ(i, Math.cos(g.a) * r, H + g.t * 9, Math.sin(g.a) * r);
      const c = this.dustColors[g.k], f = Math.sin(g.t * Math.PI) * (0.6 + 0.4 * Math.sin(this.time * 12 + i));
      col.setXYZ(i, c.r * f, c.g * f, c.b * f);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    this.updateDust(dt);
    // the arrows creep round on their own, and race round while someone spins in it
    if (this.floorTexture && this.running) {
      this.spin += dt * (this.spinning ? 3.2 : 0.25);
      this.floorTexture.rotation = this.spin;
    }
    if (this.smokeT === undefined) return;
    this.smokeT += dt;
    if (this.pendingBuild && this.smokeT >= SWAP_AT) {
      this.pendingBuild = false;
      this.build(this.id);
    }
    for (const s of this.smoke) {
      const t = this.smokeT - s.delay;
      if (t < 0) continue;
      const k = Math.min(1, t / (SMOKE_SECONDS - s.delay));
      s.sprite.position.addScaledVector(s.vel, dt * (1 - k * 0.6));
      s.sprite.scale.setScalar(s.size * (0.6 + k * 1.8));
      s.sprite.material.rotation += s.spin * dt;
      s.sprite.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (1 - k * 0.3);
    }
    if (this.smokeT >= SMOKE_SECONDS) {
      for (const s of this.smoke) {
        this.group.remove(s.sprite);
        s.sprite.material.dispose();
      }
      this.smoke = [];
      this.smokeT = undefined;
    }
  }
}
