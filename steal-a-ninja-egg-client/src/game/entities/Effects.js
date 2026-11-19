// Short-lived visuals: floating damage numbers and sparkle bursts.

import * as THREE from 'three';
import { makeBillboard } from '../util/canvasText.js';
import { glowTexture } from '../util/textures.js';

let glow = null;
export function glowMap() {
  glow ??= glowTexture();
  return glow;
}

export function createGlow(color = '#ffffff', size = 8) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

const DUST_COLORS = ['#ffd75e', '#ff7fe0', '#7fe8ff', '#c79bff'].map((c) => new THREE.Color(c));
const DUST_PER_CENTER = 18;

// Twinkling sparkles that drift up and swirl around each center point, in parent's local space.
export class MagicDust {
  constructor(parent, centers, radius) {
    this.centers = centers;
    this.radius = radius;
    const count = centers.length * DUST_PER_CENTER;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.particles = Array.from({ length: count }, (_, i) => {
      const p = { center: centers[Math.floor(i / DUST_PER_CENTER)], color: DUST_COLORS[i % DUST_COLORS.length] };
      this.respawn(p);
      p.age = Math.random() * p.life; // start spread out, not in one burst
      return p;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
      map: glowMap(), size: 1.5, vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    parent.add(this.points);
  }

  respawn(p) {
    p.angle = Math.random() * Math.PI * 2;
    p.dist = this.radius * (0.7 + Math.random() * 0.6);
    p.y = 0;
    p.age = 0;
    p.life = 0.8 + Math.random() * 1.1;
    p.rise = 2.2 + Math.random() * 3;
    p.spin = (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 1.6);
    p.phase = Math.random() * 10;
  }

  // energy speeds the dust up while the machine is running.
  update(dt, energy = 1) {
    this.particles.forEach((p, i) => {
      p.age += dt * energy;
      if (p.age >= p.life) this.respawn(p);
      p.angle += p.spin * dt * energy;
      p.y += p.rise * dt * energy;

      const k = i * 3;
      this.positions[k] = p.center.x + Math.cos(p.angle) * p.dist;
      this.positions[k + 1] = p.center.y + Math.sin(p.angle) * p.dist + p.y;
      this.positions[k + 2] = p.center.z;

      // additive blending: darker means more transparent
      const fade = Math.sin((p.age / p.life) * Math.PI) * (0.55 + 0.45 * Math.sin(p.age * 18 + p.phase));
      this.colors[k] = p.color.r * fade;
      this.colors[k + 1] = p.color.g * fade;
      this.colors[k + 2] = p.color.b * fade;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// Magic dust from chopping: how much of it, by quality tier, times the connection factor.
// Never below the minimum, so even the slowest device on the weakest connection gets some.
const MAGIC_TIER = { low: 0.35, medium: 0.6, high: 1, ultra: 1.4 };
const MAGIC_NETWORK = { good: 1, fair: 0.8, poor: 0.6 };
const MAGIC_MIN_LEVEL = 0.2;
const MAGIC_MIN_COUNT = 3;      // sparkles per burst, at the very least
const MAGIC_MAX_ITEMS = { low: 70, medium: 140, high: 260, ultra: 400 }; // live effects at once

// Wood chips: little blocks of bark and pale inner wood knocked out of the trunk.
const chipGeometry = new THREE.BoxGeometry(1, 1, 1);
const chipMaterials = new Map();
const chipMaterial = (color) => {
  if (!chipMaterials.has(color)) chipMaterials.set(color, new THREE.MeshLambertMaterial({ color, transparent: true }));
  return chipMaterials.get(color);
};
const CHIP_GRAVITY = 42;
const CHIP_LIFE = 1.6;   // seconds before a chip is gone
const CHIP_FADE = 0.4;   // it fades out over the last part of that
const MAX_CHIPS = { low: 30, medium: 60, high: 110, ultra: 160 };

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.chips = [];
    this.maxChips = MAX_CHIPS.high;
    this.particles = 1; // set by the quality tier
    this.magic = 1;     // set by setMagicLevel
    this.maxItems = MAGIC_MAX_ITEMS.high;
  }

  // Called when the quality tier or the connection grade changes.
  setMagicLevel(tier, network) {
    this.magic = Math.max(MAGIC_MIN_LEVEL, (MAGIC_TIER[tier] ?? 0.6) * (MAGIC_NETWORK[network] ?? 1));
    this.maxItems = MAGIC_MAX_ITEMS[tier] ?? MAGIC_MAX_ITEMS.medium;
    this.maxChips = MAX_CHIPS[tier] ?? MAX_CHIPS.medium;
  }

  // Chunks of wood flying out of the cut: thrown mostly towards dir (x, z), spinning, bouncing
  // once or twice on the ground, then fading. colors: [bark, inner wood].
  woodChips(position, dir, colors, count = 6, size = 1) {
    const n = Math.max(2, Math.round(count * this.magic));
    for (let i = 0; i < n; i++) {
      if (this.chips.length >= this.maxChips) this.removeChip(0); // oldest chip goes first
      const mesh = new THREE.Mesh(chipGeometry, chipMaterial(colors[i % colors.length]).clone());
      const s = size * (0.35 + Math.random() * 0.55);
      mesh.scale.set(s * (1 + Math.random()), s * (0.5 + Math.random() * 0.5), s);
      mesh.position.set(position.x + (Math.random() - 0.5) * size, position.y + (Math.random() - 0.5) * size, position.z + (Math.random() - 0.5) * size);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      mesh.castShadow = true;
      this.scene.add(mesh);
      const a = Math.atan2(dir.z, dir.x) + (Math.random() - 0.5) * 2.2; // a fan around dir
      const speed = 6 + Math.random() * 12;
      this.chips.push({
        mesh, age: 0, scale: s,
        vel: new THREE.Vector3(Math.cos(a) * speed, 8 + Math.random() * 12, Math.sin(a) * speed),
        spin: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18),
      });
    }
  }

  // A player hit by an animal bursts into blocky pieces that fly up high and rain down.
  shatter(position) {
    const colors = ['#f2c79a', '#3a6ad6', '#2a2a30', '#ffffff', '#e8293c', '#ffd21f'];
    const n = Math.max(10, Math.round(22 * Math.min(1.2, this.magic)));
    for (let i = 0; i < n; i++) {
      if (this.chips.length >= this.maxChips) this.removeChip(0);
      const mesh = new THREE.Mesh(chipGeometry, chipMaterial(colors[i % colors.length]).clone());
      const s = 0.7 + Math.random() * 0.9;
      mesh.scale.set(s, s * (0.8 + Math.random() * 0.6), s);
      mesh.position.set(position.x + (Math.random() - 0.5) * 2, position.y + 1 + Math.random() * 4, position.z + (Math.random() - 0.5) * 2);
      mesh.castShadow = true;
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2, out = 6 + Math.random() * 14;
      this.chips.push({
        mesh, age: -0.6, scale: s, // lives a little longer than a wood chip
        vel: new THREE.Vector3(Math.cos(a) * out, 26 + Math.random() * 18, Math.sin(a) * out),
        spin: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
      });
    }
    this.burst(new THREE.Vector3(position.x, position.y + 3, position.z), '#ffffff', 16, 18);
    this.magicDust(new THREE.Vector3(position.x, position.y + 2, position.z), 18, 3, 14);
  }

  removeChip(i) {
    const chip = this.chips[i];
    this.scene.remove(chip.mesh);
    chip.mesh.material.dispose();
    this.chips.splice(i, 1);
  }

  updateChips(dt) {
    for (let i = this.chips.length - 1; i >= 0; i--) {
      const c = this.chips[i];
      c.age += dt;
      const p = c.mesh.position;
      c.vel.y -= CHIP_GRAVITY * dt;
      p.addScaledVector(c.vel, dt);
      const floor = c.scale * 0.3;
      if (p.y < floor) {
        // bounce, losing most of the speed, and stop spinning once it settles
        p.y = floor;
        c.vel.y = Math.abs(c.vel.y) > 4 ? -c.vel.y * 0.35 : 0;
        c.vel.x *= 0.55;
        c.vel.z *= 0.55;
        c.spin.multiplyScalar(0.5);
      }
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      const left = CHIP_LIFE - c.age;
      c.mesh.material.opacity = Math.min(1, left / CHIP_FADE);
      if (left <= 0) this.removeChip(i);
    }
  }

  // Colourful magic sparkles that float up and swirl out, slower and lighter than a burst.
  magicDust(position, count = 12, spread = 3, rise = 9) {
    const room = this.maxItems - this.items.length;
    const n = Math.min(Math.max(MAGIC_MIN_COUNT, Math.round(count * this.magic)), Math.max(MAGIC_MIN_COUNT, room));
    for (let i = 0; i < n; i++) {
      const color = DUST_COLORS[(Math.random() * DUST_COLORS.length) | 0];
      const sprite = createGlow(color, 0.9 + Math.random() * 1.2);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      sprite.position.set(position.x + Math.cos(a) * r, position.y + Math.random() * spread, position.z + Math.sin(a) * r);
      this.scene.add(sprite);
      const out = 2 + Math.random() * 4;
      this.items.push({
        sprite, age: 0, life: 0.9 + Math.random() * 0.9,
        vel: new THREE.Vector3(Math.cos(a) * out, rise * (0.5 + Math.random()), Math.sin(a) * out),
        gravity: 2, twinkle: Math.random() * 10,
      });
    }
  }

  // A cloud of soft smoke puffing out and up, each puff swelling as it fades.
  smoke(position, color = '#ffffff', count = 14, size = 6) {
    const n = Math.max(4, Math.round(count * this.particles));
    for (let i = 0; i < n; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color, transparent: true, depthWrite: false, opacity: 0.85 }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * size * 0.3;
      sprite.position.set(position.x + Math.cos(a) * r, position.y + Math.random() * size * 0.3, position.z + Math.sin(a) * r);
      sprite.scale.setScalar(size * (0.5 + Math.random() * 0.4));
      this.scene.add(sprite);
      this.items.push({
        sprite, age: 0, life: 1.4 + Math.random() * 0.8, swell: 1.1,
        vel: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 4), 3 + Math.random() * 5, Math.sin(a) * (2 + Math.random() * 4)),
        gravity: -1,
      });
    }
  }

