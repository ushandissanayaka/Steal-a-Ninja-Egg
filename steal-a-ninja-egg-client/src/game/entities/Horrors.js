// The guardians from the second biome on: big, realistic horrors instead of block models.
// Smooth organic flesh (noise-displaced, mottled and veined, some veins glowing), many wet eyes
// with lids that close while the guardian sleeps and that follow the player once it is awake,
// rows of teeth in a jaw that gapes when it wakes, long fingers with claws, and a dim aura
// outline so each one stands out from far away.
//
// buildHorror(type) -> { root, update({ t, open, awake, run, viewer }) }. Models face +Z and stand
// on y = 0, like the voxel ones; GuardianView scales them.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Z = V(0, 0, 1), Y = V(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _c = new THREE.Color(), _c2 = new THREE.Color(), _vc = new THREE.Color();
const _q = new THREE.Quaternion();

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// smooth pseudo-noise in about [-1, 1]
function noise(x, y, z, s) {
  return (Math.sin(x * 1.7 + s) * Math.sin(y * 2.3 + s * 1.3) * Math.sin(z * 1.9 + s * 0.7)
    + 0.5 * Math.sin(x * 4.1 + y * 3.7 + s * 2) * Math.sin(z * 4.3 - y * 2.9 + s)
    + 0.25 * Math.sin(x * 9.3 - z * 7.1 + s * 3) * Math.sin(y * 8.7 + s * 0.3)) / 1.2;
}

// ------------------------------------------------------------------ materials

// glow: a per-vertex attribute (0..1+) that lights the vertex colour up (eyes, neon).
// veins: thin wandering lines drawn per pixel from the model-space position (vein = colour + how
// much it glows, veinF = their frequency, 0 = none), so they stay sharp however coarse the mesh is.
const VEINS = `
  float veinGlow = 0.0;
  if (vVeinF > 0.0) {
    vec3 p = vObj * vVeinF;
    float n = sin(p.x + sin(p.y * 1.7) * 1.5) + sin(p.z * 1.3 + sin(p.x * 0.9) * 1.5) + 0.6 * sin(p.y * 2.1 + sin(p.z * 1.9) * 1.2);
    float w = fwidth(n) * 1.2 + 0.09;
    float m = 1.0 - smoothstep(0.0, w, abs(n));
    diffuseColor.rgb = mix(diffuseColor.rgb, vVein.rgb, m);
    veinGlow = m * vVein.a;
  }`;
function glowPatch(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float glow;\nattribute vec4 vein;\nattribute float veinF;\nvarying float vGlow;\nvarying vec4 vVein;\nvarying float vVeinF;\nvarying vec3 vObj;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow; vVein = vein; vVeinF = veinF; vObj = position;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vGlow;\nvarying vec4 vVein;\nvarying float vVeinF;\nvarying vec3 vObj;')
    .replace('#include <color_fragment>', `#include <color_fragment>${VEINS}`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * 1.6 + vVein.rgb * veinGlow * 1.8;');
}

const MATS = {};
function mat(kind) {
  if (!MATS[kind]) {
    const o = { vertexColors: true, roughness: 0.78, metalness: 0.02 };
    if (kind === 'wet') Object.assign(o, { roughness: 0.48 });
    if (kind === 'metal') Object.assign(o, { roughness: 0.62, metalness: 0.55 });
    if (kind === 'membrane') Object.assign(o, { side: THREE.DoubleSide, roughness: 0.7 });
    if (kind === 'ghost') Object.assign(o, { roughness: 0.85, side: THREE.DoubleSide });
    if (kind === 'eye') Object.assign(o, { roughness: 0.1 });
    const m = new THREE.MeshStandardMaterial(o);
    m.onBeforeCompile = glowPatch;
    m.customProgramCacheKey = () => 'horror-glow';
    MATS[kind] = m;
  }
  return MATS[kind];
}

// the aura: the back faces pushed out along the normals, in one flat colour
const OUTLINE_WIDTH = 0.06;
const outlines = new Map();
function outlineMat(color) {
  if (!outlines.has(color)) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE_WIDTH.toFixed(3)};`);
    };
    m.customProgramCacheKey = () => 'horror-outline';
    outlines.set(color, m);
  }
  return outlines.get(color);
}

// ------------------------------------------------------------------ geometry

// Turns any geometry into flesh: welded, displaced by noise along its normals, smooth normals,
// mottled vertex colours (color -> color2), veins (optionally glowing) and the glow attribute.
// o: { color, color2, amp, freq, mottle, seed, glow, veins: { color, width, freq, glow } }
function flesh(g, o = {}) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position;
  const seed = o.seed ?? 1, f = o.freq ?? 1.2;
  if (o.amp) {
    g.computeVertexNormals();
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = noise(x * f, y * f, z * f, seed) * o.amp;
      pos.setXYZ(i, x + nor.getX(i) * n, y + nor.getY(i) * n, z + nor.getZ(i) * n);
    }
  }
  g.computeVertexNormals();
  _c.set(o.color || '#888888');
  _c2.set(o.color2 || '#333333');
  const vein = o.veins ? new THREE.Color(o.veins.color) : null;
  const col = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count);
  const veinA = new Float32Array(pos.count * 4), veinF = new Float32Array(pos.count);
  const mottle = o.mottle ?? 0.22;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = noise(x * f * 2.3 + 3, y * f * 2.3, z * f * 2.3, seed + 7);
    _vc.copy(_c).lerp(_c2, Math.min(1, Math.max(0, 0.5 + k * 0.7)));
    _vc.multiplyScalar(1 + k * mottle);
    let gl = o.glow || 0;
    if (vein) {
      veinA[i * 4] = vein.r; veinA[i * 4 + 1] = vein.g; veinA[i * 4 + 2] = vein.b; veinA[i * 4 + 3] = o.veins.glow || 0;
      veinF[i] = (o.veins.freq ?? 1.5) * 2.2;
    }
    col[i * 3] = _vc.r; col[i * 3 + 1] = _vc.g; col[i * 3 + 2] = _vc.b;
    glow[i] = gl;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
  g.setAttribute('vein', new THREE.BufferAttribute(veinA, 4));
  g.setAttribute('veinF', new THREE.BufferAttribute(veinF, 1));
  return g;
}

// an ellipsoid; r = [rx, ry, rz]
function blob(c, r, o = {}) {
  const g = new THREE.SphereGeometry(1, o.seg ?? 30, o.rows ?? 20);
  g.scale(r[0], r[1], r[2]);
  if (o.rot) g.applyQuaternion(_q.setFromEuler(new THREE.Euler(...o.rot)));
  g.translate(c.x, c.y, c.z);
  return flesh(g, o);
}

// a point on an (unrotated) blob's surface, displaced the way flesh() displaced it, and its normal
function onBlob(c, r, o, az, el, inset = 0) {
  const d = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const p = V(c.x + d.x * r[0], c.y + d.y * r[1], c.z + d.z * r[2]);
  const n = V(d.x / r[0], d.y / r[1], d.z / r[2]).normalize();
  const f = o.freq ?? 1.2;
  if (o.amp) p.addScaledVector(n, noise(p.x * f, p.y * f, p.z * f, o.seed ?? 1) * o.amp);
  return { p: p.addScaledVector(n, -inset), n };
}

// a tapered tube along a smooth curve, closed at both ends
function limb(pts, r0, r1, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const tub = o.tub ?? Math.max(8, Math.round(curve.getLength() * 3)), rad = o.rad ?? 10;
  const g = new THREE.TubeGeometry(curve, tub, 1, rad, false);
  const pos = g.attributes.position, P = new THREE.Vector3(), v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    const i = Math.floor(k / (rad + 1)), t = i / tub;
    curve.getPointAt(t, P);
    const r = (r0 + (r1 - r0) * t) * (1 + (o.bulge ?? 0) * Math.sin(Math.PI * t));
    v.fromBufferAttribute(pos, k).sub(P).multiplyScalar(r).add(P);
    pos.setXYZ(k, v.x, v.y, v.z);
  }
  const a = new THREE.SphereGeometry(r0, rad, 6).translate(pts[0].x, pts[0].y, pts[0].z);
  const e = pts[pts.length - 1];
  const b = new THREE.SphereGeometry(Math.max(r1, 0.01), rad, 6).translate(e.x, e.y, e.z);
  return flesh(mergeGeometries([g, a, b]), o);
}

// a cone from base to tip (teeth, claws, spikes, shards)
function cone(base, tip, r, o = {}) {
  const dir = _a.copy(tip).sub(base);
  const len = dir.length();
  const g = new THREE.ConeGeometry(r, len, o.rad ?? 8, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(Y, dir.normalize()));
  g.translate(base.x, base.y, base.z);
  return flesh(g, { mottle: 0.12, ...o, amp: 0 });
}

// a solid of revolution around Y: profile = [[radius, y], ...]
function lathe(profile, c, o = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), o.seg ?? 36);
  if (o.rot) g.applyQuaternion(_q.setFromEuler(new THREE.Euler(...o.rot)));
  g.translate(c.x, c.y, c.z);
  return flesh(g, o);
}

// a hanging cloth (cape, rags): from a row of top points, falling along `drop`, ragged at the bottom
function sheet(tops, drop, len, o = {}) {
  const rows = 10, cols = tops.length, rand = rng(o.seed ?? 3);
  const pos = [], idx = [];
  const lens = tops.map(() => len * (0.72 + 0.28 * rand()));
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      const p = tops[j].clone().addScaledVector(drop, lens[j] * t);
      p.z -= Math.sin(t * Math.PI * 0.5) * (o.billow ?? 0.6);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < cols - 1; j++) {
    for (let i = 0; i < rows; i++) {
      const a = j * (rows + 1) + i, b = a + rows + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return flesh(g, o);
}

// a bat-wing membrane: a fan from the root to the finger tips, sagging between them
function membrane(root, tips, o = {}) {
  const pos = [root.x, root.y, root.z], idx = [];
  tips.forEach((t) => pos.push(t.x, t.y, t.z));
  for (let i = 0; i < tips.length - 1; i++) {
    const m = tips[i].clone().lerp(tips[i + 1], 0.5).lerp(root, o.sag ?? 0.3);
    pos.push(m.x, m.y, m.z);
    const mi = pos.length / 3 - 1;
    idx.push(0, i + 1, mi, 0, mi, i + 2, i + 1, i + 2, mi);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return flesh(g, o);
}

// a blade: flat, tapering to a point, from the grip along dir
function blade(grip, dir, len, w, o = {}) {
  const g = new THREE.BoxGeometry(w, len, w * 0.16, 1, 12, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), tipStart = len / 2 - w * 1.4;
    if (y > tipStart) pos.setX(i, pos.getX(i) * Math.max(0.02, (len / 2 - y) / (w * 1.4)));
  }
  g.translate(0, len / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(Y, dir.clone().normalize()));
  g.translate(grip.x, grip.y, grip.z);
  return flesh(g, o);
}

// ------------------------------------------------------------------ eyes

const eyeGeoms = new Map();
function eyeGeometry(r, o) {
  const key = JSON.stringify([r, o.iris, o.sclera, o.irisSize, o.pupil, o.pupilSize]);
  if (!eyeGeoms.has(key)) {
    const parts = [];
    parts.push(flesh(new THREE.SphereGeometry(r, 20, 14), {
      color: o.sclera ?? '#ddd3bb', color2: '#a89880', mottle: 0.1, freq: 3 / r, veins: { color: '#9a1010', width: 0.1, freq: 2.2 / r }, glow: o.scleraGlow ?? 0.08,
    }));
    const irisCap = (o.irisSize ?? 0.62);
    parts.push(flesh(new THREE.SphereGeometry(r * 1.012, 20, 6, 0, Math.PI * 2, 0, irisCap).rotateX(Math.PI / 2), {
      color: o.iris ?? '#ffcc22', color2: o.iris2 ?? '#6a2a00', mottle: 0.3, freq: 6 / r, glow: o.irisGlow ?? 1,
    }));
    if (o.pupil !== 'none') {
      const pupil = new THREE.SphereGeometry(r * 1.024, 16, 4, 0, Math.PI * 2, 0, o.pupilSize ?? 0.26).rotateX(Math.PI / 2);
      if (o.pupil === 'slit') {
        const p = pupil.attributes.position;
        for (let i = 0; i < p.count; i++) {
          _a.fromBufferAttribute(p, i);
          _a.x *= 0.3;
          _a.setLength(r * 1.024);
          p.setXYZ(i, _a.x, _a.y, _a.z);
        }
      }
      parts.push(flesh(pupil, { color: '#050304', color2: '#000000', mottle: 0 }));
    }
    // the wet glint
    parts.push(flesh(new THREE.SphereGeometry(r * 1.03, 8, 3, 0, Math.PI * 2, 0, 0.13).rotateX(Math.PI / 2 - 0.4).rotateY(-0.35), {
      color: '#ffffff', color2: '#ffffff', mottle: 0, glow: 1.2,
    }));
    eyeGeoms.set(key, mergeGeometries(parts));
  }
  return eyeGeoms.get(key);
}

function lidGeometry(r, skin) {
  return flesh(new THREE.SphereGeometry(r * 1.09, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2 + 0.22), { ...skin, amp: 0, veins: undefined, glow: 0 });
}

// ------------------------------------------------------------------ the rig

// Collects geometry per (part, material) and merges each into one mesh. Parts are groups with a
// pivot (shoulder, hip, jaw hinge...) that the update swings.
class Rig {
  constructor(seed, aura) {
    this.root = new THREE.Group();
    this.aura = aura;
    this.rand = rng(seed);
    this.seedN = seed;
    this.buckets = new Map();
    this.parts = new Map([['', { group: this.root, pivot: V(0, 0, 0) }]]);
    this.eyes = [];
    this.anim = [];
  }

  seed() { return (this.seedN = (this.seedN * 31 + 7) % 997); }

  part(name, pivot, parent = '') {
    const p = this.parts.get(parent);
    const g = new THREE.Group();
    g.position.copy(pivot).sub(p.pivot);
    p.group.add(g);
    this.parts.set(name, { group: g, pivot: pivot.clone() });
    return name;
  }

  add(geom, kind = 'skin', part = '', outline = true) {
    const p = this.parts.get(part);
    geom.translate(-p.pivot.x, -p.pivot.y, -p.pivot.z);
    const key = `${part}|${kind}|${outline ? 1 : 0}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { part, kind, outline, list: [] });
    this.buckets.get(key).list.push(geom);
  }

  // rotation[axis] = base + sin(t * speed + phase) * (idle..awake, + run) + open * awake
  swing(part, axis, o) {
    const g = this.parts.get(part).group;
    this.anim.push({ g, axis, base: g.rotation[axis], idle: 0, awake: 0, run: 0, open: 0, speed: 1, phase: 0, ...o });
  }

  jitter(part, amount) {
    const g = this.parts.get(part).group;
    this.anim.push({ g, jitter: amount, home: g.position.clone() });
  }

  // an eye at pos looking along normal; o: iris, iris2, sclera, irisSize, pupil ('round'|'slit'|'none'),
  // pupilSize, skin (the lid's flesh), stretch [sx, sy], tilt (around the view axis)
  eye(pos, normal, r, o = {}, part = '') {
    const p = this.parts.get(part);
    const g = new THREE.Group();
    g.position.copy(pos).sub(p.pivot);
    g.quaternion.setFromUnitVectors(Z, _b.copy(normal).normalize());
    if (o.tilt) g.rotateZ(o.tilt);
    if (o.stretch) g.scale.set(o.stretch[0], o.stretch[1], 1);
    p.group.add(g);
    const ball = new THREE.Mesh(eyeGeometry(r, o), mat('eye'));
    const lid = new THREE.Mesh(lidGeometry(r, o.skin || { color: '#5a4a44', color2: '#2a1a14' }), mat('membrane'));
    g.add(ball, lid);
    this.eyes.push({ ball, lid, opened: o.hood ?? -0.5, closed: Math.PI / 2 });
  }

  build() {
    for (const { part, kind, outline, list } of this.buckets.values()) {
      const geo = mergeGeometries(list);
      const group = this.parts.get(part).group;
      const mesh = new THREE.Mesh(geo, mat(kind));
      mesh.castShadow = true;
      group.add(mesh);
      if (outline && this.aura) group.add(new THREE.Mesh(geo, outlineMat(this.aura)));
    }
    return {
      root: this.root,
      update: (s) => this.update(s),
    };
  }

  update({ t, open, awake, run, roar = 0, viewer }) {
    for (const e of this.eyes) {
      e.lid.rotation.x = e.closed + (e.opened - e.closed) * open;
      // awake and near: the eyes roll round to follow the player
      if (viewer && open > 0.4) {
        _q.copy(e.ball.quaternion);
        e.ball.lookAt(viewer);
        _want.copy(e.ball.quaternion);
        e.ball.quaternion.copy(_q).slerp(_want, 0.15);
      } else {
        e.ball.quaternion.slerp(IDENTITY, 0.1);
      }
    }
    for (const a of this.anim) {
      if (a.jitter !== undefined) {
        if (Math.random() < 0.02 + 0.08 * awake) {
          a.g.position.set(a.home.x + (Math.random() - 0.5) * a.jitter, a.home.y + (Math.random() - 0.5) * a.jitter, a.home.z + (Math.random() - 0.5) * a.jitter);
        } else if (Math.random() < 0.3) a.g.position.copy(a.home);
        continue;
      }
      const amp = a.idle + (a.awake - a.idle) * awake + a.run * run;
      a.g.rotation[a.axis] = a.base + Math.sin(t * a.speed + a.phase) * amp + a.open * awake * (1 + roar * 1.6); // the jaw gapes wider as it roars
    }
  }
}

