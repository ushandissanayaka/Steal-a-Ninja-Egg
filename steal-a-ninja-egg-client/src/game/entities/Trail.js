// The trail bought in the Trails Shop: a wide glowing ribbon streaming behind the player as they
// move, with a bright core down its middle, fading and narrowing at its tail, and (on good quality)
// sparkles of the trail's colours falling off it. The ribbon always turns its face to the camera,
// so it is clearly seen from any side, also from straight behind the player. Lives in world space:
// `mesh` (a group: ribbon + sparkles) is added to the scene, not to the player.

import * as THREE from 'three';
import { glowMap } from './Effects.js';

const MAX_POINTS = 44;
const LIFE = 1.0;          // seconds a point of the ribbon lasts
const MIN_STEP = 0.45;     // world units moved before a new point is added
const MAX_LENGTH = 22;     // the longest the ribbon gets (the camera is about this far behind)
const TELEPORT = 30;       // a jump this big in one frame is a teleport, not a run
const MID = 1.9;           // the ribbon's middle, above the feet
const HALF_WIDTH = 1.9;    // half the ribbon's width at the player
const ACROSS = 3;          // vertices across the ribbon: edge, core, edge
const SPARKS = 60;
const SPARK_LIFE = 0.9;

const _d = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const WHITE = new THREE.Color('#ffffff');
const _c = new THREE.Color();

export class TrailRibbon {
  static camera = null;     // set by Game: the ribbon faces it
  static sparkles = true;   // off on Low quality

