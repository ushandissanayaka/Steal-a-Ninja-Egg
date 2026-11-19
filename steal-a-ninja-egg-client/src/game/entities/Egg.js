// Eggs: the shell's colour is the egg's rarity, the spots are its biome's colour. Eggs on a nest
// sit still with a "Rare Egg / 36 kg" label; dropped eggs fly out of the carrier's hands, sit in a
// little nest and blink before they vanish.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BIOME_ALIAS, BIOME_COLOR, EGG_COLOR, EGG_SIZES, RARITY_COLOR, RULES, biomeIndex, eggName } from '../../shared/gameData.js';
import { eggTexture } from '../util/textures.js';
import { makeBillboard } from '../util/canvasText.js';
import { MagicDust } from './Effects.js';

let eggGeometry = null;
function geometry() {
  if (!eggGeometry) {
    const points = [];
    for (let i = 0; i <= 18; i++) {
      const t = (i / 18) * Math.PI;
      // wider at the bottom than at the top
      points.push(new THREE.Vector2(Math.sin(t) * (1 - 0.2 * Math.cos(t) * -1) * 0.82, -Math.cos(t) * 1.1 + 1.1));
    }
    eggGeometry = new THREE.LatheGeometry(points, 24);
    eggGeometry.computeVertexNormals();
  }
  return eggGeometry;
}

const GLOWING = new Set(['Mythic', 'Secret', 'Divine', 'Eternal']);
const materials = new Map();
function material(type, rarity) {
  const key = `${type}|${rarity}`;
  if (!materials.has(key)) {
    const shell = EGG_COLOR[rarity] || EGG_COLOR.Common;
    const options = { map: eggTexture(shell, BIOME_COLOR[type] || null) };
    if (GLOWING.has(rarity)) options.emissive = new THREE.Color(RARITY_COLOR[rarity]).multiplyScalar(0.35);
    materials.set(key, new THREE.MeshLambertMaterial(options));
  }
  return materials.get(key);
}

// ------------------------------------------------------------------ the eyes on the shell

// Every egg looks back at you: a stage's eggs have as many glowing slit eyes round the shell as the
// stage's number (1 on the first stage ... 10 on the last). Cheap: one shared, merged geometry per
// number of eyes and one unlit material per stage, so an egg's eyes are a single extra draw call.
const eyeGeometries = new Map();
const eyeMaterials = new Map();
const _c = new THREE.Color();

// a point on the shell (the lathe's profile, t = 0 bottom .. PI top) and the direction out of it
function shellPoint(t, phi) {
  const r = Math.sin(t) * (1 + 0.2 * Math.cos(t)) * 0.82, y = -Math.cos(t) * 1.1 + 1.1;
  return { p: new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r), n: new THREE.Vector3(Math.sin(phi), 0.25 - (t - 1.6) * 0.6, Math.cos(phi)).normalize() };
}

function oneEye(size, colors) {
  // an almond of glow (vertex colour 1 = the stage's tint), a dark rim, and a black slit pupil
  const parts = [
    [new THREE.SphereGeometry(1, 12, 8).scale(size * 0.62, size, size * 0.22), colors.glow],
    [new THREE.SphereGeometry(1, 12, 8).scale(size * 0.74, size * 1.12, size * 0.16).translate(0, 0, -size * 0.04), colors.rim],
    [new THREE.SphereGeometry(1, 8, 6).scale(size * 0.13, size * 0.78, size * 0.12).translate(0, 0, size * 0.14), colors.slit],
  ];
  return parts.map(([g, col]) => {
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
}

function eyeGeometry(count) {
  if (!eyeGeometries.has(count)) {
    const colors = { glow: [1, 1, 1], rim: [0.22, 0.12, 0.3], slit: [0.03, 0.02, 0.05] };
    // one ring of eyes round the middle; past five, a second ring higher up
    const rings = count <= 5 ? [[1.55, count]] : [[1.35, Math.ceil(count / 2)], [2.05, Math.floor(count / 2)]];
    const size = count === 1 ? 0.3 : count <= 5 ? 0.24 : 0.19;
    const list = [];
    const q = new THREE.Quaternion(), m = new THREE.Matrix4(), Z = new THREE.Vector3(0, 0, 1);
    rings.forEach(([t, n], ring) => {
      for (let i = 0; i < n; i++) {
        const phi = (i / n) * Math.PI * 2 + ring * (Math.PI / n);
        const { p, n: nor } = shellPoint(t, phi);
        q.setFromUnitVectors(Z, nor);
        m.compose(p.addScaledVector(nor, size * 0.05), q, new THREE.Vector3(1, 1, 1));
        for (const g of oneEye(size, colors)) list.push(g.applyMatrix4(m));
      }
    });
    eyeGeometries.set(count, mergeGeometries(list));
  }
  return eyeGeometries.get(count);
}

function eyeMaterial(type) {
  if (!eyeMaterials.has(type)) {
    // the stage's colour, made bright (white-hot in the middle of the tint) so it reads as a glow
    _c.set(BIOME_COLOR[BIOME_ALIAS[type] || type] || '#ff4af0');
    const hsl = {};
    _c.getHSL(hsl);
    _c.setHSL(hsl.h, Math.max(0.75, hsl.s), Math.max(0.62, hsl.l));
    eyeMaterials.set(type, new THREE.MeshBasicMaterial({ vertexColors: true, color: _c.clone() }));
  }
  return eyeMaterials.get(type);
}

// egg: { type, rarity } (or just a biome id: a Common egg of that biome)
export function createEgg(egg) {
  const e = typeof egg === 'string' ? { type: egg, rarity: 'Common' } : egg || {};
  const type = e.type || 'pumpkin';
  const mesh = new THREE.Mesh(geometry(), material(type, e.rarity || 'Common'));
  mesh.castShadow = true;
  const eyes = new THREE.Mesh(eyeGeometry(biomeIndex(type) + 1), eyeMaterial(type));
  mesh.add(eyes);
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
export const GROUND_EGG_SCALE = 1.7;
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
    this.group.position.set(data.x, 0, data.z);
    this.egg = createEgg(data);
    this.egg.scale.setScalar(GROUND_EGG_SCALE * this.size);
    this.label = createEggLabel(data);
    this.labelY = 1.4 + 3.8 * this.size;
    this.label.position.y = this.labelY;
    this.group.add(this.egg, this.label);
    if (!this.onNest) {
      // dropped on the ground: in a little nest of its own
      this.nest = new THREE.Mesh(nestGeometry, nestMaterial);
      this.nest.scale.setScalar(NEST_SCALE * this.size);
      this.nest.position.y = 0.3 * NEST_SCALE * this.size;
      this.group.add(this.nest);
    }
    // rare eggs sparkle so they can be spotted from far away
    this.dust = GLOWING.has(data.rarity) || data.rarity === 'Legendary'
      ? new MagicDust(this.group, [new THREE.Vector3(0, 1.4 * this.size, 0)], 3 * this.size)
      : null;
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
      this.dust.points.visible = landed && GroundEggView.sparkles;
      if (this.dust.points.visible && this.group.visible) this.dust.update(dt);
    }
    const lx = (this.from.x - this.x) * (1 - ease), lz = (this.from.z - this.z) * (1 - ease);
    const bounce = landed ? Math.max(0, Math.sin(Math.min(1, (this.t - FLY_SECONDS) / BOUNCE_SECONDS) * Math.PI) * 0.9) : 0;
    const base = this.nest ? 0.45 * NEST_SCALE * this.size : 0.25;
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
    if (this.dust) {
      this.dust.points.geometry.dispose();
      this.dust.points.material.dispose();
    }
  }
}
