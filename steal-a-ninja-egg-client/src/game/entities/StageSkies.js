// The things in the sky over some stages (the sky dome itself is in Sky.js):
//   Blood Moon     skeletal dragons circling high above, wings beating, and red magic swirls
//   The Void       spinning magic orbs with rings round them, and slowly turning crystals
//   Frostbite      drifting ice crystals under the aurora
//   The Nightmare  a colossal skull rising over the end wall, eyes burning, and a huge ring of fire
//                  spinning in the sky in front of it, with orbs of fire circling
// Each group is only drawn (and animated) while the player is near its stage.

import * as THREE from 'three';
import { BIOMES, WORLD } from '../../shared/gameData.js';
import { glowMap } from './Effects.js';

const NEAR = 520; // a stage's sky things show within this distance (along the corridor) of it
const _v = new THREE.Vector3();

const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, fog: false, ...extra });
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function glowSprite(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------------ Blood Moon

// A skeletal dragon: a long spine of vertebrae with ribs, a horned skull, a tail, and two bony wings
// with torn red membranes. Its wings flap (update) and it flies round a circle.
function skeletonDragon() {
  const BONE = lambert('#e8c8b8', { emissive: '#5a1a14' });
  const MEM = new THREE.MeshBasicMaterial({ color: '#c81a1a', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, fog: false });
  const g = new THREE.Group();
  const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, mat = BONE) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  // the spine, head at +z, curving down into the tail
  for (let i = 0; i < 26; i++) {
    const z = 12 - i * 1.6, y = Math.sin(i * 0.35) * 0.8 - Math.max(0, i - 14) * 0.25;
    box(1.4 - i * 0.03, 1.2 - i * 0.03, 1.1, 0, y, z);
    box(0.4, 1.4 - i * 0.04, 0.4, 0, y + 0.9, z, -0.3); // the spine's spikes
    if (i > 3 && i < 13) for (const s of [-1, 1]) box(0.3, 3.2 - Math.abs(i - 8) * 0.25, 0.3, s * 1.2, y - 1.4, z, 0, 0, s * 0.5); // ribs
  }
  // the skull: long jaws and two horns
  box(3, 2.4, 4, 0, 0.3, 15.6);
  box(2.2, 0.9, 4.6, 0, -0.4, 19);
  box(2.0, 0.6, 4.2, 0, -1.3, 18.6, 0.25);
  for (const s of [-1, 1]) {
    box(0.5, 0.5, 3.2, s * 1.0, 1.6, 13.6, 0.7, s * 0.3);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.2), basic('#ff2a1a'));
    eye.position.set(s * 1.0, 0.8, 17.0);
    g.add(eye);
  }
  // the wings: an arm bone, three finger bones and the membrane between them
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 1, 0.6, 6);
    g.add(w);
    const bone = (len, ang, from) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 0.5), BONE);
      m.geometry.translate(len / 2, 0, 0);
      m.position.copy(from);
      m.rotation.y = ang;
      m.scale.x = s;
      w.add(m);
      return new THREE.Vector3(from.x + s * Math.cos(ang) * len, from.y, from.z - Math.sin(ang) * len * s * s);
    };
    const elbow = bone(10, 0.15 * s, new THREE.Vector3(0, 0, 0));
    const tips = [[13, -0.05], [12, -0.5], [10, -0.95]].map(([len, a]) => bone(len, a * s, elbow));
    const pts = [new THREE.Vector3(0, 0, 0), elbow, ...tips, new THREE.Vector3(0, 0, -9)];
    const pos = [];
    for (let k = 1; k < pts.length - 1; k++) pos.push(...pts[0].toArray(), ...pts[k].toArray(), ...pts[k + 1].toArray());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    w.add(new THREE.Mesh(geo, MEM));
    wings.push({ w, s });
  }
  g.scale.setScalar(2.4);
  return { group: g, wings };
}

// A swirl of red magic: two thin rings turning opposite ways, a bright core and a soft glow.
function magicSwirl(color, color2, size) {
  const g = new THREE.Group();
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(size * (0.55 + k * 0.22), size * 0.04, 6, 40), basic(k % 2 ? color2 : color, { transparent: true, opacity: 0.85 }));
    r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    g.add(r);
    rings.push(r);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.3, 16, 10), basic(color2)));
  g.add(glowSprite(color, size * 3.2, 0.7));
  return { group: g, rings };
}

// ------------------------------------------------------------------ The Nightmare