  floatText(text, position, fill = '#ff2a2a', scale = 1) {
    const sprite = makeBillboard([{ text, size: 76, fill, strokeWidth: 9 }], 2.4 * scale, { depthTest: false, renderOrder: 9 });
    sprite.position.copy(position);
    this.scene.add(sprite);
    this.items.push({ sprite, age: 0, life: 0.75 + (scale - 1) * 0.5, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 7, 0), owned: true });
  }

  burst(position, color = '#ffffff', count = 14, speed = 15) {
    const n = Math.round(count * this.particles);
    for (let i = 0; i < n; i++) {
      const sprite = createGlow(color, 1.1 + Math.random() * 1.1);
      sprite.position.copy(position);
      this.scene.add(sprite);
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random();
      this.items.push({
        sprite, age: 0, life: 0.55 + Math.random() * 0.45,
        vel: new THREE.Vector3(Math.cos(a) * speed * Math.random(), up * speed, Math.sin(a) * speed * Math.random()),
        gravity: 26,
      });
    }
  }

  update(dt) {
    this.updateChips(dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;
      if (item.gravity) item.vel.y -= item.gravity * dt;
      item.sprite.position.addScaledVector(item.vel, dt);
      if (item.swell) { item.sprite.scale.multiplyScalar(1 + item.swell * dt); item.vel.multiplyScalar(1 - dt * 1.5); }
      item.sprite.material.opacity = (1 - item.age / item.life) * (item.twinkle === undefined ? 1 : 0.6 + 0.4 * Math.sin(item.age * 22 + item.twinkle));
      if (item.age < item.life) continue;
      this.scene.remove(item.sprite);
      if (item.owned) item.sprite.material.map.dispose();
      item.sprite.material.dispose();
      this.items.splice(i, 1);
    }
  }
}
