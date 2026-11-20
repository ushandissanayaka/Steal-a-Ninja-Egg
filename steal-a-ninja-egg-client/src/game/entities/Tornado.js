// A spinning whirlwind, drawn like the Spin Shop's pictures: a funnel of bold swirling bands (the
// style's colours, a bright highlight and a dark outline on each band) narrow at the bottom and wide
// at the top, curls of wind flaring out round its top like flames, a soft glow in its heart, magic
// dust rising round it, and a darker disc of the same colours spinning on the ground under it. Some
// styles have something more flying round it (ice shards, bubbles, flames, sparks, orbs, gems).
//
// Used for the player (their spin style), the guardians (their own colours) and the hatched ninjas.
//
// Performance: every texture, geometry and material is shared per style, so a tornado is a few draw
// calls. FX.fancy (a smooth frame rate and a good connection, set by Game) adds the inner core, the
// extras and more dust; the funnel, the curls, the ground disc and some dust always show.

import * as THREE from 'three';
import { glowMap } from './Effects.js';

// What the device can take: set by Game every frame (fancy = smooth and well connected).
// level: 0 low, 1 mid (every animation, fewer particles), 2 full; fancy = level >= 1
export const FX = { fancy: true, level: 2, night: 0 }; // night: 0 day .. 1 night (Game)

// [bottom radius, top radius, bottom y, height, turn speed, opacity] for a tornado 1 unit tall
const LAYERS = [
  [0.06, 0.2, 0.0, 0.34, 9.5, 0.95],
  [0.13, 0.34, 0.26, 0.36, -7.5, 0.9],
  [0.22, 0.5, 0.55, 0.45, 6.2, 0.85],
];
const INNER = [0.04, 0.26, 0.05, 0.85, -12, 0.6]; // a thin fast core (fancy only)
const CURLS = [[0.92, 0.5, 7], [0.7, 0.38, 5]];    // [y, radius, count] of the curls of wind
const DUST = 44;
const SMOKE = 12;
const GROW_SPEED = 6;

const cache = new Map();
const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};
const shade = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

// Bold slanted bands in the style's colours, each with a dark outline and a white highlight, soft gaps
// between them (so the funnel is see-through between its bands).
function bandTexture(colors) {
  return once(`band|${colors.join(',')}`, () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.lineCap = 'round';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const y = 8 + ((i * 47) % 112), x = (i * 97) % 256, len = 90 + ((i * 37) % 100), w = 9 + (i % 3) * 4;
      const color = colors[i % colors.length];
      for (const off of [0, -256]) {
        const x0 = x + off, y0 = y, x1 = x0 + len, y1 = y - len * 0.22;
        const line = (width, style, alpha = 1) => {
          g.globalAlpha = alpha;
          g.strokeStyle = style;
          g.lineWidth = width;
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo((x0 + x1) / 2, y0 - len * 0.18, x1, y1);
          g.stroke();
        };
        line(w + 4, shade(colors[colors.length - 1], 0.35), 0.9); // the outline
        line(w, color);
        line(w * 0.3, '#ffffff', 0.85);                             // the highlight
      }
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  });
}