// The colossal skull over the end of the corridor: cranium, cheekbones, deep eye sockets with burning
// pupils, a nose hole and a jaw full of teeth. Built of rounded shapes, in old bone colours.
function giantSkull() {
  const BONE = lambert('#e2d2b0', { emissive: '#2a1a0a' });
  const DARK = basic('#0a0604');
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    g.add(m);
    return m;
  };
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  add(sphere, BONE, 0, 0, 0, 40, 38, 36);        // cranium
  add(sphere, BONE, 0, -26, 10, 30, 18, 26);     // the face below
  for (const s of [-1, 1]) {
    add(sphere, BONE, s * 22, -18, 16, 10, 8, 10); // cheekbones
    add(sphere, DARK, s * 14, -12, 30, 10, 11, 6); // the eye sockets
    add(sphere, basic('#ff5a1a'), s * 14, -12, 34.5, 2.6, 2.6, 1.5); // burning pupils
  }
  add(new THREE.ConeGeometry(4, 8, 3), DARK, 0, -24, 35, 1, 1, 0.6).rotation.z = Math.PI; // the nose
  const jaw = new THREE.Group();
  jaw.position.set(0, -38, 6);
  g.add(jaw);
  const jawMesh = new THREE.Mesh(sphere, BONE);
  jawMesh.scale.set(24, 9, 22);
  jawMesh.position.set(0, -6, 8);
  jaw.add(jawMesh);
  const TOOTH = lambert('#f6ecd4');
  for (let i = 0; i < 12; i++) {
    const a = (i / 11 - 0.5) * 1.9;
    const up = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6, 3), TOOTH);
    up.position.set(Math.sin(a) * 20, -36, 10 + Math.cos(a) * 20);
    g.add(up);
    const lo = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), TOOTH);
    lo.position.set(Math.sin(a) * 19, 0, 8 + Math.cos(a) * 19);
    jaw.add(lo);
  }
  // cracks
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), DARK);
    c.position.set(-20 + i * 8, 18 + (i % 2) * 6, Math.sqrt(Math.max(0, 1 - ((-20 + i * 8) / 40) ** 2)) * 35);
    c.rotation.z = (i % 2 ? 0.5 : -0.4);
    g.add(c);
  }
  return { group: g, jaw };
}

// The ring of fire: a burning hoop with flame spikes all round it, spinning.
function fireRing(radius) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.06, 8, 64), basic('#ff3a10')));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(radius * 0.94, radius * 0.025, 6, 64), basic('#ffd21f')));
  const n = 56;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = radius * (0.18 + (i % 3) * 0.08);
    const f = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.035, len, 4), basic(i % 2 ? '#ff5a10' : '#ffd21f'));
    f.position.set(Math.cos(a) * (radius + len / 2), Math.sin(a) * (radius + len / 2), 0);
    f.rotation.z = a - Math.PI / 2;
    g.add(f);
  }
  g.add(glowSprite('#ff5a1a', radius * 3.4, 0.35));
  return g;
}

// A glowing orb with two rings turning round it (the Void's magic orbs, the Nightmare's fire orbs).
function magicOrb(color, ringColor, r) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), basic(color)));
  const rings = [0, 1].map((k) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (1.7 + k * 0.5), r * 0.08, 6, 36), basic(ringColor, { transparent: true, opacity: 0.9 }));
    ring.rotation.set(k ? 1.1 : 0.4, k ? 0.3 : 1.2, 0);
    g.add(ring);
    return ring;
  });
  g.add(glowSprite(color, r * 7, 0.6));
  return { group: g, rings };
}

function crystal(color, h) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), basic(color));
  m.scale.set(h * 0.35, h, h * 0.35);
  return m;
}

// ------------------------------------------------------------------ the whole set

