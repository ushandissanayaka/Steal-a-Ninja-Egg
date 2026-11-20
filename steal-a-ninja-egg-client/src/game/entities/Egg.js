// Eggs: built out of lots of little boxes in the shape of an egg (wider at the bottom). The shell's
// colour is the egg's rarity, the spots are its biome's colour, every little box a shade lighter or
// darker so the blocks show. Eggs on a nest sit still with a "Rare Egg / 36 kg" label and magic dust
// rising up round them; dropped eggs fly out of the carrier's hands, sit in a little nest and blink
// before they vanish.

import * as THREE from 'three';
import { BIOME_ALIAS, BIOME_COLOR, EGG_COLOR, EGG_SIZES, NEST_RISE, RARITY_COLOR, RULES, biomeIndex, eggName, onNestStage } from '../../shared/gameData.js';
import { makeBillboard } from '../util/canvasText.js';
import { Voxels } from '../util/bake.js';
import { glowMap } from './Effects.js';

// The egg's outline: radius at height y (0 at the bottom .. EGG_H at the top), the same curve the
// spots sit on (shellPoint below).
const EGG_H = 2.2;
const radiusAt = (y) => {
  const c = Math.max(-1, Math.min(1, 1 - y / 1.1)); // cos t
  return Math.sqrt(1 - c * c) * (1 + 0.2 * c) * 0.82;
};
const CELL = 0.14;             // the size of one little box
const SPOTS = 10;

// a tiny repeatable random number from a few integers
const hash = (...n) => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ (v | 0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

// The shell of little boxes for one biome + rarity (only the boxes on the outside: it is hollow).
const voxelGeometries = new Map();
function geometry(type, rarity) {
  const key = `${type}|${rarity}`;
  if (voxelGeometries.has(key)) return voxelGeometries.get(key);
  const shell = new THREE.Color(EGG_COLOR[rarity] || EGG_COLOR.Common);
  const spotHex = BIOME_COLOR[BIOME_ALIAS[type] || type];
  const spot = spotHex ? new THREE.Color(spotHex) : null;
  // the spots: a few round patches on the shell, the same on every egg of this biome
  const seed = [...String(type)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const centers = Array.from({ length: SPOTS }, (_, i) => shellPoint(0.55 + hash(seed, i, 1) * 2.1, hash(seed, i, 2) * Math.PI * 2).p);
  const n = Math.ceil(1.05 / CELL), ny = Math.ceil(EGG_H / CELL);
  const inside = (ix, iy, iz) => {
    if (iy < 0 || iy >= ny) return false;
    const y = (iy + 0.5) * CELL, x = (ix + 0.5) * CELL, z = (iz + 0.5) * CELL;
    return Math.hypot(x, z) <= radiusAt(y);
  };
  const v = new Voxels();
  const c = new THREE.Color();
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = -n - 1; ix <= n; ix++) {
      for (let iz = -n - 1; iz <= n; iz++) {
        if (!inside(ix, iy, iz)) continue;
        if (inside(ix + 1, iy, iz) && inside(ix - 1, iy, iz) && inside(ix, iy + 1, iz) && inside(ix, iy - 1, iz)
          && inside(ix, iy, iz + 1) && inside(ix, iy, iz - 1)) continue; // hidden inside
        const x = (ix + 0.5) * CELL, y = iy * CELL, z = (iz + 0.5) * CELL;
        const p = new THREE.Vector3(x, y + CELL / 2, z);
        const inSpot = spot && centers.some((q) => q.distanceTo(p) < 0.33 + hash(ix, iy, iz, 9) * 0.06);
        c.copy(inSpot ? spot : shell).multiplyScalar(0.9 + hash(ix, iy, iz) * 0.2);
        v.box(x, y, z, CELL, CELL, CELL, c.getHex());
      }
    }
  }
  const g = v.geometry();
  g.deleteAttribute('uv');
  voxelGeometries.set(key, g);
  return g;
}

const GLOWING = new Set(['Mythic', 'Secret', 'Divine', 'Eternal']);
const materials = new Map();
function material(type, rarity) {
  const key = GLOWING.has(rarity) ? rarity : 'plain';
  if (!materials.has(key)) {
    const options = { vertexColors: true };
    if (GLOWING.has(rarity)) options.emissive = new THREE.Color(RARITY_COLOR[rarity]).multiplyScalar(0.35);
    materials.set(key, new THREE.MeshLambertMaterial(options));
  }
  return materials.get(key);
}

// ------------------------------------------------------------------ the magic dust