const IDENTITY = new THREE.Quaternion();
const _want = new THREE.Quaternion();

// ------------------------------------------------------------------ anatomy helpers

const mx = (a, side) => V(a[0] * side, a[1], a[2]);

// An arm on its own part (swings at the shoulder): shoulder, upper arm, forearm, hand, fingers, claws.
// o: { shoulder, elbow, wrist, r: [r0, r1, r2], skin, handSkin, kind, fingers, fingerLen, fingerR,
//      claw, clawColor, hand, parent, detach (gap from the shoulder) }
function arm(R, side, o) {
  const S = mx(o.shoulder, side), E = mx(o.elbow, side), W = mx(o.wrist, side);
  const name = R.part(`arm${side}`, S, o.parent ?? '');
  const sk = { ...o.skin, seed: R.seed() }, kind = o.kind ?? 'skin';
  const hs = { ...(o.handSkin || o.skin), seed: R.seed() };
  R.add(blob(S, [o.r[0] * 1.3, o.r[0] * 1.2, o.r[0] * 1.25], sk), kind, name);
  R.add(limb([S, S.clone().lerp(E, 0.5).add(V(0.15 * side, 0, -0.1)), E], o.r[0], o.r[1], { ...sk, bulge: 0.22 }), kind, name);
  R.add(limb([E, E.clone().lerp(W, 0.5).add(V(0, 0, 0.1)), W], o.r[1], o.r[2], { ...sk, bulge: 0.15 }), kind, name);
  const d = W.clone().sub(E).normalize();
  const h = o.hand ?? o.r[2] * 1.6;
  const across = V(0, 0, 1).cross(d).normalize();
  if (across.lengthSq() < 0.01) across.set(1, 0, 0);
  const palm = d.clone().cross(across).normalize();
  R.add(blob(W.clone().addScaledVector(d, h * 0.5), [h * 0.75, h * 0.95, h * 0.6], hs), o.handKind ?? kind, name);
  const n = o.fingers ?? 4;
  for (let f = 0; f < n; f++) {
    const s = n > 1 ? f / (n - 1) - 0.5 : 0;
    const fd = d.clone().addScaledVector(Z, s * 1.4).normalize();
    const K = W.clone().addScaledVector(d, h * 0.95).addScaledVector(Z, s * h * 1.3);
    const curl = fd.clone().addScaledVector(palm, -0.55 * side).addScaledVector(Z, 0.25).normalize();
    const M = K.clone().addScaledVector(fd, o.fingerLen * 0.55);
    const T = M.clone().addScaledVector(curl, o.fingerLen * 0.45);
    R.add(limb([K, M, T], o.fingerR, o.fingerR * 0.75, { ...hs, amp: 0, tub: 10, rad: 7 }), o.handKind ?? kind, name, false);
    if (o.claw) {
      const tip = T.clone().addScaledVector(curl.clone().addScaledVector(palm, -0.4 * side).normalize(), o.claw);
      R.add(cone(T, tip, o.fingerR * 0.8, { color: o.clawColor ?? '#1a1414', color2: '#000000', glow: o.clawGlow ?? 0 }), 'wet', name, false);
    }
  }
  R.swing(name, 'x', { idle: 0.04, awake: 0.1, run: 0.55, speed: 1.2, phase: side > 0 ? 0 : Math.PI });
  R.swing(name, 'z', { idle: 0.03, awake: 0.07, speed: 0.8, phase: side * 1.3 });
  return { name, S, E, W };
}

// A leg on its own part (swings at the hip) through the given joints, a foot and toe claws.
// o: { pts: [hip, knee, ..., ankle], r: [r0, r1, r2], skin, kind, foot: [rx, ry, rz], footSkin, toes, claw }
function leg(R, side, o) {
  const P = o.pts.map((p) => mx(p, side));
  const name = R.part(`leg${side}`, P[0], o.parent ?? '');
  const sk = { ...o.skin, seed: R.seed() }, kind = o.kind ?? 'skin';
  R.add(blob(P[0], [o.r[0] * 1.2, o.r[0] * 1.1, o.r[0] * 1.2], sk), kind, name);
  for (let i = 0; i < P.length - 1; i++) {
    const r0 = o.r[Math.min(i, o.r.length - 1)], r1 = o.r[Math.min(i + 1, o.r.length - 1)];
    R.add(limb([P[i], P[i].clone().lerp(P[i + 1], 0.5).add(V(0, 0, i % 2 ? -0.1 : 0.15)), P[i + 1]], r0, r1, { ...sk, bulge: i === 0 ? 0.25 : 0.12 }), kind, name);
  }
  const A = P[P.length - 1];
  const fs = o.foot ?? [o.r[2] * 1.3, o.r[2] * 0.8, o.r[2] * 2.2];
  const fsk = { ...(o.footSkin || o.skin), seed: R.seed() };
  const F = A.clone().add(V(0, -fs[1] * 0.35, fs[2] * 0.45));
  if (o.hoof) R.add(lathe([[0.01, 0], [o.hoof, 0], [o.hoof * 0.8, o.hoof * 1.1], [0.01, o.hoof * 1.2]], A.clone().add(V(0, -o.hoof * 1.1, 0.05)), { ...fsk, seg: 16 }), o.footKind ?? kind, name);
  else R.add(blob(F, fs, fsk), o.footKind ?? kind, name);
  const toes = o.toes ?? 3;
  for (let t = 0; t < toes; t++) {
    const s = toes > 1 ? t / (toes - 1) - 0.5 : 0;
    const base = F.clone().add(V(s * fs[0] * 1.3, -fs[1] * 0.3, fs[2] * 0.85));
    if (o.claw) R.add(cone(base, base.clone().add(V(s * 0.3, -0.25, o.claw)), Math.min(0.25, fs[0] * 0.22), { color: o.clawColor ?? '#1a1414', color2: '#000' }), 'wet', name, false);
  }
  R.swing(name, 'x', { run: 0.5, speed: 1.2, phase: side > 0 ? Math.PI : 0 });
  return { name, P };
}

// a row of teeth along an arc: centre c, width w, n teeth of length len pointing along dir
function teethRow(R, part, c, w, n, len, dir, o = {}) {
  const rand = R.rand;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    const curve = o.curve ?? 0.25;
    const base = V(c.x + x, c.y, c.z - (x * x) * curve);
    const l = len * (0.6 + 0.6 * rand()) * (o.fangs && (i === 1 || i === n - 2) ? 1.8 : 1);
    const tip = base.clone().addScaledVector(dir, l).add(V((rand() - 0.5) * 0.1, 0, (rand() - 0.5) * 0.1));
    R.add(cone(base, tip, (o.r ?? 0.08) * (0.8 + 0.4 * rand()), { color: o.color ?? '#e6dcc0', color2: o.color2 ?? '#8a7a50' }), 'wet', part, false);
  }
}

// many eyes over a blob; avoid(az, el) -> true skips a spot
function eyesOver(R, part, c, r, o, n, size, eyeOpts, avoid = () => false) {
  let placed = 0, tries = 0;
  const taken = [];
  while (placed < n && tries++ < n * 40) {
    const az = (R.rand() * 2 - 1) * (eyeOpts.az ?? Math.PI);
    const el = (eyeOpts.elMin ?? -0.2) + R.rand() * ((eyeOpts.elMax ?? 1) - (eyeOpts.elMin ?? -0.2));
    if (avoid(az, el)) continue;
    const s = size[0] + R.rand() * (size[1] - size[0]);
    const { p, n: nor } = onBlob(c, r, o, az, el, s * 0.5);
    if (taken.some(([q, qs]) => q.distanceTo(p) < (qs + s) * 1.25)) continue; // eyes never overlap
    taken.push([p, s]);
    const iris = Array.isArray(eyeOpts.iris) ? eyeOpts.iris[Math.floor(R.rand() * eyeOpts.iris.length)] : eyeOpts.iris;
    R.eye(p, nor, s, { ...eyeOpts, iris }, part);
    placed++;
  }
}