  constructor() {
    this.points = []; // { x, y, z, age }
    this.style = null;
    this.colors = [];
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_POINTS * ACROSS * 3);
    this.vertexColors = new Float32Array(MAX_POINTS * ACROSS * 4);
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.vertexColors, 4));
    const index = [];
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      for (let j = 0; j < ACROSS - 1; j++) {
        const a = i * ACROSS + j, b = a + ACROSS;
        index.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    geometry.setIndex(index);
    this.ribbon = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    }));
    this.ribbon.frustumCulled = false;
    this.ribbon.renderOrder = 3;

    // the sparkles: little glowing specks dropped along the trail, drifting and fading
    this.sparks = [];
    const sg = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(SPARKS * 3);
    this.sparkCol = new Float32Array(SPARKS * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.sparkPoints = new THREE.Points(sg, new THREE.PointsMaterial({
      map: glowMap(), size: 1.6, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    }));
    this.sparkPoints.frustumCulled = false;
    this.sparkPoints.renderOrder = 4;
    this.sparkTimer = 0;

    this.mesh = new THREE.Group();
    this.mesh.add(this.ribbon, this.sparkPoints);
    this.mesh.visible = false;
  }

  // style: a TRAILS entry, or null for none
  setStyle(style) {
    if (style?.id === this.style?.id) return;
    this.style = style;
    this.colors = (style?.colors || []).map((c) => new THREE.Color(c));
    this.points.length = 0;
    this.sparks.length = 0;
    this.mesh.visible = !!style;
  }

  update(dt, pos) {
    if (!this.style) return;
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points[0].age > LIFE) this.points.shift();
    let last = this.points[this.points.length - 1];
    const step = last ? Math.hypot(pos.x - last.x, pos.z - last.z, pos.y - last.y) : 0;
    if (step > TELEPORT + 200 * dt) { this.points.length = 0; last = null; } // teleported: start a new trail
    const moved = !last || step > MIN_STEP;
    if (moved) {
      this.points.push({ x: pos.x, y: pos.y, z: pos.z, age: 0 });
      if (this.points.length > MAX_POINTS) this.points.shift();
    } else {
      last.x = pos.x; last.y = pos.y; last.z = pos.z; // the head follows the player
    }
    // at most MAX_LENGTH long (fast runners): it stays between the player and the camera, in view
    let length = 0;
    for (let i = this.points.length - 1; i > 0; i--) {
      const a = this.points[i], b = this.points[i - 1];
      length += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (length > MAX_LENGTH) { this.points.splice(0, i - 1); break; }
    }
    this.build();
    this.updateSparks(dt, pos, moved);
  }

  // the ribbon's colour at t (0 tail .. 1 head), stripes for zebra
  colorAt(i, t) {
    if (this.style.id === 'zebra') return this.colors[Math.floor(i / 2) % 2];
    const count = this.colors.length;
    return this.colors[Math.max(0, Math.min(count - 1, Math.floor((1 - t) * count)))];
  }

  build() {
    const n = this.points.length;
    const g = this.ribbon.geometry;
    const cam = TrailRibbon.camera?.position;
    const zebra = this.style.id === 'zebra';
    for (let i = 0; i < MAX_POINTS; i++) {
      const p = this.points[Math.min(i, n - 1)] || { x: 0, y: -999, z: 0, age: LIFE };
      // which way the ribbon runs here, and the sideways direction facing the camera
      const a = this.points[Math.max(0, Math.min(i, n - 1) - 1)] || p;
      const b = this.points[Math.min(n - 1, i + 1)] || p;
      _d.set(b.x - a.x, b.y - a.y, b.z - a.z);
      if (_d.lengthSq() < 1e-6) _d.set(0, 0, 1);
      _d.normalize();
      if (cam) _v.set(cam.x - p.x, cam.y - (p.y + MID), cam.z - p.z).normalize();
      else _v.set(0, 1, 0);
      _s.crossVectors(_d, _v);
      if (_s.lengthSq() < 1e-6) _s.set(0, 1, 0);
      _s.normalize();
      // t: 0 at the tail .. 1 at the head (clamped: unused slots past the newest point stay valid)
      const t = n > 1 ? Math.min(1, i / (n - 1)) : 1;
      const live = i < n ? Math.max(0, 1 - p.age / LIFE) : 0;
      const w = HALF_WIDTH * (0.25 + 0.75 * t) * (0.4 + 0.6 * live); // narrows towards the tail
      const alpha = Math.sqrt(live) * Math.min(1, t * 2 + 0.3);
      const c = this.colorAt(i, t);
      for (let j = 0; j < ACROSS; j++) {
        const side = j - 1; // -1 edge, 0 core, 1 edge
        const k = (i * ACROSS + j) * 3;
        this.positions[k] = p.x + _s.x * w * side;
        this.positions[k + 1] = p.y + MID + _s.y * w * side;
        this.positions[k + 2] = p.z + _s.z * w * side;
        // the core is brighter (a little whiter) and solid, the edges softer
        const core = side === 0;
        _c.copy(c);
        if (core && !zebra) _c.lerp(WHITE, 0.45);
        const ck = (i * ACROSS + j) * 4;
        this.vertexColors[ck] = _c.r; this.vertexColors[ck + 1] = _c.g; this.vertexColors[ck + 2] = _c.b;
        this.vertexColors[ck + 3] = alpha * (core ? 1 : 0.8);
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  updateSparks(dt, pos, moving) {
    const on = TrailRibbon.sparkles && this.colors.length;
    this.sparkPoints.visible = !!on;
    if (!on) return;
    // new sparkles while running
    this.sparkTimer += dt;
    while (moving && this.sparkTimer > 0.03 && this.sparks.length < SPARKS) {
      this.sparkTimer -= 0.03;
      const c = this.colors[(Math.random() * this.colors.length) | 0];
      this.sparks.push({
        x: pos.x + (Math.random() - 0.5) * 2, y: pos.y + MID + (Math.random() - 0.5) * 2.4, z: pos.z + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, age: 0, c,
      });
    }
    if (!moving) this.sparkTimer = 0;
    for (const s of this.sparks) {
      s.age += dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.vy -= 1.5 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.age < SPARK_LIFE);
    for (let i = 0; i < SPARKS; i++) {
      const s = this.sparks[i];
      const k = i * 3;
      if (!s) { this.sparkPos[k + 1] = -9999; continue; }
      this.sparkPos[k] = s.x; this.sparkPos[k + 1] = s.y; this.sparkPos[k + 2] = s.z;
      const f = 1 - s.age / SPARK_LIFE; // fading out (additive: darker = fainter)
      this.sparkCol[k] = s.c.r * f; this.sparkCol[k + 1] = s.c.g * f; this.sparkCol[k + 2] = s.c.b * f;
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true;
    this.sparkPoints.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.mesh.parent?.remove(this.mesh);
    this.ribbon.geometry.dispose();
    this.ribbon.material.dispose();
    this.sparkPoints.geometry.dispose();
    this.sparkPoints.material.dispose();
  }
}