// Glowing specks that rise up from where an egg sits, spiralling round it and fading out high
// above (in the egg's group: x/z round 0, y from the ground). One Points per egg.
const DUST_WHITE = new THREE.Color('#ffffff');
const DUST_GOLD = new THREE.Color('#ffd75e');
// A sparkle of its own colour with a bright white heart and a soft edge, drawn with normal blending
// (not additive), so it shows against a bright day sky as well as at night. Each point has its own
// size and alpha.
let dustMaterial = null;
function eggDustMaterial() {
  dustMaterial ??= new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: `
      attribute vec3 color; attribute float alpha; attribute float psize;
      varying vec3 vColor; varying float vAlpha;
      uniform float uScale;
      void main() {
        vColor = color; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q) * 2.0;
        // a four-pointed twinkle over a round glow
        float star = max(0.0, 1.0 - abs(q.x) * 9.0) * max(0.0, 1.0 - abs(q.y) * 2.2) + max(0.0, 1.0 - abs(q.y) * 9.0) * max(0.0, 1.0 - abs(q.x) * 2.2);
        float glow = smoothstep(1.0, 0.0, d);
        float a = clamp(glow * glow + star, 0.0, 1.0) * vAlpha;
        if (a < 0.02) discard;
        vec3 c = mix(vColor, vec3(1.0), clamp(smoothstep(0.45, 0.0, d) + star * 0.6, 0.0, 1.0));
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true, depthWrite: false,
  });
  return dustMaterial;
}
export class EggDust {
  constructor(parent, size, rarity, count = 16) {
    this.size = size;
    this.tints = [new THREE.Color(RARITY_COLOR[rarity] || '#ffffff').lerp(DUST_WHITE, 0.25), DUST_GOLD, DUST_WHITE];
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.alphas = new Float32Array(count);
    this.sizes = new Float32Array(count);
    this.specks = Array.from({ length: count }, (_, i) => {
      const s = { color: this.tints[i % this.tints.length] };
      this.respawn(s);
      s.age = Math.random() * s.life;
      return s;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    geometry.setAttribute('psize', new THREE.BufferAttribute(this.sizes, 1));
    this.points = new THREE.Points(geometry, eggDustMaterial());
    this.points.renderOrder = 6;
    this.points.frustumCulled = false;
    parent.add(this.points);
  }

  respawn(s) {
    s.angle = Math.random() * Math.PI * 2;
    s.r = this.size * (1 + Math.random() * 0.9);
    s.age = 0;
    s.life = 1.6 + Math.random() * 1.4;
    s.rise = this.size * (2.6 + Math.random() * 2.2);
    s.spin = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.2);
    s.phase = Math.random() * 10;
    s.size = this.size * (0.32 + Math.random() * 0.3);
  }

  update(dt) {
    this.specks.forEach((s, i) => {
      s.age += dt;
      if (s.age >= s.life) this.respawn(s);
      s.angle += s.spin * dt;
      const k = s.age / s.life;
      const r = s.r * (1 - k * 0.45); // drawn in a little as it rises
      const j = i * 3;
      this.positions[j] = Math.cos(s.angle) * r;
      this.positions[j + 1] = 0.3 + s.rise * s.age;
      this.positions[j + 2] = Math.sin(s.angle) * r;
      // in quickly, twinkling, out slowly at the top
      this.alphas[i] = Math.min(1, k * 6) * (1 - k) * (0.65 + 0.35 * Math.sin(s.age * 14 + s.phase));
      this.sizes[i] = s.size * (0.8 + 0.2 * Math.sin(s.age * 9 + s.phase));
      this.colors[j] = s.color.r;
      this.colors[j + 1] = s.color.g;
      this.colors[j + 2] = s.color.b;
    });
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.alpha.needsUpdate = a.psize.needsUpdate = true;
  }

  dispose() {
    this.points.parent?.remove(this.points);
    this.points.geometry.dispose();
  }
}

// ------------------------------------------------------------------ the shell

// a point on the shell (the lathe's profile, t = 0 bottom .. PI top) and the direction out of it
function shellPoint(t, phi) {
  const r = Math.sin(t) * (1 + 0.2 * Math.cos(t)) * 0.82, y = -Math.cos(t) * 1.1 + 1.1;
  return { p: new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r), n: new THREE.Vector3(Math.sin(phi), 0.25 - (t - 1.6) * 0.6, Math.cos(phi)).normalize() };
}

// egg: { type, rarity } (or just a biome id: a Common egg of that biome)
export function createEgg(egg) {
  const e = typeof egg === 'string' ? { type: egg, rarity: 'Common' } : egg || {};
  const type = e.type || 'dojo';
  const mesh = new THREE.Mesh(geometry(type, e.rarity || 'Common'), material(type, e.rarity || 'Common'));
  mesh.castShadow = true;
  return mesh;
}

const kgText = (kg) => `${Number(kg || 1) >= 10 ? Math.round(kg) : Number(kg || 1).toFixed(1)} kg`;

// The label above an egg: its name in the rarity's colour, and how heavy it is.
export function createEggLabel(egg) {
  return makeBillboard([
    { text: eggName(egg), size: 52, fill: RARITY_COLOR[egg.rarity] || '#ffffff' },
    { text: kgText(egg.kg), size: 44, fill: '#ffffff' },
  ], 2.6);
}

const FLY_SECONDS = 1.1;
const FLY_START_HEIGHT = 4;
const FLY_PEAK = 6;
const BOUNCE_SECONDS = 0.4;
const BLINK_SECONDS = 5;      // a dropped egg blinks for this long before it vanishes
export const GROUND_EGG_SCALE = 2.6; // eggs on the track (and dropped ones): big
const NEST_SCALE = 1.6;
const nestMaterial = new THREE.MeshLambertMaterial({ color: '#7a3a22' });
const nestGeometry = new THREE.CylinderGeometry(1.5, 1.2, 0.6, 10);

export class GroundEggView {
  static sparkles = true; // the magic dust around rare eggs (off on Low quality)

  constructor(id, data, scene, { fly = false, effects = null } = {}) {
    this.id = id;
    this.x = data.x;
    this.z = data.z;
    this.onNest = !!data.nest;
    this.rarity = data.rarity;
    // eggs on the track get bigger stage by stage (+14% each: the last stage's are 2.3x the first's)
    this.size = (EGG_SIZES[data.size || 1]?.scale || 1) * (1 + biomeIndex(data.type) * 0.14);
    this.effects = effects;
    this.from = { x: data.ox ?? data.x, z: data.oz ?? data.z };
    this.group = new THREE.Group();
    this.group.position.set(data.x, this.onNest || onNestStage(data.x, data.z) ? NEST_RISE : 0, data.z); // up on the nest's stage
    this.egg = createEgg(data);
    this.egg.scale.setScalar(GROUND_EGG_SCALE * this.size);
    this.label = createEggLabel(data);
    this.labelY = 1.6 + 2.35 * GROUND_EGG_SCALE * this.size; // over the top of the egg
    this.label.position.y = this.labelY;
    this.group.add(this.egg, this.label);
    if (!this.onNest) {
      // dropped on the ground: in a little nest of its own
      this.nest = new THREE.Mesh(nestGeometry, nestMaterial);
      this.nest.scale.setScalar(NEST_SCALE * this.size);
      this.nest.position.y = 0.3 * NEST_SCALE * this.size;
      this.group.add(this.nest);
    }
    // magic dust rising up from where the egg sits (more of it round the rare ones, so they can be
    // spotted from far away)
    const rare = GLOWING.has(data.rarity) || data.rarity === 'Legendary';
    this.dust = new EggDust(this.group, GROUND_EGG_SCALE * this.size * 0.9, data.rarity, rare ? 34 : 22);
    scene.add(this.group);
    const flies = fly && !this.onNest;
    this.t = flies ? 0 : FLY_SECONDS + BOUNCE_SECONDS;
    this.timed = !this.onNest; // dropped eggs vanish after a while
    this.spawnT = 0;
    this.pop = fly && this.onNest ? 0 : 1; // a new nest egg pops in
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    this.spawnT += dt;
    const k = Math.min(1, this.t / FLY_SECONDS);
    const ease = 1 - (1 - k) ** 2;
    const landed = k >= 1;
    if (landed && !this.landedOnce) {
      this.landedOnce = true;
      if (this.t < FLY_SECONDS + dt + 0.01) this.effects?.burst(new THREE.Vector3(this.x, 1, this.z), '#ffd75e', 8, 9);
    }
    if (this.nest) this.nest.visible = landed;
    this.label.visible = landed;
    if (this.dust) {
      this.dust.points.visible = landed; // day and night, every quality
      if (this.dust.points.visible && this.group.visible) this.dust.update(dt);
    }
    const lx = (this.from.x - this.x) * (1 - ease), lz = (this.from.z - this.z) * (1 - ease);
    const bounce = landed ? Math.max(0, Math.sin(Math.min(1, (this.t - FLY_SECONDS) / BOUNCE_SECONDS) * Math.PI) * 0.9) : 0;
    const base = this.nest ? 0.45 * NEST_SCALE * this.size : 0.75; // on a nest: up on the basket's floor
    this.egg.position.set(lx, base + FLY_START_HEIGHT * (1 - k) + 4 * FLY_PEAK * k * (1 - k) + bounce, lz);
    this.egg.rotation.z = landed ? Math.sin(this.spawnT * 2.2) * 0.06 : k * 5;
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 2.2);
      const s = this.pop * (1 + Math.sin(this.pop * Math.PI) * 0.4);
      this.egg.scale.setScalar(GROUND_EGG_SCALE * this.size * s);
    }
    const left = RULES.groundEggMs / 1000 - this.t;
    this.egg.visible = !(this.timed && left < BLINK_SECONDS && Math.sin(this.t * (left < 2 ? 30 : 16)) < 0);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.label.material.map.dispose();
    this.label.material.dispose();
    this.dust?.dispose();
  }
}