// ------------------------------------------------------------------ the horrors

const DARK = '#0b0606';

const HORROR_BUILDERS = {
  // Candy Lane: a gaunt candy-pink specter with a swollen skull, two huge black almond eyes and a
  // crown of small red ones, a needle-toothed slit mouth, arms to the ground and a wisp for legs
  sugarSpecter() {
    const R = new Rig(11, '#5a0a3a');
    const SK = { color: '#e0a6bc', color2: '#7a3a58', amp: 0.06, freq: 1.1, mottle: 0.25, veins: { color: '#c0306a', width: 0.06, freq: 1.3, glow: 0.25 } };
    R.add(limb([V(0, 0.4, -1.8), V(0, 1.6, -0.9), V(0, 3.4, -0.1), V(0, 5.2, 0)], 0.15, 1.3, { ...SK, seed: 2 }), 'wet');
    R.add(blob(V(0, 5.4, 0), [1.45, 1, 1.1], { ...SK, seed: 3 }), 'wet');
    R.add(limb([V(0, 5.6, 0), V(0, 6.6, 0.1), V(0, 7.6, 0)], 1.0, 1.15, { ...SK, bulge: -0.25, seed: 4 }), 'wet');
    R.add(blob(V(0, 8.3, 0.05), [1.75, 1.45, 1.15], { ...SK, seed: 5 }), 'wet');
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) R.add(limb([V(0.25 * s, 7.5 + i * 0.4, 1.1), V(1.3 * s, 7.6 + i * 0.4, 0.75), V(1.7 * s, 7.7 + i * 0.4, 0)], 0.1, 0.07, { color: '#f4c8d8', color2: '#b0708a' }), 'wet', '', false);
    }
    for (let i = 0; i < 6; i++) R.add(blob(V(0, 5.9 + i * 0.6, -1.0 - Math.sin(i / 2) * 0.1), [0.28, 0.24, 0.24], { ...SK, amp: 0 }), 'wet', '', false);
    R.add(limb([V(0, 9.2, 0), V(0, 10.1, 0.25), V(0, 10.9, 0.55)], 0.48, 0.4, { ...SK, seed: 6 }), 'wet');
    const head = R.part('head', V(0, 10.7, 0.45));
    const HS = { ...SK, amp: 0.04, seed: 9 };
    R.add(blob(V(0, 12.7, -0.3), [2.1, 2.4, 2.7], { ...HS, rot: [-0.5, 0, 0] }), 'wet', head);
    const FACE = [1.45, 1.35, 1.35], FC = V(0, 11.5, 1.05);
    R.add(blob(FC, FACE, HS), 'wet', head);
    for (const s of [-1, 1]) {
      const { p, n } = onBlob(FC, FACE, HS, s * 0.48, 0.28, 0.2);
      R.eye(p, n, 0.55, { iris: '#060608', iris2: '#000', irisSize: 1.35, pupil: 'none', irisGlow: 0, stretch: [1.45, 0.7], tilt: s * 0.45, skin: SK, hood: -0.35 }, head);
    }
    const SKULL = [2.1, 2.4, 2.7], SC = V(0, 12.9, -0.2);
    eyesOver(R, head, SC, SKULL, HS, 10, [0.2, 0.34], { iris: '#ff1f3f', pupil: 'slit', skin: SK, az: 1.1, elMin: 0.05, elMax: 0.8 });
    const jaw = R.part('jaw', V(0, 11.0, 0.6), head);
    R.add(blob(V(0, 10.75, 1.85), [0.7, 0.32, 0.5], { color: '#2a0410', color2: DARK }), 'wet', head, false);
    R.add(blob(V(0, 10.35, 1.55), [0.85, 0.45, 0.8], HS), 'wet', jaw);
    teethRow(R, head, V(0, 11.0, 2.3), 1.3, 9, 0.38, V(0, -1, 0.15), { r: 0.045, curve: 0.3 });
    teethRow(R, jaw, V(0, 10.55, 2.15), 1.2, 8, 0.32, V(0, 1, 0.1), { r: 0.04, curve: 0.3 });
    R.swing(jaw, 'x', { idle: 0.02, awake: 0.05, open: 0.3, speed: 2 });
    R.swing(head, 'z', { idle: 0.06, awake: 0.1, speed: 0.6 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [1.65, 9.3, 0], elbow: [2.5, 6.6, 0.4], wrist: [2.7, 3.7, 0.9], r: [0.38, 0.26, 0.17], skin: SK, kind: 'wet', fingers: 4, fingerLen: 1.9, fingerR: 0.09, claw: 0.5, clawColor: '#2a0a18' });
    }
    return R.build();
  },

  // Haunted Woods: a towering hooded thing in a rotting robe, a pale bone mask with burning
  // sockets and more eyes down its face, antlers of dead branches and twig fingers to the ground
  hollowWatcher() {
    const R = new Rig(23, '#3a1a06');
    const CLOAK = { color: '#2c2432', color2: '#0e0a12', amp: 0.2, freq: 1.7, mottle: 0.35 };
    const BONE = { color: '#ddd5c0', color2: '#7f7764', amp: 0.025, freq: 2, mottle: 0.2 };
    const BARK = { color: '#55402c', color2: '#1e140a', amp: 0.05, freq: 3.5, mottle: 0.3 };
    R.add(lathe([[0.01, 0.15], [2.9, 0.15], [2.5, 2], [2.0, 5], [1.7, 8], [2.0, 9.6], [1.3, 10.6], [0.01, 10.9]], V(0, 0, 0), { ...CLOAK, seed: 4 }));
    R.add(sheet([-2, -1, 0, 1, 2].map((x) => V(x * 0.8, 9.6, -1.6)), V(0, -1, 0), 8, { ...CLOAK, seed: 7, billow: 0.4 }), 'membrane');
    const head = R.part('head', V(0, 10.6, 0));
    R.add(blob(V(0, 11.6, -0.3), [1.65, 1.85, 1.75], { ...CLOAK, amp: 0.1, seed: 9 }), 'skin', head);
    const MC = V(0, 11.3, 0.95), MR = [1.05, 1.42, 0.62];
    R.add(blob(MC, MR, BONE), 'skin', head);
    for (const s of [-1, 1]) {
      const { p, n } = onBlob(MC, MR, BONE, s * 0.42, 0.22, 0.05);
      R.add(blob(p, [0.3, 0.38, 0.2], { color: '#050303', color2: '#000' }), 'skin', head, false);
      R.eye(p.clone().addScaledVector(n, -0.05), n, 0.18, { iris: '#ff7a10', irisSize: 1.1, sclera: '#200800', pupil: 'slit', skin: BONE }, head);
    }
    for (const [az, el, r] of [[0, 0.55, 0.13], [0, 0.75, 0.1], [-0.6, -0.15, 0.11], [0.6, -0.15, 0.11], [0.3, 0.45, 0.09], [-0.3, 0.45, 0.09]]) {
      const { p, n } = onBlob(MC, MR, BONE, az, el, r * 0.3);
      R.eye(p, n, r, { iris: '#ff9a20', pupil: 'slit', skin: BONE }, head);
    }
    R.add(blob(V(0, 10.5, 1.5), [0.2, 0.6, 0.12], { color: '#050303', color2: '#000' }), 'skin', head, false);
    for (let i = 0; i < 5; i++) {
      for (const s of [-1, 1]) R.add(cone(V(0.18 * s, 10.05 + i * 0.22, 1.52), V(0.02 * s, 10.0 + i * 0.22, 1.56), 0.04, { color: '#e8dcc0', color2: '#8a7a50' }), 'wet', head, false);
    }
    for (const s of [-1, 1]) {
      const B = { ...BARK, seed: 5 + s };
      R.add(limb([V(0.6 * s, 12.6, -0.3), V(1.2 * s, 13.8, -0.4), V(1.9 * s, 14.8, -0.2), V(2.2 * s, 15.9, 0)], 0.22, 0.05, B), 'skin', head);
      R.add(limb([V(1.2 * s, 13.8, -0.4), V(2.2 * s, 14.1, -0.6), V(2.9 * s, 14.9, -0.5)], 0.12, 0.03, B), 'skin', head);
      R.add(limb([V(1.9 * s, 14.8, -0.2), V(1.4 * s, 15.9, 0.1), V(1.5 * s, 16.8, 0.25)], 0.1, 0.03, B), 'skin', head);
      R.add(limb([V(1.0 * s, 13.4, -0.4), V(0.7 * s, 14.4, -0.9), V(0.9 * s, 15.2, -1.2)], 0.09, 0.02, B), 'skin', head);
    }
    R.swing(head, 'z', { idle: 0.05, awake: 0.08, speed: 0.5 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [1.75, 9.6, 0.1], elbow: [2.6, 6.6, 0.5], wrist: [2.9, 3.5, 0.8], r: [0.45, 0.33, 0.15], skin: CLOAK, handSkin: BARK, fingers: 4, fingerLen: 2.6, fingerR: 0.08, claw: 0.3, clawColor: '#2a1a0a' });
    }
    return R.build();
  },

  // Graveyard: a rotting knight in rusted plate, ribs showing through a hole in the armour, a skull
  // with burning sockets under a horned helm, a torn cape and a huge rusted sword
  graveKnight() {
    const R = new Rig(37, '#3a0606');
    const METAL = { color: '#6c7078', color2: '#2e3034', amp: 0.03, freq: 1.4, mottle: 0.25, veins: { color: '#7a3a14', width: 0.16, freq: 1.8 } };
    const BONE = { color: '#d8d0b8', color2: '#6f6650', amp: 0.025, freq: 2, mottle: 0.25 };
    const ROT = { color: '#5a6248', color2: '#20261a', amp: 0.08, freq: 2, mottle: 0.3, veins: { color: '#3a0a0a', width: 0.08, freq: 2 } };
    for (const s of [-1, 1]) {
      const L = leg(R, s, { pts: [[0.9, 6.2, 0], [1.0, 3.4, 0.4], [1.0, 0.9, 0]], r: [0.55, 0.4, 0.3], skin: ROT, foot: [0.55, 0.4, 0.95], footSkin: METAL, footKind: 'metal', toes: 0 });
      R.add(blob(L.P[1].clone().add(V(0, 0, 0.2)), [0.6, 0.55, 0.6], { ...METAL, seed: 3 }), 'metal', L.name);
      R.add(blob(L.P[1].clone().lerp(L.P[2], 0.5).add(V(0, 0, 0.1)), [0.52, 1.1, 0.55], { ...METAL, seed: 4 }), 'metal', L.name);
    }
    R.add(blob(V(0, 6.5, 0), [1.6, 0.9, 1.1], { ...METAL, seed: 5 }), 'metal');
    R.add(blob(V(0, 8.7, 0), [2.0, 2.1, 1.35], { ...METAL, seed: 6 }), 'metal');
    R.add(blob(V(0.35, 8.3, 0.92), [0.75, 0.85, 0.5], { color: '#1a0805', color2: '#000', amp: 0.12, freq: 3, veins: { color: '#4a0a0a', width: 0.3, freq: 2 } }), 'skin', '', false);
    for (let i = 0; i < 4; i++) R.add(limb([V(-0.3, 7.65 + i * 0.36, 1.25), V(0.35, 7.72 + i * 0.36, 1.42), V(1.0, 7.65 + i * 0.36, 1.25)], 0.07, 0.055, BONE), 'skin', '', false);
    for (const s of [-1, 1]) {
      R.add(blob(V(2.0 * s, 10.3, 0), [1.0, 0.7, 1.05], { ...METAL, seed: 8 }), 'metal');
      for (let i = 0; i < 3; i++) R.add(cone(V((1.7 + i * 0.35) * s, 10.85, -0.2 + i * 0.1), V((2.0 + i * 0.5) * s, 11.9, -0.3), 0.14, METAL), 'metal', '', false);
    }
    R.add(sheet([-2, -1, 0, 1, 2].map((x) => V(x * 0.85, 10.4, -1.3)), V(0, -1, -0.08).normalize(), 8.5, { color: '#4a0c10', color2: '#1a0204', amp: 0.08, freq: 2, seed: 9 }), 'membrane');
    R.add(limb([V(0, 10.4, 0), V(0, 11.1, 0.2)], 0.38, 0.32, BONE), 'skin');
    const head = R.part('head', V(0, 11.0, 0.1));
    const SC = V(0, 11.9, 0.25), SR = [0.95, 1.05, 1.1];
    R.add(blob(SC, SR, BONE), 'skin', head);
    R.add(blob(V(0, 12.45, -0.15), [1.15, 0.85, 1.2], { ...METAL, seed: 12 }), 'metal', head);
    for (const s of [-1, 1]) {
      R.add(limb([V(0.8 * s, 12.8, -0.2), V(1.6 * s, 13.4, -0.4), V(2.0 * s, 14.4, -0.2)], 0.24, 0.03, METAL), 'metal', head);
      const { p, n } = onBlob(SC, SR, BONE, s * 0.38, 0.05, 0.12);
      R.add(blob(p, [0.3, 0.27, 0.2], { color: '#050303', color2: '#000' }), 'skin', head, false);
      R.eye(p.clone().addScaledVector(n, -0.06), n, 0.17, { iris: '#ff2a12', sclera: '#2a0400', irisSize: 1.1, skin: BONE }, head);
      const c2 = onBlob(SC, SR, BONE, s * 0.7, -0.25, 0.03);
      R.eye(c2.p, c2.n, 0.1, { iris: '#ff4020', pupil: 'slit', skin: BONE }, head);
    }
    R.add(blob(V(0, 11.55, 1.32), [0.13, 0.18, 0.1], { color: '#050303', color2: '#000' }), 'skin', head, false);
    const jaw = R.part('jaw', V(0, 11.4, -0.1), head);
    R.add(blob(V(0, 11.05, 0.6), [0.72, 0.32, 0.72], BONE), 'skin', jaw);
    teethRow(R, head, V(0, 11.35, 1.25), 1.0, 8, 0.25, V(0, -1, 0.1), { r: 0.06 });
    teethRow(R, jaw, V(0, 11.15, 1.2), 0.95, 8, 0.2, V(0, 1, 0.1), { r: 0.06 });
    R.swing(jaw, 'x', { idle: 0.02, awake: 0.06, open: 0.35, speed: 2.2 });
    for (const s of [-1, 1]) {
      const A = arm(R, s, { shoulder: [2.0, 9.9, 0], elbow: [2.45, 7.4, 0.6], wrist: [2.45, 5.5, 1.6], r: [0.42, 0.32, 0.26], skin: BONE, handSkin: METAL, handKind: 'metal', fingers: 4, fingerLen: 0.9, fingerR: 0.11, claw: 0.25 });
      R.add(blob(A.E.clone().lerp(A.W, 0.5), [0.5, 1.0, 0.5], { ...METAL, rot: [0.5, 0, 0] }), 'metal', A.name);
      if (s > 0) {
        const grip = A.W.clone().add(V(0, -0.4, 0.4));
        R.add(limb([grip.clone().add(V(0, 0.6, -0.3)), grip], 0.12, 0.12, { color: '#3a2414', color2: '#120a04' }), 'skin', A.name, false);
        R.add(blob(grip.clone().add(V(0, -0.15, 0.08)), [0.9, 0.16, 0.22], { ...METAL, rot: [0.35, 0, 0] }), 'metal', A.name, false);
        R.add(blade(grip.clone().add(V(0, -0.2, 0.1)), V(0, -1, 0.35), 5.3, 0.7, { ...METAL, veins: { color: '#8a4012', width: 0.3, freq: 1.4 } }), 'metal', A.name);
      }
    }
    return R.build();
  },

  // Creepy Carnival: a bloated clown with greasy white skin, a gaping red mouth full of teeth,
  // yellow slit eyes in black paint and a row of red eyes across the forehead
  bigTopBrute() {
    const R = new Rig(41, '#4a0a10');
    const SK = { color: '#ebe2d4', color2: '#9a8c7e', amp: 0.05, freq: 1.3, mottle: 0.2, veins: { color: '#8a2a3a', width: 0.05, freq: 1.4 } };
    const SUIT = { color: '#d6b23a', color2: '#6a4a0a', amp: 0.14, freq: 1.8, mottle: 0.3, veins: { color: '#b0101e', width: 0.25, freq: 0.9 } };
    const RED = { color: '#c0101e', color2: '#4a0206', amp: 0.02, mottle: 0.2 };
    for (const s of [-1, 1]) {
      leg(R, s, { pts: [[1.25, 4.4, 0], [1.45, 2.6, 0.3], [1.45, 1.0, 0.1]], r: [0.9, 0.7, 0.55], skin: SUIT, foot: [0.95, 0.65, 1.9], footSkin: RED, footKind: 'wet', toes: 0 });
    }
    R.add(blob(V(0, 6.2, 0.3), [3.0, 2.8, 2.6], { ...SUIT, seed: 3 }));
    R.add(blob(V(0, 8.6, 0), [2.6, 1.8, 2.0], { ...SUIT, seed: 4 }));
    R.add(flesh(new THREE.TorusGeometry(2.0, 0.6, 14, 56).rotateX(Math.PI / 2).translate(0, 10.1, 0), { color: '#ece8e0', color2: '#9a9088', amp: 0.28, freq: 4, seed: 5 }));
    const head = R.part('head', V(0, 10.2, 0));
    const HC = V(0, 12.2, 0.3), HR = [1.75, 1.95, 1.75];
    R.add(blob(HC, HR, SK), 'wet', head);
    R.add(blob(V(0, 12.05, 2.05), [0.48, 0.45, 0.45], RED), 'wet', head);
    const HAIR = { color: '#e8501a', color2: '#6a1a08', amp: 0.32, freq: 3, mottle: 0.3 };
    for (const s of [-1, 1]) {
      R.add(blob(V(1.65 * s, 12.6, -0.2), [0.9, 1.05, 1.05], { ...HAIR, seed: 6 + s }), 'skin', head);
      R.add(blob(V(1.15 * s, 13.5, -0.65), [0.85, 0.8, 0.85], { ...HAIR, seed: 8 + s }), 'skin', head);
      const { p, n } = onBlob(HC, HR, SK, s * 0.36, 0.2, 0.15);
      R.add(blob(p.clone().addScaledVector(n, 0.12), [0.55, 0.85, 0.2], { color: '#141018', color2: '#000', rot: [0, 0, s * 0.2] }), 'wet', head, false);
      R.eye(p, n, 0.4, { iris: '#ffd21a', iris2: '#a04000', pupil: 'slit', skin: SK }, head);
    }
    for (const az of [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75]) {
      const { p, n } = onBlob(HC, HR, SK, az, 0.6 - Math.abs(az) * 0.15, 0.06);
      R.eye(p, n, 0.16, { iris: '#ff2020', pupil: 'slit', skin: SK }, head);
    }
    R.add(lathe([[0.01, 0], [0.95, 0], [0.95, 0.12], [0.55, 0.16], [0.55, 1.25], [0.01, 1.25]], V(0.35, 13.75, -0.1), { color: '#1b1b22', color2: '#000', rot: [0, 0, -0.25] }), 'skin', head);
    const jaw = R.part('jaw', V(0, 11.6, -0.4), head);
    R.add(blob(V(0, 11.25, 1.35), [1.25, 0.5, 0.55], { color: '#2a0508', color2: DARK }), 'wet', head, false);
    R.add(blob(V(0, 10.9, 0.85), [1.45, 0.62, 1.15], SK), 'wet', jaw);
    R.add(limb([V(-1.3, 11.6, 1.2), V(0, 11.75, 1.9), V(1.3, 11.6, 1.2)], 0.16, 0.16, RED), 'wet', head, false);
    R.add(limb([V(-1.3, 11.2, 1.1), V(0, 11.15, 1.85), V(1.3, 11.2, 1.1)], 0.15, 0.15, RED), 'wet', jaw, false);
    teethRow(R, head, V(0, 11.55, 1.85), 2.1, 11, 0.38, V(0, -1, 0.1), { r: 0.09, curve: 0.25, fangs: true });
    teethRow(R, jaw, V(0, 11.25, 1.8), 2.0, 10, 0.32, V(0, 1, 0.1), { r: 0.08, curve: 0.25 });
    R.swing(jaw, 'x', { idle: 0.03, awake: 0.06, open: 0.42, speed: 2 });
    R.swing(head, 'z', { idle: 0.06, awake: 0.12, speed: 0.7 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [2.6, 9.1, 0], elbow: [3.4, 6.9, 0.5], wrist: [3.6, 4.9, 1.2], r: [0.78, 0.62, 0.48], skin: SUIT, handSkin: { color: '#f2f0ea', color2: '#a8a49c', amp: 0.04 }, fingers: 4, fingerLen: 1.1, fingerR: 0.2, claw: 0.55 });
    }
    return R.build();
  },

  // Rainbow Bog: a mountain of rotting slime covered in dozens of eyes, a huge toothed maw and
  // tentacles that never stop moving
  bogHorror() {
    const R = new Rig(53, '#0c2a06');
    const SL = { color: '#557e2c', color2: '#1c3610', amp: 0.4, freq: 0.9, mottle: 0.35, veins: { color: '#c04aff', width: 0.06, freq: 1.1, glow: 0.9 } };
    const B1 = [V(0, 2.6, 0), [6.2, 3.2, 5.8], { ...SL, seed: 3 }];
    const B2 = [V(0, 5.7, -0.5), [4.6, 3.0, 4.2], { ...SL, seed: 4 }];
    const B3 = [V(0.4, 8.2, -0.9), [2.8, 2.0, 2.6], { ...SL, seed: 5 }];
    for (const [c, r, o] of [B1, B2, B3]) R.add(blob(c, r, { ...o, seg: 44, rows: 30 }), 'wet');
    for (let i = 0; i < 9; i++) {
      const { p } = onBlob(B1[0], B1[1], B1[2], R.rand() * Math.PI * 2, 0.1 + R.rand() * 0.6, -0.2);
      if (p.z > 3 && Math.abs(p.x) < 3.5) continue;
      const s = 0.8 + R.rand() * 1.1;
      R.add(blob(p, [s, s * 0.8, s], { ...SL, seed: 20 + i, amp: 0.2 }), 'wet');
    }
    const jaw = R.part('jaw', V(0, 3.3, 2.6));
    R.add(blob(V(0, 3.3, 5.0), [3.1, 1.4, 1.2], { color: '#1a060a', color2: DARK }), 'wet', '', false);
    R.add(blob(V(0, 4.7, 5.05), [3.4, 0.75, 1.05], { ...SL, amp: 0.15, seed: 8 }), 'wet');
    R.add(blob(V(0, 2.0, 4.85), [3.1, 0.85, 1.25], { ...SL, amp: 0.15, seed: 9 }), 'wet', jaw);
    teethRow(R, '', V(0, 4.2, 5.75), 5.2, 13, 0.95, V(0, -1, 0.2), { r: 0.17, curve: 0.08, color: '#d8d0a0', color2: '#5a5020', fangs: true });
    teethRow(R, jaw, V(0, 2.6, 5.6), 4.9, 12, 0.75, V(0, 1, 0.2), { r: 0.15, curve: 0.08, color: '#d8d0a0', color2: '#5a5020' });
    R.swing(jaw, 'x', { idle: 0.03, awake: 0.06, open: 0.28, speed: 1.6 });
    const EO = { iris: ['#f6ff4a', '#ff3a3a', '#ff9a1f', '#7dff6a'], pupil: 'slit', skin: SL, sclera: '#e8e0a8' };
    eyesOver(R, '', ...B1, 14, [0.35, 0.85], { ...EO, elMin: 0.15, elMax: 0.75 }, (az, el) => Math.abs(az) < 0.75 && el < 0.45);
    eyesOver(R, '', ...B2, 11, [0.3, 0.75], { ...EO, elMin: -0.1, elMax: 0.85 });
    eyesOver(R, '', ...B3, 6, [0.3, 0.6], { ...EO, elMin: 0, elMax: 0.9 });
    const front = onBlob(...B2, 0, 0.15, 0.4);
    R.eye(front.p, front.n, 1.3, { iris: '#f6ff4a', iris2: '#5a3a00', pupil: 'slit', skin: SL, sclera: '#e8e0a8' });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.5;
      if (Math.cos(a) > 0.55) continue;
      const base = V(Math.sin(a) * 5.2, 1.6, Math.cos(a) * 4.8);
      const out = V(Math.sin(a), 0, Math.cos(a));
      const t = R.part(`t${i}`, base);
      const pts = [base, base.clone().addScaledVector(out, 2).add(V(0, 1.6, 0)), base.clone().addScaledVector(out, 3.4).add(V(0, 4.2, 0)),
        base.clone().addScaledVector(out, 3.2).add(V(0, 6.6, 0)), base.clone().addScaledVector(out, 2.2).add(V(0, 7.6, 0))];
      R.add(limb(pts, 0.75, 0.08, { ...SL, amp: 0.08, seed: 30 + i }), 'wet', t);
      for (let k = 1; k < 4; k++) R.add(blob(pts[k].clone().addScaledVector(out, -0.45), [0.18, 0.18, 0.18], { color: '#e8a0ff', color2: '#7a2aa0', glow: 0.6 }), 'wet', t, false);
      R.swing(t, 'x', { idle: 0.1, awake: 0.22, speed: 0.9 + (i % 3) * 0.3, phase: i });
      R.swing(t, 'z', { idle: 0.08, awake: 0.2, speed: 0.7 + (i % 2) * 0.4, phase: i * 2 });
    }
    return R.build();
  },

  // Frostbite Peaks: a hunched shaggy beast that walks on its knuckles: a blue-black face with four
  // ice-blue eyes, a fanged maw, horns of glowing ice and icicles growing out of its back
  frostbiteYeti() {
    const R = new Rig(67, '#06203a');
    const FUR = { color: '#e2eaf0', color2: '#7f909c', amp: 0.3, freq: 3.4, mottle: 0.3, seg: 56, rows: 40 };
    const FACE = { color: '#2a3a5a', color2: '#0c1424', amp: 0.04, freq: 1.6, mottle: 0.25, veins: { color: '#5aa8e0', width: 0.05, freq: 2 } };
    const ICE = { color: '#c4ecff', color2: '#4a98d0', amp: 0.02, mottle: 0.2, glow: 0.35 };
    for (const s of [-1, 1]) {
      leg(R, s, { pts: [[1.6, 4.8, -1.1], [2.0, 2.9, 0.2], [1.85, 0.9, -0.3]], r: [1.15, 0.85, 0.6], skin: FUR, foot: [0.95, 0.55, 1.4], footSkin: FACE, toes: 4, claw: 0.5, clawColor: '#e8f4ff' });
    }
    R.add(blob(V(0, 5.6, 0.2), [2.5, 2.1, 2.3], { ...FUR, seed: 3 }));
    R.add(blob(V(0, 7.4, 0.5), [3.2, 2.9, 2.7], { ...FUR, seed: 4, rot: [0.4, 0, 0] }));
    R.add(blob(V(0, 9.5, -0.3), [3.6, 1.9, 2.5], { ...FUR, seed: 5 }));
    for (let i = 0; i < 7; i++) {
      const x = (i % 2 ? 1 : -1) * (0.4 + (i % 3) * 0.6), y = 9.6 - i * 0.55, z = -2.3 + i * 0.05;
      R.add(cone(V(x, y, z), V(x * 1.2, y + 1.3 + (i % 3) * 0.4, z - 1.0), 0.32, ICE), 'wet', '', false);
    }
    const head = R.part('head', V(0, 9.8, 1.6));
    R.add(blob(V(0, 10.7, 2.7), [1.65, 1.55, 1.55], { ...FUR, seed: 7 }), 'skin', head);
    const FC = V(0, 10.35, 3.85), FR = [1.2, 1.1, 0.65];
    R.add(blob(FC, FR, FACE), 'wet', head);
    R.add(blob(V(0, 11.05, 4.1), [1.25, 0.32, 0.45], { ...FACE, seed: 3 }), 'wet', head);
    for (const [az, el, r] of [[-0.35, 0.28, 0.21], [0.35, 0.28, 0.21], [-0.75, 0.12, 0.15], [0.75, 0.12, 0.15]]) {
      const { p, n } = onBlob(FC, FR, FACE, az, el, r * 0.3);
      R.eye(p, n, r, { iris: '#7fe8ff', iris2: '#0a4a7a', pupil: 'slit', skin: FACE, sclera: '#1a2a3a' }, head);
    }
    const jaw = R.part('jaw', V(0, 10.0, 3.0), head);
    R.add(blob(V(0, 9.85, 4.25), [0.85, 0.4, 0.4], { color: '#1a0408', color2: DARK }), 'wet', head, false);
    R.add(blob(V(0, 9.45, 3.95), [1.0, 0.5, 0.75], FACE), 'wet', jaw);
    for (const s of [-1, 1]) R.add(cone(V(0.45 * s, 10.05, 4.42), V(0.42 * s, 9.0, 4.55), 0.13, { color: '#eef4ff', color2: '#8a9aa8' }), 'wet', head, false);
    teethRow(R, head, V(0, 10.0, 4.45), 1.4, 8, 0.25, V(0, -1, 0.1), { r: 0.06 });
    teethRow(R, jaw, V(0, 9.75, 4.4), 1.3, 8, 0.22, V(0, 1, 0.1), { r: 0.06 });
    R.swing(jaw, 'x', { idle: 0.02, awake: 0.06, open: 0.38, speed: 1.8 });
    for (const s of [-1, 1]) {
      R.add(limb([V(1.0 * s, 11.6, 2.6), V(1.9 * s, 12.6, 2.2), V(2.6 * s, 12.8, 1.2), V(2.6 * s, 12.0, 0.5)], 0.36, 0.05, ICE), 'wet', head);
    }
    R.swing(head, 'z', { idle: 0.05, awake: 0.1, speed: 0.6 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [3.1, 9.4, 0.6], elbow: [4.1, 6.2, 1.8], wrist: [4.0, 2.2, 2.8], r: [1.15, 0.9, 0.7], skin: FUR, handSkin: FACE, fingers: 4, fingerLen: 1.2, fingerR: 0.22, claw: 0.6, clawColor: '#e8f4ff' });
    }
    return R.build();
  },

  // Ghost Manor: a giant drifting wraith in a torn glowing shroud, skeletal arms with long claws, a
  // gold crown over a black void of a face full of cyan eyes and a hanging skeletal jaw
  ghostKing() {
    const R = new Rig(71, '#1a4a7a');
    const GH = { color: '#cfe0ff', color2: '#4a5a90', amp: 0.28, freq: 1.4, mottle: 0.3, glow: 0.35 };
    const BONE = { color: '#d8d2c0', color2: '#6f6650', amp: 0.02, freq: 2 };
    const GOLD = { color: '#e8b830', color2: '#7a4a08', amp: 0.02, freq: 2, mottle: 0.2 };
    R.add(lathe([[0.01, 1.2], [3.2, 0.4], [3.0, 2.5], [2.6, 6], [2.4, 9], [2.7, 10.5], [1.6, 11.6], [0.01, 11.9]], V(0, 0, 0), { ...GH, seed: 3, seg: 44 }), 'ghost');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = V(Math.sin(a) * 2.6, 1.2, Math.cos(a) * 2.6);
      R.add(limb([b, b.clone().add(V(Math.sin(a) * 0.6, -0.8, Math.cos(a) * 0.6)), b.clone().add(V(Math.sin(a) * 0.5, -1.8 - (i % 3) * 0.5, Math.cos(a) * 0.4))], 0.55, 0.04, { ...GH, seed: 10 + i }), 'ghost');
    }
    const head = R.part('head', V(0, 11.4, 0));
    R.add(blob(V(0, 13.0, -0.3), [1.9, 2.1, 2.0], { ...GH, amp: 0.15, seed: 6 }), 'ghost', head);
    const VC = V(0, 12.75, 0.9), VR = [1.35, 1.6, 0.95];
    R.add(blob(VC, VR, { color: '#05060c', color2: '#000', amp: 0 }), 'skin', head, false);
    for (const [az, el, r] of [[-0.4, 0.25, 0.24], [0.4, 0.25, 0.24], [0, 0.55, 0.19], [-0.75, 0, 0.15], [0.75, 0, 0.15], [-0.25, -0.05, 0.12], [0.25, -0.05, 0.12], [0, 0.82, 0.12]]) {
      const { p, n } = onBlob(VC, VR, {}, az, el, r * 0.2);
      R.eye(p, n, r, { iris: '#3ff3ff', iris2: '#0a6a8a', sclera: '#0a1020', pupil: 'slit', skin: { color: '#0a0c14', color2: '#000' }, scleraGlow: 0 }, head);
    }
    const jaw = R.part('jaw', V(0, 12.0, 0.4), head);
    R.add(blob(V(0, 11.3, 1.2), [0.75, 0.3, 0.6], BONE), 'skin', jaw);
    teethRow(R, jaw, V(0, 11.5, 1.65), 1.1, 8, 0.3, V(0, 1, 0.1), { r: 0.06 });
    teethRow(R, head, V(0, 12.1, 1.7), 1.2, 8, 0.32, V(0, -1, 0.1), { r: 0.06 });
    R.swing(jaw, 'x', { idle: 0.06, awake: 0.1, open: 0.45, speed: 1.4 });
    R.add(lathe([[1.3, 0], [1.5, 0], [1.5, 0.55], [1.3, 0.55]], V(0, 14.55, -0.25), GOLD), 'metal', head);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      R.add(cone(V(Math.sin(a) * 1.4, 15.05, Math.cos(a) * 1.4 - 0.25), V(Math.sin(a) * 1.6, 16.1 + (i % 2) * 0.5, Math.cos(a) * 1.6 - 0.25), 0.18, GOLD), 'metal', head, false);
    }
    R.add(blob(V(0, 14.85, 1.3), [0.25, 0.25, 0.12], { color: '#ff2040', color2: '#6a0010', glow: 0.8 }), 'wet', head, false);
    R.swing(head, 'z', { idle: 0.06, awake: 0.1, speed: 0.5 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [2.3, 10.1, 0], elbow: [3.4, 7.6, 1.0], wrist: [3.7, 5.6, 1.8], r: [0.95, 0.8, 0.22], skin: GH, kind: 'ghost', handSkin: BONE, handKind: 'skin', fingers: 4, fingerLen: 2.3, fingerR: 0.11, claw: 0.45 });
    }
    return R.build();
  },

  // Demon Pit: a horned demon on goat legs, black hide split by glowing lava veins, three burning
  // eyes, a fanged snout, great torn bat wings and a barbed tail
  emberFiend() {
    const R = new Rig(83, '#5a1004');
    const HIDE = { color: '#3a1414', color2: '#0e0404', amp: 0.08, freq: 1.6, mottle: 0.3, veins: { color: '#ff6a10', width: 0.06, freq: 1.3, glow: 1.3 } };
    const HORN = { color: '#d8cbb0', color2: '#4a3a2a', amp: 0.02, freq: 3, mottle: 0.25 };
    const WING = { color: '#4a1010', color2: '#1a0404', amp: 0.05, freq: 2, mottle: 0.3, veins: { color: '#c03010', width: 0.05, freq: 2, glow: 0.4 } };
    for (const s of [-1, 1]) {
      leg(R, s, { pts: [[1.1, 6.5, 0], [1.3, 4.7, 1.0], [1.2, 2.7, -0.8], [1.2, 0.7, -0.1]], r: [0.75, 0.55, 0.35, 0.3], skin: HIDE, hoof: 0.5, foot: [0.45, 0.45, 0.55], footSkin: { color: '#0a0606', color2: '#000' }, footKind: 'wet', toes: 0 });
    }
    R.add(blob(V(0, 7.1, 0), [1.6, 1.0, 1.15], { ...HIDE, seed: 3 }));
    R.add(blob(V(0, 8.0, 0.25), [1.55, 1.3, 1.1], { ...HIDE, seed: 4 }));
    R.add(blob(V(0, 9.6, 0), [2.35, 1.85, 1.45], { ...HIDE, seed: 5 }));
    for (const s of [-1, 1]) R.add(blob(V(0.9 * s, 9.5, 0.9), [0.95, 0.75, 0.55], { ...HIDE, seed: 6 }));
    for (let i = 0; i < 6; i++) R.add(cone(V(0, 7.6 + i * 0.55, -1.15 - Math.sin(i / 2) * 0.1), V(0, 8.0 + i * 0.55, -1.9), 0.18, HORN), 'skin', '', false);
    for (const s of [-1, 1]) {
      const root = V(1.0 * s, 10.3, -1.0);
      const w = R.part(`wing${s}`, root);
      const elbow = V(4.6 * s, 12.8, -2.2);
      const tips = [V(9.0 * s, 13.4, -2.8), V(8.4 * s, 9.6, -3.2), V(6.8 * s, 6.8, -2.8), V(4.4 * s, 5.8, -2.0)];
      const BN = { ...HIDE, veins: undefined, amp: 0.02 };
      R.add(limb([root, root.clone().lerp(elbow, 0.5).add(V(0, 0.6, 0)), elbow], 0.32, 0.22, BN), 'skin', w);
      tips.forEach((t) => R.add(limb([elbow, elbow.clone().lerp(t, 0.5).add(V(0, 0.3, 0)), t], 0.16, 0.04, BN), 'skin', w));
      R.add(cone(elbow, elbow.clone().add(V(0.4 * s, 1.0, 0)), 0.16, HORN), 'skin', w, false);
      R.add(membrane(root.clone().add(V(0, -0.6, 0)), [elbow, ...tips], { ...WING, sag: 0.32, seed: 7 }), 'membrane', w);
      R.swing(w, 'y', { idle: 0.06, awake: 0.22, run: 0.25, speed: 1.4, phase: s > 0 ? 0 : Math.PI });
    }
    const tail = R.part('tail', V(0, 6.8, -1.1));
    R.add(limb([V(0, 6.8, -1.1), V(0, 5.2, -3.0), V(0, 3.6, -4.8), V(0.4, 3.2, -6.5), V(0.2, 4.2, -7.7)], 0.5, 0.1, { ...HIDE, seed: 9 }), 'skin', tail);
    R.add(cone(V(0.2, 4.2, -7.7), V(0.1, 5.2, -8.5), 0.4, { ...HORN, rad: 4 }), 'skin', tail, false);
    R.swing(tail, 'y', { idle: 0.2, awake: 0.35, speed: 1.1 });
    const head = R.part('head', V(0, 11.2, 0.25));
    const HC = V(0, 12.4, 0.7), HR = [1.1, 1.2, 1.25];
    R.add(limb([V(0, 10.9, 0.1), V(0, 11.6, 0.4)], 0.55, 0.5, HIDE), 'skin', head);
    R.add(blob(HC, HR, { ...HIDE, amp: 0.04 }), 'skin', head);
    R.add(blob(V(0, 11.95, 1.75), [0.8, 0.6, 0.75], { ...HIDE, amp: 0.03, seed: 4 }), 'skin', head);
    R.add(blob(V(0, 12.95, 1.45), [1.0, 0.25, 0.4], { ...HIDE, amp: 0.02, seed: 8 }), 'skin', head);
    for (const s of [-1, 1]) {
      const { p, n } = onBlob(HC, HR, HIDE, s * 0.42, 0.18, 0.06);
      R.eye(p, n, 0.2, { iris: '#ffd21a', iris2: '#c02000', pupil: 'slit', sclera: '#2a0800', skin: HIDE, hood: -0.25 }, head);
      R.add(limb([V(0.7 * s, 13.3, 0.3), V(1.8 * s, 14.4, 0), V(2.8 * s, 14.3, -0.9), V(3.0 * s, 13.2, -1.3), V(2.5 * s, 12.6, -0.8)], 0.42, 0.04, HORN), 'skin', head);
      R.add(cone(V(0.35 * s, 13.35, 1.1), V(0.45 * s, 14.1, 1.0), 0.13, HORN), 'skin', head, false);
    }
    const third = onBlob(HC, HR, HIDE, 0, 0.5, 0.05);
    R.eye(third.p, third.n, 0.2, { iris: '#ff5a10', pupil: 'slit', sclera: '#2a0800', skin: HIDE, tilt: Math.PI / 2 }, head);
    const jaw = R.part('jaw', V(0, 11.9, 0.3), head);
    R.add(blob(V(0, 11.75, 2.05), [0.55, 0.22, 0.4], { color: '#2a0404', color2: DARK, glow: 0.4 }), 'wet', head, false);
    R.add(blob(V(0, 11.35, 1.55), [0.7, 0.35, 0.8], { ...HIDE, amp: 0.02 }), 'skin', jaw);
    for (const s of [-1, 1]) R.add(cone(V(0.38 * s, 11.85, 2.3), V(0.36 * s, 11.0, 2.4), 0.09, HORN), 'wet', head, false);
    teethRow(R, head, V(0, 11.85, 2.35), 0.9, 8, 0.25, V(0, -1, 0.1), { r: 0.05, curve: 0.5 });
    teethRow(R, jaw, V(0, 11.55, 2.25), 0.85, 7, 0.22, V(0, 1, 0.1), { r: 0.05, curve: 0.5 });
    R.swing(jaw, 'x', { idle: 0.02, awake: 0.06, open: 0.35, speed: 2 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [2.3, 10.2, 0], elbow: [3.0, 7.8, 0.5], wrist: [3.1, 5.7, 1.3], r: [0.72, 0.56, 0.4], skin: HIDE, fingers: 4, fingerLen: 1.0, fingerR: 0.14, claw: 0.6, clawColor: '#120808' });
    }
    return R.build();
  },

  // Nightmare: the grey visitor: a long thin body and neck, a swollen head with two huge black
  // eyes and a scatter of glowing magenta ones, a tiny mouth of needles and three-fingered hands
  nightVisitor() {
    const R = new Rig(97, '#3a0a4a');
    const SK = { color: '#928c9e', color2: '#3a3648', amp: 0.04, freq: 1.3, mottle: 0.22, veins: { color: '#9a40d0', width: 0.05, freq: 1.4, glow: 0.35 } };
    for (const s of [-1, 1]) {
      leg(R, s, { pts: [[0.6, 6.8, 0], [0.75, 3.8, 0.5], [0.7, 0.7, 0]], r: [0.36, 0.25, 0.17], skin: SK, kind: 'wet', foot: [0.35, 0.22, 0.7], toes: 3, claw: 0.35 });
    }
    R.add(blob(V(0, 7.0, 0), [0.95, 0.65, 0.65], { ...SK, seed: 3 }), 'wet');
    R.add(limb([V(0, 7.3, 0), V(0, 8.2, 0.08), V(0, 9.0, 0)], 0.62, 0.7, { ...SK, bulge: -0.25, seed: 4 }), 'wet');
    R.add(blob(V(0, 9.7, 0), [1.25, 1.3, 0.85], { ...SK, seed: 5 }), 'wet');
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) R.add(limb([V(0.15 * s, 9.0 + i * 0.35, 0.82), V(0.9 * s, 9.1 + i * 0.35, 0.55), V(1.2 * s, 9.2 + i * 0.35, 0)], 0.06, 0.05, { color: '#b0aabc', color2: '#5a5668' }), 'wet', '', false);
    R.add(limb([V(0, 10.6, 0), V(0, 11.8, 0.3), V(0, 12.7, 0.45)], 0.3, 0.26, { ...SK, seed: 6 }), 'wet');
    const head = R.part('head', V(0, 12.5, 0.45));
    const CC = V(0, 14.6, -0.1), CR = [2.4, 2.25, 2.6];
    R.add(blob(CC, CR, { ...SK, amp: 0.03, seed: 7 }), 'wet', head);
    const FC = V(0, 13.4, 1.15), FR = [1.35, 1.25, 1.25];
    R.add(blob(FC, FR, { ...SK, amp: 0.02, seed: 8 }), 'wet', head);
    for (const s of [-1, 1]) {
      const { p, n } = onBlob(FC, FR, SK, s * 0.5, 0.42, 0.25);
      R.eye(p, n, 0.68, { iris: '#050508', iris2: '#000', irisSize: 1.4, pupil: 'none', irisGlow: 0, stretch: [1.45, 0.62], tilt: s * 0.5, skin: SK, hood: -0.3 }, head);
    }
    eyesOver(R, head, CC, CR, { ...SK, amp: 0.03, seed: 7 }, 10, [0.2, 0.32], { iris: '#ff2ad8', iris2: '#5a0a5a', pupil: 'slit', skin: SK, az: 1.4, elMin: 0.1, elMax: 0.8 });
    const jaw = R.part('jaw', V(0, 12.7, 0.9), head);
    R.add(blob(V(0, 12.5, 2.25), [0.38, 0.12, 0.2], { color: '#1a0410', color2: DARK }), 'wet', head, false);
    R.add(blob(V(0, 12.3, 1.9), [0.5, 0.25, 0.45], { ...SK, amp: 0 }), 'wet', jaw);
    teethRow(R, head, V(0, 12.58, 2.35), 0.62, 7, 0.2, V(0, -1, 0.1), { r: 0.03, curve: 0.6 });
    teethRow(R, jaw, V(0, 12.42, 2.3), 0.58, 6, 0.18, V(0, 1, 0.1), { r: 0.03, curve: 0.6 });
    R.swing(jaw, 'x', { idle: 0.02, awake: 0.05, open: 0.4, speed: 2 });
    R.swing(head, 'z', { idle: 0.08, awake: 0.14, speed: 0.55 });
    for (const s of [-1, 1]) {
      arm(R, s, { shoulder: [1.25, 10.3, 0], elbow: [1.8, 6.9, 0.3], wrist: [2.0, 3.5, 0.8], r: [0.28, 0.2, 0.14], skin: SK, kind: 'wet', fingers: 3, fingerLen: 2.4, fingerR: 0.08, claw: 0.3 });
    }
    return R.build();
  },

  // The Glitch: a glossy black faceless figure leaking neon, shards of light jutting from it, a
  // cluster of red eyes where the face should be, a mouth split down the middle and an arm that
  // keeps glitching away from its body
  glitchEntity() {
    const R = new Rig(101, '#00303a');
    const BK = { color: '#16161c', color2: '#040406', amp: 0.06, freq: 1.5, mottle: 0.2, veins: { color: '#00e5ff', width: 0.05, freq: 1.7, glow: 1.4 } };
    const NEON = ['#00e5ff', '#ff2ad8', '#7dff2a'];
    R.add(limb([V(0, 0.8, -0.3), V(0, 2.8, 0.15), V(0, 5.6, 0)], 0.12, 1.15, { ...BK, seed: 2 }), 'wet');
    R.add(blob(V(0, 6.2, 0), [1.3, 0.9, 0.95], { ...BK, seed: 3 }), 'wet');
    R.add(blob(V(0, 8.1, 0), [1.75, 1.8, 1.1], { ...BK, seed: 4 }), 'wet');
    R.add(blob(V(0, 9.15, -0.05), [1.9, 0.65, 0.85], { ...BK, seed: 6 }), 'wet');
    R.add(limb([V(0, 9.6, 0), V(0, 10.4, 0.15)], 0.42, 0.38, BK), 'wet');
    for (let i = 0; i < 16; i++) {
      const a = R.rand() * Math.PI * 2, y = 1.5 + R.rand() * 7.5;
      const rr = y > 5 ? 1.5 : 0.25 + y * 0.18;
      const base = V(Math.sin(a) * rr * 0.8, y, Math.cos(a) * rr * 0.6);
      const out = V(Math.sin(a), (R.rand() - 0.3) * 0.8, Math.cos(a)).normalize();
      R.add(cone(base, base.clone().addScaledVector(out, 0.8 + R.rand() * 1.6), 0.15 + R.rand() * 0.2, { color: NEON[i % 3], color2: NEON[(i + 1) % 3], glow: 1.1, rad: 4 }), 'skin', '', false);
    }
    const head = R.part('head', V(0, 10.2, 0.15));
    const HC = V(0, 11.5, 0.25), HR = [1.2, 1.5, 1.25];
    R.add(blob(HC, HR, { ...BK, amp: 0.03 }), 'wet', head);
    eyesOver(R, head, HC, HR, { ...BK, amp: 0.03 }, 13, [0.16, 0.32], { iris: '#ff2020', iris2: '#4a0000', sclera: '#0a0a0a', pupil: 'round', skin: BK, az: 0.9, elMin: -0.1, elMax: 0.75 });
    R.add(blob(V(0, 10.85, 1.12), [0.32, 0.85, 0.3], { color: '#14000c', color2: '#000', amp: 0.04 }), 'wet', head, false);
    R.add(limb([V(0, 9.95, 1.3), V(0.36, 10.85, 1.38), V(0, 11.75, 1.3)], 0.06, 0.06, { color: '#ff2ad8', color2: '#6a0050', glow: 1.2 }), 'wet', head, false);
    R.add(limb([V(0, 9.95, 1.3), V(-0.36, 10.85, 1.38), V(0, 11.75, 1.3)], 0.06, 0.06, { color: '#ff2ad8', color2: '#6a0050', glow: 1.2 }), 'wet', head, false);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) R.add(cone(V(0.3 * s, 10.3 + i * 0.22, 1.32), V(0.04 * s, 10.3 + i * 0.22, 1.4), 0.05, { color: '#e8e8f0', color2: '#8a8a9a' }), 'wet', head, false);
    }
    R.jitter(head, 0.2);
    for (const s of [-1, 1]) {
      const A = arm(R, s, { shoulder: [1.5 + (s < 0 ? 0.8 : 0), 9.0 + (s < 0 ? 0.3 : 0), 0], elbow: [2.4 + (s < 0 ? 0.8 : 0), 6.5, 0.3], wrist: [2.7 + (s < 0 ? 0.8 : 0), 4.0, 0.8], r: [0.4, 0.3, 0.2], skin: BK, kind: 'wet', fingers: 5, fingerLen: 1.4, fingerR: 0.07, claw: 0.35, clawColor: '#00e5ff', clawGlow: 1 });
      if (s < 0) R.jitter(A.name, 0.7);
    }
    return R.build();
  },

  // The Void: a colossal black titan with violet cracks, eyes all over its body, a vertical mouth
  // in its chest and a crown of tentacles writhing on its head
  voidTitan() {
    const R = new Rig(113, '#2a0a5a');
    const VD = { color: '#17121f', color2: '#050308', amp: 0.12, freq: 1.1, mottle: 0.25, veins: { color: '#a040ff', width: 0.07, freq: 1.0, glow: 1.4 } };
    const EO = { iris: ['#ff8af0', '#b04aff', '#ffd0ff'], iris2: '#2a0040', sclera: '#1a0a24', pupil: 'slit', skin: VD, scleraGlow: 0.05 };
    for (const s of [-1, 1]) {
      leg(R, s, { pts: [[1.6, 7, 0], [1.9, 3.8, 0.6], [1.8, 0.9, 0]], r: [1.2, 0.95, 0.75], skin: VD, foot: [0.95, 0.6, 1.5], toes: 3, claw: 0.7, clawColor: '#2a1040' });
    }
    R.add(blob(V(0, 7.4, 0), [2.2, 1.2, 1.5], { ...VD, seed: 3 }));
    const AB = [V(0, 9.4, 0.2), [2.4, 1.8, 1.7], { ...VD, seed: 4 }];
    const CH = [V(0, 11.8, 0), [3.2, 2.4, 2.1], { ...VD, seed: 5 }];
    R.add(blob(...AB));
    R.add(blob(...CH));
    R.add(blob(V(0, 13.6, -0.6), [3.6, 1.4, 1.8], { ...VD, seed: 6 }));
    R.add(blob(V(0, 10.4, 1.95), [0.55, 1.65, 0.45], { color: '#1a0010', color2: DARK, glow: 0.2 }), 'wet', '', false);
    for (let i = 0; i < 9; i++) {
      for (const s of [-1, 1]) {
        const y = 9.0 + i * 0.32;
        R.add(cone(V(0.55 * s, y, 2.1), V(0.1 * s, y - 0.05, 2.25), 0.07, { color: '#e0d0f0', color2: '#6a5a80' }), 'wet', '', false);
      }
    }
    R.add(limb([V(0, 8.7, 2.05), V(0.62, 10.4, 2.1), V(0, 12.1, 2.0)], 0.12, 0.12, { color: '#a040ff', color2: '#4a0a8a', glow: 1 }), 'wet', '', false);
    R.add(limb([V(0, 8.7, 2.05), V(-0.62, 10.4, 2.1), V(0, 12.1, 2.0)], 0.12, 0.12, { color: '#a040ff', color2: '#4a0a8a', glow: 1 }), 'wet', '', false);
    eyesOver(R, '', ...CH, 10, [0.3, 0.55], { ...EO, az: 1.4, elMin: -0.3, elMax: 0.6 }, (az) => Math.abs(az) < 0.35);
    eyesOver(R, '', ...AB, 5, [0.28, 0.45], { ...EO, az: 1.2, elMin: -0.4, elMax: 0.4 }, (az) => Math.abs(az) < 0.4);
    const head = R.part('head', V(0, 13.8, 0.2));
    const HC = V(0, 15.1, 0.4), HR = [1.45, 1.55, 1.45];
    R.add(blob(HC, HR, { ...VD, amp: 0.05 }), 'skin', head);
    eyesOver(R, head, HC, HR, { ...VD, amp: 0.05 }, 8, [0.22, 0.42], { ...EO, az: 0.9, elMin: -0.3, elMax: 0.6 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const base = V(Math.sin(a) * 0.9, 16.2, 0.4 + Math.cos(a) * 0.9);
      const out = V(Math.sin(a), 0, Math.cos(a));
      const t = R.part(`crown${i}`, base, head);
      R.add(limb([base, base.clone().addScaledVector(out, 0.9).add(V(0, 1.4, 0)), base.clone().addScaledVector(out, 1.8).add(V(0, 2.6, 0)), base.clone().addScaledVector(out, 1.3).add(V(0, 3.8, 0))], 0.38, 0.04, { ...VD, amp: 0.03, seed: 40 + i }), 'skin', t);
      R.swing(t, 'x', { idle: 0.12, awake: 0.25, speed: 0.8 + (i % 3) * 0.25, phase: i * 1.7 });
      R.swing(t, 'z', { idle: 0.1, awake: 0.2, speed: 0.6 + (i % 2) * 0.3, phase: i });
    }
    for (const s of [-1, 1]) {
      const A = arm(R, s, { shoulder: [3.4, 12.7, 0], elbow: [4.5, 9.3, 0.4], wrist: [4.7, 6.1, 1.2], r: [1.0, 0.8, 0.6], skin: VD, fingers: 4, fingerLen: 1.8, fingerR: 0.2, claw: 0.75, clawColor: '#3a1060', clawGlow: 0.4 });
      const c = A.S.clone().lerp(A.E, 0.45);
      R.eye(c.clone().add(V(0.35 * s, 0, 0.7)), V(0.4 * s, 0, 1), 0.28, { ...EO, iris: '#ff8af0' }, A.name);
    }
    return R.build();
  },
};