// A curl of wind: a hooked flame-like wisp with a dark outline and a light inside.
function curlTexture(color) {
  return once(`curl|${color}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const path = () => {
      g.beginPath();
      g.moveTo(20, 120);
      g.bezierCurveTo(10, 70, 40, 30, 80, 24);
      g.bezierCurveTo(120, 20, 116, 66, 88, 64);
      g.bezierCurveTo(70, 62, 74, 44, 88, 46);
      g.bezierCurveTo(70, 40, 50, 70, 60, 120);
      g.closePath();
    };
    g.lineJoin = 'round';
    path(); g.lineWidth = 10; g.strokeStyle = shade(color, 0.35); g.stroke();
    path(); g.fillStyle = color; g.fill();
    g.globalAlpha = 0.7;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(46, 78, 8, 22, -0.4, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

// The spinning disc on the ground: spiral arms in a darker shade of the style's colours.
function ringTexture(colors, ring) {
  return once(`ring|${colors.join(',')}|${ring}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.translate(128, 128);
    const grad = g.createRadialGradient(0, 0, 20, 0, 0, 126);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.35, ring + 'aa');
    grad.addColorStop(0.95, ring + '66');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, 126, 0, Math.PI * 2); g.fill();
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      g.save();
      g.rotate((k / 6) * Math.PI * 2);
      g.strokeStyle = shade(colors[k % colors.length], 0.7);
      g.lineWidth = 9;
      g.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) {
        const r = 30 + t * 92, a = t * 2.4;
        g[t ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      g.stroke();
      g.restore();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

const layerGeometry = ([r0, r1, y, h]) => once(`lg|${r0},${r1},${y},${h}`, () => new THREE.CylinderGeometry(r1, r0, h, 28, 1, true).translate(0, y + h / 2, 0));
const layerMaterial = (colors, opacity) => once(`lm|${colors.join(',')}|${opacity}`, () => new THREE.MeshBasicMaterial({
  map: bandTexture(colors), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.02,
}));
const curlMaterial = (color) => once(`cm|${color}`, () => new THREE.MeshBasicMaterial({
  map: curlTexture(color), transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.1,
}));
const planeGeometry = once('plane', () => new THREE.PlaneGeometry(1, 1));
const ringMaterial = (colors, ring) => once(`rm|${colors.join(',')}|${ring}`, () => new THREE.MeshBasicMaterial({
  map: ringTexture(colors, ring), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
}));
const shardGeometry = once('shard', () => new THREE.OctahedronGeometry(1, 0).scale(0.5, 1, 0.5));
const gemGeometry = once('gem', () => new THREE.OctahedronGeometry(1, 0));

const additiveSprite = (color, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.renderOrder = 6;
  return s;
};

export class Tornado {
  // height: world (or parent) units. style: { colors, glow, ring, extra } (a spin style, or the
  // guardians' / ninjas' own colours).
  constructor(height, { colors = ['#ffffff', '#e4eef8', '#c8d6e6'], glow = '#ffffff', ring = null, extra = null, sparks = true } = {}) {
    this.root = new THREE.Group();
    this.root.visible = false;
    this.height = height;
    this.k = 0;
    this.t = Math.random() * 10;
    this.spin = new THREE.Group();
    this.spin.scale.setScalar(height);
    this.root.add(this.spin);

    // the funnel's layers
    this.layers = [...LAYERS, INNER].map((l, i) => {
      const mesh = new THREE.Mesh(layerGeometry(l), layerMaterial(colors, l[5]));
      mesh.renderOrder = 5;
      mesh.userData.speed = l[4];
      mesh.userData.inner = i === LAYERS.length;
      this.spin.add(mesh);
      return mesh;
    });
    // the curls of wind flaring out round its top, turning with it
    this.curls = new THREE.Group();
    this.spin.add(this.curls);
    CURLS.forEach(([y, r, n], row) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + row * 0.4;
        const curl = new THREE.Mesh(planeGeometry, curlMaterial(colors[(i + row) % colors.length]));
        const s = row ? 0.2 : 0.26;
        curl.scale.set(s, s, s);
        curl.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        curl.rotation.y = -a + Math.PI / 2;  // facing out of the funnel
        curl.rotation.z = -0.3;
        curl.renderOrder = 5;
        this.curls.add(curl);
      }
    });
    // the glow in its heart
    this.glow = additiveSprite(glow, 0.5);
    this.glow.scale.set(height * 0.55, height * 0.9, 1);
    this.glow.position.y = height * 0.45;
    this.root.add(this.glow);
    // the disc spinning on the ground under it (always shown)
    this.ring = new THREE.Mesh(planeGeometry, ringMaterial(colors, ring || shade(colors[0], 0.45)));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.ring.scale.setScalar(height * 1.15);
    this.ring.renderOrder = 3;
    this.root.add(this.ring);
    // magic dust rising round it
    this.dust = sparks ? Array.from({ length: DUST }, (_, i) => {
      const s = additiveSprite(i % 3 ? colors[i % colors.length] : '#ffffff');
      s.scale.setScalar(height * 0.045);
      this.root.add(s);
      return { s, t: i / DUST, a: (i / DUST) * Math.PI * 2, r: 0.15 + (i % 5) * 0.08 };
    }) : [];
    // smoke swirling round its foot (soft puffs, tinted a little with its colour)
    const smokeTint = new THREE.Color('#e8ecf2').lerp(new THREE.Color(colors[0]), 0.3);
    this.smoke = Array.from({ length: SMOKE }, (_, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: smokeTint, transparent: true, opacity: 0, depthWrite: false }));
      sp.renderOrder = 4;
      this.root.add(sp);
      return { s: sp, t: i / SMOKE, a: (i / SMOKE) * Math.PI * 2 };
    });
    // the night glow: a big soft light of its colour round it, shown as night falls
    this.nightGlow = additiveSprite(glow, 0);
    this.nightGlow.scale.set(height * 1.4, height * 1.5, 1);
    this.nightGlow.position.y = height * 0.5;
    this.root.add(this.nightGlow);
    // what flies round it
    this.extra = extra ? this.buildExtra(extra, colors, glow) : null;
  }

  buildExtra(kind, colors, glow) {
    const h = this.height;
    if (kind === 'shards' || kind === 'gems') {
      const n = kind === 'shards' ? 10 : 8;
      const mesh = new THREE.InstancedMesh(kind === 'shards' ? shardGeometry : gemGeometry,
        new THREE.MeshLambertMaterial({ emissive: shade(glow, 0.35) }), n);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) mesh.setColorAt(i, c.set(kind === 'shards' ? '#d8f4ff' : colors[i % colors.length]));
      mesh.frustumCulled = false;
      this.root.add(mesh);
      return { kind, mesh, n, pieces: Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2, y: 0.25 + (i % 4) * 0.18, r: 0.42 + (i % 3) * 0.07 })) };
    }
    // bubbles, flames, sparks, orbs: sprites
    const n = kind === 'orbs' ? 6 : 12;
    const color = kind === 'flames' ? '#ff8a1a' : kind === 'bubbles' ? '#bff0ff' : glow;
    const items = Array.from({ length: n }, (_, i) => {
      const s = additiveSprite(i % 2 ? color : '#ffffff', kind === 'bubbles' ? 0.7 : 1);
      this.root.add(s);
      return { s, t: i / n, a: (i / n) * Math.PI * 2 };
    });
    return { kind, items, h };
  }

  updateExtra(dt, fancy) {
    const e = this.extra, h = this.height, k = this.k;
    if (e.mesh) {
      e.mesh.visible = fancy;
      if (!fancy) return;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      e.pieces.forEach((pc, i) => {
        pc.a += dt * 2.6;
        p.set(Math.cos(pc.a) * h * pc.r * k, h * pc.y * k, Math.sin(pc.a) * h * pc.r * k);
        q.setFromEuler(new THREE.Euler(this.t * 2 + i, this.t * 3, 0));
        s.setScalar(h * 0.045 * k);
        e.mesh.setMatrixAt(i, m.compose(p, q, s));
      });
      e.mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    for (const it of e.items) {
      it.s.visible = fancy;
      if (!fancy) continue;
      it.t = (it.t + dt * (e.kind === 'flames' ? 0.9 : 0.45)) % 1;
      it.a += dt * (e.kind === 'orbs' ? 2 : 5);
      const r = h * (e.kind === 'orbs' ? 0.48 : 0.2 + it.t * 0.35);
      it.s.position.set(Math.cos(it.a) * r, h * (e.kind === 'orbs' ? 0.35 + Math.sin(it.t * Math.PI * 2) * 0.2 : it.t), Math.sin(it.a) * r);
      it.s.scale.setScalar(h * (e.kind === 'orbs' ? 0.1 : e.kind === 'flames' ? 0.12 * (1 - it.t) : 0.06));
      it.s.material.opacity = (e.kind === 'orbs' ? 0.9 : Math.sin(it.t * Math.PI)) * k;
    }
  }

  // on: spinning (it grows in) or not (it shrinks away and hides)
  update(dt, on) {
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * GROW_SPEED);
    this.root.visible = this.k > 0.02;
    if (!this.root.visible) return;
    this.t += dt;
    const k = this.k, h = this.height;
    this.spin.scale.set(h * (0.35 + k * 0.65), h * k, h * (0.35 + k * 0.65));
    const fancy = FX.fancy;
    for (const m of this.layers) {
      m.visible = !m.userData.inner || fancy;
      m.rotation.y += m.userData.speed * dt;
    }
    this.curls.rotation.y += 7 * dt;
    // a little wobble, like a real whirlwind
    this.spin.rotation.z = Math.sin(this.t * 2.3) * 0.06;
    this.spin.rotation.x = Math.cos(this.t * 1.7) * 0.05;
    const night = FX.night || 0;
    this.glow.material.opacity = (0.45 + night * 0.45) * k;
    this.nightGlow.material.opacity = night * 0.55 * k * (0.9 + Math.sin(this.t * 3) * 0.1);
    // the smoke: round and round its foot, rising a little and spreading out as it fades
    this.smoke.forEach((p, i) => {
      p.s.visible = fancy || i % 2 === 0;
      if (!p.s.visible) return;
      p.t = (p.t + dt * 0.35) % 1;
      p.a += dt * (3.2 - p.t * 1.5);
      const r = h * (0.25 + p.t * 0.45);
      p.s.position.set(Math.cos(p.a) * r, h * (0.04 + p.t * 0.28), Math.sin(p.a) * r);
      p.s.scale.setScalar(h * (0.22 + p.t * 0.32));
      p.s.material.opacity = Math.sin(p.t * Math.PI) * 0.5 * k;
    });
    this.ring.rotation.z -= dt * 4;
    this.ring.scale.setScalar(h * (0.6 + k * 0.55));
    this.ring.material.opacity = k;
    // the magic dust: all of it on a good device (and everywhere at night), every other grain on a weak one
    this.dust.forEach((p, i) => {
      p.s.visible = fancy || night > 0.5 || i % 2 === 0;
      if (!p.s.visible) return;
      p.t = (p.t + dt * 0.5) % 1;
      p.a += dt * 4;
      const r = h * (p.r + p.t * 0.35);
      p.s.position.set(Math.cos(p.a) * r, h * p.t * 1.05, Math.sin(p.a) * r);
      p.s.material.opacity = Math.sin(p.t * Math.PI) * k * (0.6 + 0.4 * Math.sin(this.t * 11 + i)) * (1 + night * 0.4);
    });
    if (this.extra) this.updateExtra(dt, fancy);
  }

  // Its own materials are freed a few seconds later: the game may still be compiling them in the
  // background (freeing them at once breaks that).
  dispose() {
    this.root.parent?.remove(this.root);
    const own = [];
    this.root.traverse((o) => { if (o.isSprite) own.push(o.material); });
    if (this.extra?.mesh) own.push(this.extra.mesh.material);
    setTimeout(() => own.forEach((m) => m.dispose()), 8000);
  }
}