export class StageSkies {
  constructor(scene) {
    this.groups = [];
    this.t = 0;
    const biome = (id) => BIOMES.find((b) => b.id === id);
    const stage = (id) => {
      const b = biome(id);
      if (!b) return null;
      const g = new THREE.Group();
      g.userData = { mid: (b.minZ + b.maxZ) / 2, half: (b.maxZ - b.minZ) / 2, items: [] };
      g.visible = false;
      scene.add(g);
      this.groups.push(g);
      return g;
    };

    // Blood Moon: three dragons on wide circles, four magic swirls over the walls
    const blood = stage('inferno');
    if (blood) {
      const mid = blood.userData.mid;
      for (let i = 0; i < 3; i++) {
        const d = skeletonDragon();
        blood.add(d.group);
        blood.userData.items.push({ kind: 'dragon', ...d, cx: (i - 1) * 20, cz: mid + (i - 1) * 100, r: 55 + i * 14, y: 86 + i * 14, speed: 0.22 + i * 0.05, phase: i * 2.1 });
      }
      for (let i = 0; i < 4; i++) {
        const s = magicSwirl('#ff1a2a', '#ff8a6a', 9 + (i % 2) * 4);
        s.group.position.set((i % 2 ? 1 : -1) * 70, 95 + (i % 3) * 18, mid + (i - 1.5) * 70);
        blood.add(s.group);
        blood.userData.items.push({ kind: 'swirl', ...s, spin: 0.6 + i * 0.15 });
      }
    }

    // The Void: magic orbs drifting high up, crystals turning
    const voidG = stage('void');
    if (voidG) {
      const mid = voidG.userData.mid;
      for (let i = 0; i < 7; i++) {
        const o = magicOrb(i % 2 ? '#ff4af0' : '#8a5aff', i % 2 ? '#c8a8ff' : '#ff8af8', 4 + (i % 3) * 1.5);
        o.group.position.set(Math.sin(i * 2.3) * 60, 85 + (i % 4) * 16, mid + (i - 3) * 42);
        voidG.add(o.group);
        voidG.userData.items.push({ kind: 'orb', ...o, base: o.group.position.clone(), phase: i * 1.3 });
      }
      for (let i = 0; i < 10; i++) {
        const c = crystal(i % 2 ? '#ff3af0' : '#6a3aff', 5 + (i % 3) * 3);
        c.position.set((i % 2 ? 1 : -1) * (40 + (i % 4) * 12), 75 + (i % 5) * 14, mid + (i - 5) * 30);
        voidG.add(c);
        voidG.userData.items.push({ kind: 'crystal', mesh: c, spin: 0.3 + (i % 3) * 0.2, base: c.position.y, phase: i });
      }
    }

    // Frostbite Hollow: ice crystals drifting under the aurora
    const frost = stage('frost');
    if (frost) {
      const mid = frost.userData.mid;
      for (let i = 0; i < 9; i++) {
        const c = crystal(i % 2 ? '#bff4ff' : '#7fd8ff', 3 + (i % 3) * 2);
        c.position.set((i % 2 ? 1 : -1) * (30 + (i % 4) * 14), 80 + (i % 4) * 12, mid + (i - 4) * 34);
        frost.add(c);
        frost.userData.items.push({ kind: 'crystal', mesh: c, spin: 0.25 + (i % 3) * 0.15, base: c.position.y, phase: i });
      }
    }

    // The Nightmare: the giant skull over the end wall, the ring of fire, orbs of fire round it
    const night = stage('nightmare');
    if (night) {
      const endZ = WORLD.northZ;
      const sk = giantSkull();
      sk.group.position.set(0, 120, endZ - 30);
      sk.group.scale.setScalar(1.25);
      night.add(sk.group);
      night.userData.items.push({ kind: 'skull', ...sk });
      const ring = fireRing(34);
      ring.position.set(0, 175, endZ + 150);
      night.add(ring);
      night.userData.items.push({ kind: 'ring', mesh: ring });
      for (let i = 0; i < 6; i++) {
        const o = magicOrb(i % 2 ? '#ff6a1a' : '#ffd21f', '#ff3a10', 3.5);
        night.add(o.group);
        night.userData.items.push({ kind: 'fireOrb', ...o, center: ring.position, phase: (i / 6) * Math.PI * 2 });
      }
      // the stage reaches past its end wall, so it stays drawn while you look up at the skull
      night.userData.half += 200;
    }
  }

  update(dt, playerZ) {
    this.t += dt;
    const t = this.t;
    for (const g of this.groups) {
      g.visible = Math.abs(playerZ - g.userData.mid) < g.userData.half + NEAR;
      if (!g.visible) continue;
      for (const it of g.userData.items) {
        if (it.kind === 'dragon') {
          const a = t * it.speed + it.phase;
          it.group.position.set(it.cx + Math.cos(a) * it.r, it.y + Math.sin(a * 2) * 6, it.cz + Math.sin(a) * it.r);
          it.group.rotation.y = -a; // heading along the circle
          it.group.rotation.z = Math.sin(a * 2) * 0.12;
          const flap = Math.sin(t * 3.2 + it.phase) * 0.55;
          for (const w of it.wings) w.w.rotation.z = w.s * flap;
        } else if (it.kind === 'swirl') {
          it.rings.forEach((r, k) => { r.rotation.z += dt * it.spin * (k % 2 ? -1 : 1); r.rotation.x += dt * 0.3; });
          it.group.rotation.y += dt * 0.4;
        } else if (it.kind === 'orb') {
          it.group.position.set(it.base.x + Math.sin(t * 0.3 + it.phase) * 8, it.base.y + Math.sin(t * 0.7 + it.phase) * 4, it.base.z);
          it.rings[0].rotation.z += dt * 1.6;
          it.rings[1].rotation.x += dt * 1.2;
        } else if (it.kind === 'crystal') {
          it.mesh.rotation.y += dt * it.spin;
          it.mesh.position.y = it.base + Math.sin(t * 0.6 + it.phase) * 3;
        } else if (it.kind === 'skull') {
          it.jaw.rotation.x = 0.08 + Math.max(0, Math.sin(t * 0.5)) * 0.18; // it slowly opens its mouth
          it.group.rotation.y = Math.sin(t * 0.15) * 0.08;
        } else if (it.kind === 'ring') {
          it.mesh.rotation.z -= dt * 0.9;
        } else if (it.kind === 'fireOrb') {
          const a = t * 0.8 + it.phase;
          it.group.position.copy(_v.set(Math.cos(a) * 48, Math.sin(a) * 48, 0).add(it.center));
          it.rings[0].rotation.z += dt * 2;
        }
      }
    }
  }
}