// The Backrooms: a tall shadow with little horns, two white glowing eyes and an enormous grin of
// needle teeth that splits its face from ear to ear, long arms and hooked claws
HORROR_BUILDERS.grinner = function grinner() {
  const R = new Rig(131, '#5a0a3a');
  const SH = { color: '#1a1420', color2: '#06040a', amp: 0.08, freq: 1.4, mottle: 0.25, veins: { color: '#ff3aa8', width: 0.05, freq: 1.2, glow: 0.8 } };
  for (const s of [-1, 1]) {
    leg(R, s, { pts: [[0.9, 6.6, 0], [1.1, 3.6, 0.5], [1.0, 0.8, 0]], r: [0.6, 0.42, 0.3], skin: SH, foot: [0.5, 0.35, 1.0], toes: 3, claw: 0.45, clawColor: '#0a0608' });
  }
  R.add(blob(V(0, 7.0, 0), [1.4, 0.9, 1.0], { ...SH, seed: 3 }));
  R.add(limb([V(0, 7.4, 0), V(0, 9.0, 0.2), V(0, 10.6, 0)], 1.1, 1.5, { ...SH, bulge: -0.15, seed: 4 }));
  R.add(blob(V(0, 11.0, 0), [2.2, 1.4, 1.4], { ...SH, seed: 5 }));
  // the drip of shadow from its back
  R.add(sheet([-1, 0, 1].map((x) => V(x * 0.9, 11.6, -1.2)), V(0, -1, -0.15).normalize(), 7, { color: '#120c16', color2: '#000', amp: 0.1, freq: 2, seed: 6, billow: 0.5 }), 'membrane');
  const head = R.part('head', V(0, 12.1, 0.2));
  const HC = V(0, 13.8, 0.35), HR = [1.9, 1.75, 1.6];
  R.add(blob(HC, HR, { ...SH, amp: 0.04, seed: 7 }), 'skin', head);
  for (const s of [-1, 1]) {
    R.add(cone(V(1.0 * s, 15.1, -0.1), V(1.5 * s, 16.7, -0.4), 0.35, { color: '#2a1a24', color2: '#000' }), 'skin', head, false);
    const { p, n } = onBlob(HC, HR, SH, s * 0.42, 0.32, 0.12);
    R.eye(p, n, 0.42, { iris: '#ffffff', iris2: '#c8c8d8', irisSize: 1.2, pupil: 'round', pupilSize: 0.12, sclera: '#f2f2ff', skin: SH, stretch: [1.25, 0.8], tilt: -s * 0.3 }, head);
  }
  // the grin: a wide dark crescent with two rows of white needles
  const jaw = R.part('jaw', V(0, 13.2, 0.2), head);
  R.add(blob(V(0, 12.95, 1.6), [1.55, 0.42, 0.45], { color: '#1a0410', color2: DARK, glow: 0.15 }), 'wet', head, false);
  teethRow(R, head, V(0, 13.3, 1.95), 3.0, 16, 0.42, V(0, -1, 0.1), { r: 0.06, curve: 0.22, color: '#ffffff', color2: '#c8c8d0' });
  teethRow(R, jaw, V(0, 12.6, 1.85), 2.8, 15, 0.36, V(0, 1, 0.1), { r: 0.06, curve: 0.22, color: '#ffffff', color2: '#c8c8d0' });
  R.add(blob(V(0, 12.55, 1.2), [1.5, 0.45, 0.95], { ...SH, amp: 0 }), 'skin', jaw);
  R.swing(jaw, 'x', { idle: 0.02, awake: 0.05, open: 0.32, speed: 2 });
  R.swing(head, 'z', { idle: 0.08, awake: 0.16, speed: 0.6 });
  for (const s of [-1, 1]) {
    arm(R, s, { shoulder: [2.1, 11.1, 0], elbow: [2.9, 7.6, 0.4], wrist: [3.1, 4.0, 1.0], r: [0.5, 0.36, 0.24], skin: SH, fingers: 4, fingerLen: 1.8, fingerR: 0.1, claw: 0.6, clawColor: '#0a0608' });
  }
  return R.build();
};