// ------------------------------------------------------------------ the trail behind a whirlwind

// What a moving whirlwind leaves behind it, in the world (not turning with it): magic dust in its own
// colours flung out and drifting up, and puffs of smoke that linger and fade, so it has a tail. One
// Points for the dust and a small pool of smoke sprites, reused. Lighter on a weak device.
const TRAIL_DUST = 140;
const TRAIL_SMOKE = 18;
export class WhirlTrail {
  // scene: where it is drawn; size: the whirlwind's height; colors: its colours
  constructor(scene, size, colors, smokeColor = '#e8ecf2') {
    this.size = size;
    this.palette = colors.map((c) => new THREE.Color(c));
    this.pos = new Float32Array(TRAIL_DUST * 3);
    this.col = new Float32Array(TRAIL_DUST * 3);
    this.dust = Array.from({ length: TRAIL_DUST }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: this.palette[0] }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: glowMap(), size: Math.max(1.2, size * 0.09), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
    const tint = new THREE.Color(smokeColor).lerp(this.palette[0], 0.25);
    this.smoke = Array.from({ length: TRAIL_SMOKE }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: tint, transparent: true, opacity: 0, depthWrite: false }));
      s.renderOrder = 4;
      s.visible = false;
      scene.add(s);
      return { s, life: 0, max: 1, v: new THREE.Vector3() };
    });
    this.next = 0;
    this.nextSmoke = 0;
    this.last = null;
    this.acc = 0;
    this.accSmoke = 0;
  }

  // at: the whirlwind's foot in the world; k: how much of a whirlwind it is (0..1)
  update(dt, at, k) {
    const moved = this.last ? Math.hypot(at.x - this.last.x, at.z - this.last.z) : 0;
    this.last = this.last ? this.last.copy(at) : at.clone();
    const fancy = FX.fancy;
    const s = this.size;
    if (k > 0.3) {
      // dust: some all the time it spins, more as it moves fast
      const rate = FX.level >= 2 ? 60 : fancy ? 40 : 24;
      this.acc += dt * rate * k + moved * (FX.level >= 2 ? 2.2 : fancy ? 1.5 : 1);
      while (this.acc >= 1) {
        this.acc -= 1;
        const d = this.dust[this.next];
        this.next = (this.next + 1) % TRAIL_DUST;
        const a = Math.random() * Math.PI * 2, r = s * (0.15 + Math.random() * 0.35);
        d.p.set(at.x + Math.cos(a) * r, at.y + Math.random() * s * 0.9, at.z + Math.sin(a) * r);
        d.v.set(Math.cos(a) * s * (0.4 + Math.random() * 0.7), s * (0.3 + Math.random() * 0.5), Math.sin(a) * s * (0.4 + Math.random() * 0.7));
        d.max = d.life = 0.8 + Math.random() * 0.9;
        d.c = this.palette[Math.floor(Math.random() * this.palette.length)];
      }
      // smoke: a puff left behind every little way it moves (and slowly while it stands)
      this.accSmoke += dt * 2.5 * k + moved * (fancy ? 0.35 : 0.18);
      while (this.accSmoke >= 1) {
        this.accSmoke -= 1;
        const p = this.smoke[this.nextSmoke];
        this.nextSmoke = (this.nextSmoke + 1) % TRAIL_SMOKE;
        p.s.position.set(at.x + (Math.random() - 0.5) * s * 0.4, at.y + s * (0.05 + Math.random() * 0.2), at.z + (Math.random() - 0.5) * s * 0.4);
        p.v.set((Math.random() - 0.5) * s * 0.3, s * 0.15, (Math.random() - 0.5) * s * 0.3);
        p.max = p.life = 1.4 + Math.random() * 0.8;
        p.s.visible = true;
      }
    }
    for (let i = 0; i < TRAIL_DUST; i++) {
      const d = this.dust[i];
      if (d.life > 0) {
        d.life -= dt;
        d.v.multiplyScalar(1 - dt * 1.6);
        d.p.addScaledVector(d.v, dt);
      }
      const f = Math.max(0, d.life / d.max);
      const tw = f * (0.6 + 0.4 * Math.sin(d.life * 25 + i));
      this.pos[i * 3] = d.p.x; this.pos[i * 3 + 1] = d.p.y; this.pos[i * 3 + 2] = d.p.z;
      this.col[i * 3] = d.c.r * tw; this.col[i * 3 + 1] = d.c.g * tw; this.col[i * 3 + 2] = d.c.b * tw;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (const p of this.smoke) {
      if (!p.s.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const f = p.life / p.max;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(s * (0.3 + (1 - f) * 0.5));
      p.s.material.opacity = Math.sin(f * Math.PI) * 0.45;
    }
  }

  dispose() {
    this.points.parent?.remove(this.points);
    for (const p of this.smoke) p.s.parent?.remove(p.s);
  }
}
