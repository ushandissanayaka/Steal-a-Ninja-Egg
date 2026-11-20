// The power round each of the first six guardians, in its stage's colour: a soft glow of that colour
// round the body, a pulsing ring on the floor and sparks rising, plus each one's own power:
//
//   brownNinja  gold sand whirling round him in rings
//   oldMaster   green leaves blowing round him in a wind
//   redNinja    flames licking up all round his body
//   blueNinja   short lightning bolts crackling out of both hands in every direction
//   earthNinja  rocks and gold crystals orbiting him
//   greenNinja  energy orbs rising round him and green lightning from his hands
//
// Built in the guardian's root group (so it turns and moves with it), sized to its height. Dimmer
// while it sleeps, full when it wakes. Cheap: a few sprites, one InstancedMesh per kind of piece.

import * as THREE from 'three';
import { glowMap } from './Effects.js';
import { FX } from './Tornado.js';

// stripes: the colours of its body and clothes, mixed in lines in its whirlwind (see Guardians.js)
export const AURAS = {
  brownNinja: { color: '#ffb02a', glow: '#ff9a1a', kind: 'sand', stripes: ['#7a4a2a', '#ffc21f', '#4a2a1a', '#f2c94c', '#a8683a'] },
  oldMaster: { color: '#6aff5a', glow: '#3fdc4a', kind: 'leaves', stripes: ['#f4f2ea', '#c81e2a', '#4a3a2e', '#efeadb', '#6aff5a'] },
  redNinja: { color: '#ff5a1a', glow: '#ff3a1a', kind: 'fire', stripes: ['#e01e2e', '#ff8a1a', '#2a1a14', '#f2c94c', '#ff4a1a'] },
  blueNinja: { color: '#7fe8ff', glow: '#2a8aff', kind: 'lightning', stripes: ['#2a56c8', '#ffd84a', '#7fe8ff', '#ffffff', '#c81e2a'] },
  earthNinja: { color: '#ffcf3a', glow: '#d89a1a', kind: 'rocks', stripes: ['#2a2e48', '#e0b040', '#f2c94c', '#16161c', '#a08460'] },
  greenNinja: { color: '#b8ff4a', glow: '#3aff6a', kind: 'energy', stripes: ['#2fae3a', '#ffd84a', '#7dff4a', '#d8ff3a', '#f2c94c'] },
  iceNinja: { color: '#bff0ff', glow: '#7fd8ff', kind: 'frost', stripes: ['#ffffff', '#1a2440', '#8ae4ff', '#c8ccd4', '#ffcc33'] },
  waterQueen: { color: '#7fe8ff', glow: '#1a9ae0', kind: 'water', stripes: ['#5fd0f0', '#1a7ac0', '#ffffff', '#3ab0e0', '#ffd84a'] },
  ghostNinja: { color: '#7dffb0', glow: '#2aff7a', kind: 'ghost', stripes: ['#1e8a3a', '#a8f0b0', '#16222e', '#ffe23a', '#7ff8ff'] },
  shadowLord: { color: '#ff4ae0', glow: '#a82aff', kind: 'dark', stripes: ['#24222c', '#ece4d4', '#c84ae0', '#ff2a1a', '#0e0a14'] },
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

const additive = (color, opacity = 1) => ({ map: glowMap(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

function sprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial(additive(color, opacity)));
  s.scale.setScalar(size);
  s.renderOrder = 6;
  return s;
}

export class GuardianAura {
  // root: the guardian's group; h: its height; hands(): [left, right] in root space (or null)
  constructor(root, type, h, hands = null) {
    const def = AURAS[type];
    this.def = def;
    this.h = h;
    this.hands = hands;
    this.group = new THREE.Group();
    root.add(this.group);
    this.t = Math.random() * 10;
    this.k = 0.5;

    // the soft glow of the stage's colour round the body
    this.halo = sprite(def.glow, 1, 0.5);
    this.halo.scale.set(h * 1.35, h * 1.6, 1);
    this.halo.position.y = h * 0.5;
    this.group.add(this.halo);
    this.core = sprite(def.color, 1, 0.3);
    this.core.scale.set(h * 0.6, h * 0.95, 1);
    this.core.position.y = h * 0.5;
    this.group.add(this.core);

    // the ring on the floor
    this.ring = new THREE.Mesh(new THREE.RingGeometry(h * 0.32, h * 0.42, 40), new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.group.add(this.ring);

    // sparks rising round it
    this.sparks = Array.from({ length: 22 }, (_, i) => {
      const s = sprite(def.color, h * 0.09);
      this.group.add(s);
      return { s, t: i / 22, a: Math.random() * Math.PI * 2, r: h * (0.25 + Math.random() * 0.15) };
    });

    this[`build_${def.kind}`]?.();
  }

  // ---------------------------------------------------------------- the powers

  // pieces orbiting / blowing round it: an InstancedMesh of small boxes
  orbiters(count, colors, size, opts = {}) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ emissive: opts.emissive || '#000000' }), count);
    const c = new THREE.Color();
    this.pieces = Array.from({ length: count }, (_, i) => {
      mesh.setColorAt(i, c.set(colors[i % colors.length]));
      return {
        a: (i / count) * Math.PI * 2 + Math.random() * 0.4,
        y: Math.random(), r: 0.7 + Math.random() * 0.6,
        s: size * (0.6 + Math.random() * 0.8), spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(4),
      };
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.orbitMesh = mesh;
    this.orbitOpts = opts;
  }

  updateOrbiters(dt) {
    const { h } = this;
    const o = this.orbitOpts;
    this.pieces.forEach((p, i) => {
      p.a += dt * (o.speed || 1.6) * (0.8 + (i % 3) * 0.2);
      if (o.rise) { p.y = (p.y + dt * o.rise) % 1; }
      const y = o.rise ? p.y : 0.3 + p.y * 0.5 + Math.sin(this.t * 1.3 + i) * 0.04;
      const r = h * 0.38 * p.r * (o.rise ? 0.6 + p.y * 0.8 : 1);
      _p.set(Math.cos(p.a) * r, h * y, Math.sin(p.a) * r);
      _q.setFromAxisAngle(_a.copy(p.spin).normalize(), this.t * p.spin.length());
      const fade = o.rise ? Math.sin(p.y * Math.PI) : 1;
      _s.setScalar(h * 0.065 * p.s * Math.max(0.05, fade));
      if (o.flat) _s.y *= 0.2;
      this.orbitMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    this.orbitMesh.instanceMatrix.needsUpdate = true;
  }

  build_sand() {
    // gold sand in two whirling rings, and a few gold flecks
    this.orbiters(46, ['#ffcf4a', '#e8a830', '#fff0a0'], 0.55, { speed: 2.6, emissive: '#5a3a00' });
  }

  build_leaves() {
    this.orbiters(30, ['#6aff5a', '#3fc84a', '#b8ff6a'], 1.6, { speed: 1.4, rise: 0.22, flat: true, emissive: '#0a3a0a' });
  }

  build_frost() {
    // snowflakes and ice shards whirling round him
    this.orbiters(26, ['#ffffff', '#bff0ff', '#8ad8ff'], 1.0, { speed: 1.5, emissive: '#2a5a7a' });
  }

  build_water() {
    // bubbles rising round her
    this.orbs = Array.from({ length: 14 }, (_, i) => {
      const s = sprite(i % 3 ? '#bff4ff' : '#ffffff', 1);
      this.group.add(s);
      return { s, t: i / 14, a: (i / 14) * Math.PI * 2 };
    });
  }

  build_ghost() {
    // ghostly green wisps drifting up round him, and pale spirit flames at his feet
    this.orbs = Array.from({ length: 12 }, (_, i) => {
      const s = sprite(i % 3 ? '#7dffb0' : '#e8fff0', 1);
      this.group.add(s);
      return { s, t: i / 12, a: (i / 12) * Math.PI * 2 };
    });
    this.build_fire(['#2aff7a', '#a8ffd0'], 16);
  }

  build_dark() {
    // pink and purple dark fire all round him, and red-pink lightning from his hands
    this.build_fire(['#ff3ad8', '#a82aff', '#ff6ae8'], 30);
    this.build_lightning(2, '#ff5ae8');
  }

  build_rocks() {
    this.orbiters(16, ['#5a5f78', '#7a7f98', '#ffcf3a', '#5a5f78'], 2.4, { speed: 0.8, emissive: '#1a1400' });
  }

  build_fire(colors = ['#ff6a1a', '#ff6a1a', '#ffc23a'], n = 28) {
    // flames: sprites rising from all round the body, shrinking and going red as they rise
    this.flames = Array.from({ length: n }, (_, i) => {
      const s = sprite(colors[i % colors.length], 1);
      this.group.add(s);
      return { s, t: Math.random(), a: Math.random() * Math.PI * 2, r: 0.18 + Math.random() * 0.2 };
    });
  }

  updateFire(dt) {
    const { h } = this;
    for (const f of this.flames) {
      f.t += dt * 0.9;
      if (f.t > 1) { f.t -= 1; f.a = Math.random() * Math.PI * 2; }
      const k = f.t;
      f.s.position.set(Math.cos(f.a) * h * f.r * (1 - k * 0.5), h * (0.05 + k * 1.0), Math.sin(f.a) * h * f.r * (1 - k * 0.5));
      f.s.scale.setScalar(h * 0.36 * (1 - k * 0.6));
      f.s.material.opacity = Math.sin(k * Math.PI) * this.k;
    }
  }

  build_energy() {
    this.orbs = Array.from({ length: 10 }, (_, i) => {
      const s = sprite(i % 2 ? '#b8ff4a' : '#3aff6a', 1);
      this.group.add(s);
      return { s, t: i / 10, a: (i / 10) * Math.PI * 2 };
    });
    this.build_lightning(2, '#c8ff6a');
    this.buildStrike('#c8ff6a');
  }

  updateEnergy(dt) {
    const { h } = this;
    for (const o of this.orbs) {
      o.t = (o.t + dt * 0.3) % 1;
      o.a += dt * 1.8;
      o.s.position.set(Math.cos(o.a) * h * 0.36, h * (0.1 + o.t * 0.9), Math.sin(o.a) * h * 0.36);
      o.s.scale.setScalar(h * 0.16 * (0.6 + Math.sin(o.t * Math.PI) * 0.6));
      o.s.material.opacity = Math.sin(o.t * Math.PI) * this.k;
    }
  }

  // Short jagged bolts out of each hand, in every direction, flickering: thin glowing boxes
  // (an InstancedMesh of segments), redrawn many times a second.
  build_lightning(perHand = 3, color = this.def.color) {
    if (this.def.kind === 'lightning') this.buildStrike(color);
    this.boltsPerHand = perHand;
    this.boltSegs = 5;
    const count = perHand * 2 * this.boltSegs;
    this.bolts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
    }), count);
    this.bolts.frustumCulled = false;
    this.bolts.renderOrder = 7;
    this.group.add(this.bolts);
    this.handGlows = [0, 1].map(() => {
      const s = sprite(color, this.h * 0.26);
      this.group.add(s);
      return s;
    });
    this.boltT = 0;
  }

  updateLightning(dt) {
    const { h } = this;
    this.boltT -= dt;
    const whirl = this.whirl || 0;
    // whirling: the bolts crackle out of the whirlwind itself, from all round it; otherwise its hands
    const hands = whirl > 0.5
      ? [0, 1].map(() => { const a = Math.random() * Math.PI * 2, y = 0.2 + Math.random() * 0.9; return new THREE.Vector3(Math.cos(a) * h * (0.15 + y * 0.45), h * y * 1.3, Math.sin(a) * h * (0.15 + y * 0.45)); })
      : this.hands?.() || [new THREE.Vector3(h * 0.3, h * 0.42, h * 0.08), new THREE.Vector3(-h * 0.3, h * 0.42, h * 0.08)];
    hands.forEach((at, i) => {
      this.handGlows[i].position.copy(at);
      this.handGlows[i].material.opacity = (0.6 + Math.random() * 0.4) * this.k * (whirl > 0.5 ? 0.6 : 1);
    });
    if (this.boltT > 0) return;
    this.boltT = 0.06 + Math.random() * 0.05;
    let n = 0;
    const segLen = h * 0.09, thick = h * 0.022;
    for (const at of hands) {
      for (let b = 0; b < this.boltsPerHand; b++) {
        // a random direction, mostly outwards and sideways
        const dir = _b.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
        const on = Math.random() < 0.8 * this.k + 0.1;
        _a.copy(at);
        for (let sgm = 0; sgm < this.boltSegs; sgm++) {
          const next = _p.copy(_a).addScaledVector(dir, segLen).add(new THREE.Vector3((Math.random() - 0.5) * segLen, (Math.random() - 0.5) * segLen, (Math.random() - 0.5) * segLen));
          const mid = _a.clone().add(next).multiplyScalar(0.5);
          const len = _a.distanceTo(next);
          _q.setFromUnitVectors(_up, next.clone().sub(_a).normalize());
          _s.set(on ? thick : 0, on ? len : 0, on ? thick : 0);
          this.bolts.setMatrixAt(n++, _m.compose(mid, _q, _s));
          _a.copy(next);
        }
      }
    }
    this.bolts.instanceMatrix.needsUpdate = true;
  }

  // Lightning striking down out of the sky onto the spot where it waits on its stage, every few
  // seconds (only while it is not whirling): a jagged bolt with a branch, a flash where it lands.
  buildStrike(color) {
    const h = this.h;
    this.strikeSegs = 16;
    this.strike = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }), this.strikeSegs);
    this.strike.frustumCulled = false;
    this.strike.renderOrder = 8;
    this.strike.visible = false;
    this.group.add(this.strike);
    this.strikeGlow = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }), this.strikeSegs);
    this.strikeGlow.frustumCulled = false;
    this.strikeGlow.renderOrder = 7;
    this.strikeGlow.visible = false;
    this.group.add(this.strikeGlow);
    this.strikeFlash = sprite(color, h * 1.6, 0);
    this.group.add(this.strikeFlash);
    this.nextStrike = 1 + Math.random() * 3;
    this.strikeT = -1;
  }

  drawStrike() {
    const h = this.h;
    // where it lands: right by it, a little to one side
    const a = Math.random() * Math.PI * 2, r = h * (0.15 + Math.random() * 0.3);
    const end = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const top = new THREE.Vector3(end.x + (Math.random() - 0.5) * h, h * 3.2, end.z + (Math.random() - 0.5) * h);
    const main = this.strikeSegs - 4;
    const pts = [top];
    for (let i = 1; i <= main; i++) {
      const t = i / main;
      const p = top.clone().lerp(end, t);
      if (i < main) p.add(new THREE.Vector3((Math.random() - 0.5) * h * 0.35, 0, (Math.random() - 0.5) * h * 0.35));
      pts.push(p);
    }
    let n = 0;
    const seg = (from, to, thick) => {
      const mid = from.clone().add(to).multiplyScalar(0.5);
      _q.setFromUnitVectors(_up, to.clone().sub(from).normalize());
      _s.set(thick, from.distanceTo(to), thick);
      _m.compose(mid, _q, _s);
      this.strike.setMatrixAt(n, _m);
      _s.set(thick * 4, from.distanceTo(to), thick * 4);
      this.strikeGlow.setMatrixAt(n, _m.compose(mid, _q, _s));
      n++;
    };
    for (let i = 0; i < main; i++) seg(pts[i], pts[i + 1], h * 0.035);
    // a branch off it
    let b = pts[Math.floor(main * 0.35)].clone();
    for (let i = 0; i < 4; i++) {
      const next = b.clone().add(new THREE.Vector3((Math.random() - 0.3) * h * 0.4, -h * 0.25, (Math.random() - 0.3) * h * 0.4));
      seg(b, next, h * 0.02);
      b = next;
    }
    this.strike.instanceMatrix.needsUpdate = true;
    this.strikeGlow.instanceMatrix.needsUpdate = true;
    this.strikeFlash.position.copy(end).setY(h * 0.15);
  }

  updateStrike(dt) {
    const waiting = (this.whirl || 0) < 0.2;
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      const t = this.strikeT;
      // on, a flicker, on again, gone
      const on = t < 0.09 || (t > 0.14 && t < 0.24);
      if (t > 0.1 && t < 0.12) this.drawStrike(); // the second flash a slightly different bolt
      this.strike.visible = this.strikeGlow.visible = on;
      this.strikeFlash.material.opacity = Math.max(0, 1 - t / 0.5) * 0.9;
      if (t > 0.6) { this.strikeT = -1; this.strike.visible = this.strikeGlow.visible = false; }
      return;
    }
    this.nextStrike -= dt;
    if (waiting && this.nextStrike <= 0) {
      this.nextStrike = (FX.fancy ? 2.2 : 4) + Math.random() * 3;
      this.strikeT = 0;
      this.drawStrike();
    }
  }

  // ---------------------------------------------------------------- every frame

  // awake: 0 asleep .. 1 awake
  update(dt, awake = 0) {
    this.t += dt;
    this.k += ((0.55 + awake * 0.45) - this.k) * Math.min(1, dt * 3);
    const pulse = 0.85 + Math.sin(this.t * 3) * 0.15;
    this.halo.material.opacity = 0.75 * this.k * pulse;
    this.core.material.opacity = 0.45 * this.k * pulse;
    this.ring.material.opacity = 0.85 * this.k * pulse;
    this.ring.scale.setScalar(1 + Math.sin(this.t * 2.2) * 0.08);
    // a weaker device or connection: only the glow, the ring and the main power
    const fancy = FX.fancy;
    const every = FX.level >= 2 ? 1 : 2; // mid level: every other spark
    this.sparks.forEach((p, i) => {
      p.s.visible = fancy && i % every === 0;
      if (!p.s.visible) return;
      p.t = (p.t + dt * 0.35) % 1;
      p.a += dt * 1.2;
      p.s.position.set(Math.cos(p.a) * p.r, this.h * p.t * 1.15, Math.sin(p.a) * p.r);
      p.s.material.opacity = Math.sin(p.t * Math.PI) * this.k;
    });
    if (this.orbitMesh) {
      this.orbitMesh.visible = fancy || this.def.kind === 'rocks';
      if (this.orbitMesh.visible) this.updateOrbiters(dt);
    }
    if (this.flames) this.updateFire(dt);
    if (this.orbs) this.updateEnergy(dt);
    if (this.bolts) this.updateLightning(dt);
    if (this.strike) this.updateStrike(dt);
  }
}