// The Nightmare (final stage): a giant floating octopus: a swollen veined mantle, one huge eye and
// a ring of smaller ones, a hooked beak and eight thick tentacles that never stop curling
HORROR_BUILDERS.eyeKraken = function eyeKraken() {
  const R = new Rig(149, '#4a0a20');
  const SK = { color: '#7a2a4a', color2: '#2a0a18', amp: 0.12, freq: 1.0, mottle: 0.3, veins: { color: '#ff5a2a', width: 0.06, freq: 1.0, glow: 1.0 } };
  const MC = V(0, 12.6, -0.6), MR = [4.0, 4.6, 4.2];
  R.add(blob(MC, MR, { ...SK, seed: 3, seg: 44, rows: 30, rot: [-0.25, 0, 0] }), 'wet');
  R.add(blob(V(0, 7.6, 0.4), [3.6, 2.4, 3.4], { ...SK, seed: 4 }), 'wet');
  // the big eye, the smaller ones round it
  const big = onBlob(V(0, 8.0, 0.4), [3.6, 2.4, 3.4], SK, 0, 0.25, 0.6);
  R.eye(big.p, big.n, 1.45, { iris: '#ffcc22', iris2: '#a02000', pupil: 'slit', skin: SK, sclera: '#f0e2b8' });
  for (const [az, el, r] of [[-0.75, 0.35, 0.55], [0.75, 0.35, 0.55], [-1.2, 0.05, 0.42], [1.2, 0.05, 0.42], [-0.45, 0.75, 0.4], [0.45, 0.75, 0.4]]) {
    const { p, n } = onBlob(V(0, 8.0, 0.4), [3.6, 2.4, 3.4], SK, az, el, r * 0.4);
    R.eye(p, n, r, { iris: '#ff6a1a', pupil: 'slit', skin: SK, sclera: '#f0e2b8' });
  }
  eyesOver(R, '', MC, MR, { ...SK, seed: 3 }, 9, [0.3, 0.6], { iris: ['#ffcc22', '#ff4a2a'], pupil: 'slit', skin: SK, az: Math.PI, elMin: -0.1, elMax: 0.8 });
  // the beak, under the eyes
  const jaw = R.part('jaw', V(0, 6.2, 1.6));
  R.add(cone(V(0, 6.4, 2.8), V(0, 5.2, 4.2), 0.7, { color: '#1a1414', color2: '#000' }), 'wet', '', false);
  R.add(cone(V(0, 5.6, 2.8), V(0, 5.0, 3.8), 0.55, { color: '#2a2020', color2: '#000' }), 'wet', jaw, false);
  R.swing(jaw, 'x', { idle: 0.04, awake: 0.08, open: 0.4, speed: 2.2 });
  // eight tentacles round the bottom, curling out and down
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const out = V(Math.sin(a), 0, Math.cos(a));
    const base = V(Math.sin(a) * 2.6, 6.2, 0.4 + Math.cos(a) * 2.4);
    const t = R.part(`tk${i}`, base);
    const pts = [base, base.clone().addScaledVector(out, 2.2).add(V(0, -2.0, 0)), base.clone().addScaledVector(out, 3.6).add(V(0, -4.4, 0)),
      base.clone().addScaledVector(out, 4.2).add(V(0, -6.0, 0)), base.clone().addScaledVector(out, 5.6).add(V(0, -5.4, 0)), base.clone().addScaledVector(out, 6.2).add(V(0, -4.0, 0))];
    R.add(limb(pts, 0.95, 0.1, { ...SK, amp: 0.05, seed: 20 + i }), 'wet', t);
    for (let k = 1; k < 5; k++) R.add(blob(pts[k].clone().addScaledVector(out, -0.5).add(V(0, -0.3, 0)), [0.22, 0.12, 0.22], { color: '#f2b8c8', color2: '#a05a70' }), 'wet', t, false);
    R.swing(t, 'x', { idle: 0.12, awake: 0.25, run: 0.15, speed: 0.9 + (i % 3) * 0.25, phase: i * 0.8 });
    R.swing(t, 'z', { idle: 0.1, awake: 0.2, speed: 0.7 + (i % 2) * 0.3, phase: i * 1.6 });
  }
  return R.build();
};

// The Nightmare (final stage): a towering alien with a huge human skull for a head. A thin grey-black
// body with glowing veins and a ridge of spines down its back, arms that reach past its knees with
// long clawed fingers, digitigrade legs and a long barbed tail. The skull is cracked old bone with
// deep sockets where burning eyes open when an egg is stolen, and its jaw drops open wide.
HORROR_BUILDERS.skullAlien = function skullAlien() {
  const R = new Rig(167, '#4a1a06');
  const SK = { color: '#3a3a44', color2: '#121218', amp: 0.06, freq: 1.3, mottle: 0.3, veins: { color: '#ff6a1a', width: 0.05, freq: 2.0, glow: 1.1 } };
  const BONE = { color: '#e6dcc2', color2: '#a8946a', amp: 0.03, freq: 2.2, mottle: 0.25 };
  // legs bent backwards like an animal's, clawed feet
  for (const s of [-1, 1]) {
    leg(R, s, { pts: [[0.9, 7.4, -0.2], [1.2, 4.8, 1.2], [1.1, 2.4, -0.6], [1.1, 0.7, 0.2]], r: [0.62, 0.42, 0.3, 0.26], skin: SK, foot: [0.45, 0.3, 1.1], toes: 3, claw: 0.6, clawColor: '#e6dcc2' });
  }
  // the thin body: a narrow waist, a ribbed chest
  R.add(blob(V(0, 7.8, -0.1), [1.4, 0.9, 1.0], { ...SK, seed: 3 }));
  R.add(limb([V(0, 8.2, -0.1), V(0, 9.4, 0.1), V(0, 10.4, 0)], 0.75, 1.0, { ...SK, bulge: -0.2, seed: 4 }));
  R.add(blob(V(0, 11.3, 0.1), [1.9, 1.5, 1.25], { ...SK, seed: 5 }));
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) R.add(limb([V(0.2 * s, 10.5 + i * 0.4, 1.2), V(1.2 * s, 10.6 + i * 0.4, 0.9), V(1.7 * s, 10.7 + i * 0.4, 0.1)], 0.1, 0.08, BONE), 'skin', '', false);
  }
  // spines down its back
  for (let i = 0; i < 7; i++) R.add(cone(V(0, 7.8 + i * 0.75, -1.0 - Math.sin(i / 2) * 0.15), V(0, 8.3 + i * 0.75, -2.2), 0.2, { color: '#e6dcc2', color2: '#6a5a3a', glow: 0.15 }), 'skin', '', false);
  // the long barbed tail, swaying
  const tail = R.part('tail', V(0, 7.6, -0.9));
  R.add(limb([V(0, 7.6, -0.9), V(0, 6.0, -3.0), V(0, 4.0, -5.0), V(0.6, 3.6, -7.4), V(0.2, 5.0, -9.0)], 0.5, 0.1, { ...SK, seed: 6 }), 'skin', tail);
  R.add(cone(V(0.2, 5.0, -9.0), V(0.1, 6.2, -9.9), 0.35, { color: '#e6dcc2', color2: '#6a5a3a', rad: 4 }), 'skin', tail, false);
  R.swing(tail, 'y', { idle: 0.18, awake: 0.32, speed: 1.0 });
  // a thin neck up into the skull
  R.add(limb([V(0, 12.4, 0), V(0, 13.4, 0.35), V(0, 14.2, 0.5)], 0.45, 0.38, { ...SK, seed: 7 }));
  const head = R.part('head', V(0, 14.0, 0.5));
  // the skull: a big rounded cranium, a little long at the back like an alien's, cheekbones, a brow
  const CC = V(0, 16.2, 0.2), CR = [2.0, 2.0, 2.3];
  R.add(blob(CC, CR, BONE), 'skin', head);
  R.add(blob(V(0, 16.6, -1.6), [1.5, 1.5, 1.6], { ...BONE, seed: 9 }), 'skin', head);
  R.add(blob(V(0, 15.0, 1.15), [1.25, 0.8, 0.95], { ...BONE, seed: 11 }), 'skin', head); // the upper jaw
  for (const s of [-1, 1]) R.add(blob(V(s * 1.2, 15.35, 1.25), [0.4, 0.3, 0.45], BONE), 'skin', head);
  R.add(blob(V(0, 16.75, 2.0), [1.55, 0.3, 0.45], BONE), 'skin', head); // the brow ridge
  // deep sockets with the eyes inside
  for (const s of [-1, 1]) {
    const { p, n } = onBlob(CC, CR, BONE, s * 0.36, 0.08, 0.1);
    R.add(blob(p.clone().addScaledVector(n, -0.05), [0.58, 0.56, 0.3], { color: '#060403', color2: '#000' }), 'skin', head, false);
    R.eye(p.clone().addScaledVector(n, 0.08), n, 0.27, { iris: '#ff5a1a', iris2: '#7a0a00', sclera: '#1a0400', irisSize: 1.15, pupil: 'slit', skin: BONE, hood: -0.2 }, head);
  }
  R.add(cone(V(0, 15.45, 2.35), V(0, 15.95, 2.4), 0.24, { color: '#060403', color2: '#000', rad: 3 }), 'skin', head, false); // the nose hole
  // cracks over the cranium
  // cracks over the cranium, lying on the bone
  for (const [az, el] of [[-0.5, 0.75], [0.35, 0.9], [0.8, 0.6]]) {
    const a = onBlob(CC, CR, BONE, az, el, -0.02), b = onBlob(CC, CR, BONE, az + 0.15, el - 0.22, -0.02), c = onBlob(CC, CR, BONE, az - 0.05, el - 0.42, -0.02);
    R.add(limb([a.p, b.p, c.p], 0.06, 0.04, { color: '#2a1a0a', color2: '#000' }), 'skin', head, false);
  }
  // the upper teeth, and the jaw that drops open
  teethRow(R, head, V(0, 14.55, 2.12), 1.8, 10, 0.34, V(0, -1, 0.05), { r: 0.1, curve: 0.25, color: '#f2ead2', color2: '#9a8a60' });
  const jaw = R.part('jaw', V(0, 14.8, 0.4), head);
  R.add(blob(V(0, 14.0, 1.05), [1.2, 0.4, 0.95], BONE), 'skin', jaw);
  teethRow(R, jaw, V(0, 14.25, 2.02), 1.7, 9, 0.3, V(0, 1, 0.05), { r: 0.09, curve: 0.25, color: '#f2ead2', color2: '#9a8a60' });
  R.add(blob(V(0, 14.35, 1.45), [1.0, 0.25, 0.6], { color: '#1a0604', color2: DARK, glow: 0.3 }), 'wet', head, false); // the dark throat glowing a little
  R.swing(jaw, 'x', { idle: 0.03, awake: 0.06, open: 0.45, speed: 1.8 });
  R.swing(head, 'z', { idle: 0.06, awake: 0.12, speed: 0.5 });
  // arms that hang past its knees, long clawed fingers
  for (const s of [-1, 1]) {
    arm(R, s, { shoulder: [2.1, 12.0, 0], elbow: [2.8, 8.6, 0.5], wrist: [3.0, 5.2, 1.0], r: [0.5, 0.38, 0.26], skin: SK, handSkin: { ...SK, veins: undefined }, fingers: 4, fingerLen: 2.0, fingerR: 0.11, claw: 0.7, clawColor: '#e6dcc2' });
  }
  return R.build();
};

// The Void (stage 9): a colossal sprawling octopus of cracked purple stone. Its head is a crown of
// jagged spikes over three glowing eyes (a slit eye on the brow), magenta veins glowing through
// the cracks, eight huge tentacles curling out over the ground with rings of glowing pink suckers,
// and golden tendrils of light winding between them.
HORROR_BUILDERS.voidKraken = function voidKraken() {
  const R = new Rig(181, '#5a0a8a');
  const SK = { color: '#4a2a7a', color2: '#160a2a', amp: 0.1, freq: 1.4, mottle: 0.3, veins: { color: '#ff3ae0', width: 0.06, freq: 1.0, glow: 1.3 } };
  const SUCK = { color: '#ff7ae8', color2: '#c02aa8', glow: 0.9, mottle: 0.1 };
  const GOLD = { color: '#ffd84a', color2: '#ff9a10', glow: 1.0, mottle: 0.15 };
  const MC = V(0, 4.2, 0), MR = [3.4, 3.0, 3.2];
  R.add(blob(MC, MR, { ...SK, seed: 3, seg: 40, rows: 28 }), 'wet');
  R.add(blob(V(0, 2.0, 0.6), [3.8, 1.6, 3.4], { ...SK, seed: 4 }), 'wet');
  // the crown of jagged spikes, swept back
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * 2.6;
    const base = V(Math.sin(a) * 2.2, 6.4 + Math.cos(a) * 0.5, -0.4 + Math.cos(a) * 0.6);
    const len = 2.2 + (1 - Math.abs(i / 10 - 0.5) * 2) * 2.4;
    R.add(cone(base, base.clone().add(V(Math.sin(a) * 1.2, len, -1.2)), 0.55, { ...SK, veins: undefined, color: '#3a1e60', color2: '#140822' }), 'skin', '', false);
  }
  // three eyes: two angry ones and a slit eye on the brow
  for (const s of [-1, 1]) {
    const { p, n } = onBlob(MC, MR, SK, s * 0.38, 0.0, 0.1);
    R.eye(p, n, 0.95, { iris: '#ff9af8', iris2: '#c02ad8', sclera: '#ffd8fa', irisSize: 1.0, pupil: 'slit', skin: SK, stretch: [1.35, 0.7], tilt: s * 0.35, hood: -0.25 });
  }
  const brow = onBlob(MC, MR, SK, 0, 0.42, 0.1);
  R.eye(brow.p, brow.n, 0.85, { iris: '#ff9af8', iris2: '#c02ad8', sclera: '#ffd8fa', pupil: 'slit', skin: SK, stretch: [0.55, 1.2] });
  // eight huge tentacles lying out over the ground, tips curling up
  // spread round the sides and back, none straight in front, so the face stays clear
  for (let i = 0; i < 8; i++) {
    const a = 0.75 + (i / 7) * (Math.PI * 2 - 1.5);
    const o = V(Math.sin(a), 0, Math.cos(a));
    const side = V(o.z, 0, -o.x);
    const base = V(o.x * 2.8, 2.0, 0.6 + o.z * 2.6);
    const t = R.part(`vt${i}`, base);
    const curl = i % 2 ? 1 : -1;
    const pts = [base, base.clone().addScaledVector(o, 3).add(V(0, -1.2, 0)), base.clone().addScaledVector(o, 6.5).add(V(0, -1.4, 0)),
      base.clone().addScaledVector(o, 9.5).addScaledVector(side, curl * 1.5).add(V(0, -1.0, 0)), base.clone().addScaledVector(o, 11).addScaledVector(side, curl * 3).add(V(0, 1.2, 0)),
      base.clone().addScaledVector(o, 10).addScaledVector(side, curl * 3.6).add(V(0, 3.4, 0))];
    R.add(limb(pts, 1.5, 0.15, { ...SK, amp: 0.06, seed: 30 + i }), 'wet', t);
    // glowing sucker rings down the underside
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let k = 1; k < 9; k++) {
      const u = k / 10, p = curve.getPointAt(u), r = 1.5 + (0.15 - 1.5) * u;
      // on the upper side, so they show (the tentacles lie on the ground)
      const ring = flesh(new THREE.TorusGeometry(r * 0.4, r * 0.17, 6, 14).rotateX(Math.PI / 2).translate(p.x, p.y + r * 1.02, p.z), SUCK);
      R.add(ring, 'wet', t, false);
    }
    R.swing(t, 'y', { idle: 0.05, awake: 0.12, speed: 0.6 + (i % 3) * 0.2, phase: i });
    R.swing(t, 'x', { idle: 0.03, awake: 0.08, speed: 0.8 + (i % 2) * 0.3, phase: i * 1.7 });
  }
  // golden tendrils of light winding through
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 1;
    const o = V(Math.sin(a), 0, Math.cos(a));
    R.add(limb([V(o.x * 2.2, 5.0, o.z * 2.2), V(o.x * 4.6, 7.0, o.z * 4.4), V(o.x * 7.2, 6.4, o.z * 6.8)], 0.42, 0.1, { ...GOLD, amp: 0 }), 'wet', '', false);
  }
  return R.build();
};

export const HORRORS = new Set(Object.keys(HORROR_BUILDERS));

export function buildHorror(type) {
  return HORROR_BUILDERS[type]();
}
