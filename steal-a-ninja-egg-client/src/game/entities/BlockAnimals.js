// The animals that hatch from eggs, built from many small blocks.
//
// Each animal is first sculpted as smooth shapes (ellipsoids, tapered capsules, boxes: S.E / S.C / S.B)
// and then cut into a grid of small cubes (voxelize), so its outline is the real animal's (a scorpion's
// raised tail, a shark's fins, an octopus's curling arms) while it is made of blocks. Every block gets
// a slightly different shade, and the colours are each stage's own, not the real animal's. Parts
// marked glow (eyes, stingers, spots, lava cracks) are unlit and shine out at night (setPetNight).
//
// Sizes: the first stage's animals are about a player's size, from the second stage on they are
// bigger than the player, and from the fifth stage each stage's rarest animal is a giant, taller
// than the walls round the game (PET_LOOK below, world units).

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PLOT_SCALE } from '../../shared/gameData.js';

// ------------------------------------------------------------------ sculpting

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

class Sculpt {
  constructor() {
    this.prims = [];
    this.part = 'body';
    this.parts = { body: { kind: 'body', pivot: null } };
  }
  // Everything added until end() moves as one part, turning round pivot when the animal walks.
  // kind: 'leg' (swings forward and back), 'crawl' (a set of crawling legs, lifting in turn), 'tail',
  // 'head', 'wing' (flaps), 'arm' (a tentacle, curling), 'fish' (a fish's tail, beating). o: { phase, side }
  begin(name, kind, pivot, o = {}) {
    this.parts[name] ??= { kind, pivot: pivot.clone(), phase: o.phase ?? 0, side: o.side ?? 1 };
    this.part = name;
    return this;
  }
  end() { this.part = 'body'; return this; }
  // o: { glow, paint (only recolours), sub (carves away), rot: [x, y, z] }; col: '#hex' or (x, y, z) => '#hex' | ['#hex', glow]
  add(kind, data, col, o = {}) {
    let inv = null;
    if (o.rot) inv = _m.makeRotationFromQuaternion(_q.setFromEuler(_e.set(...o.rot))).clone().invert().elements;
    this.prims.push({ kind, ...data, col, glow: !!o.glow, paint: !!o.paint, sub: !!o.sub, inv, rot: o.rot || null, part: this.part });
    return this;
  }
  E(c, r, col, o) { return this.add('e', { c, r }, col, o); }
  C(a, b, r0, r1, col, o) { return this.add('c', { a, b, r0, r1 }, col, o); }
  B(c, h, col, o) { return this.add('b', { c, h }, col, o); }
  // a chain of capsules through points (legs, tails, tentacles), radius going r0 -> r1
  chain(pts, r0, r1, col, o) {
    for (let i = 0; i < pts.length - 1; i++) {
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      this.C(pts[i], pts[i + 1], r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, col, o);
    }
    return this;
  }
}

function local(p, x, y, z) {
  let lx = x - p.c.x, ly = y - p.c.y, lz = z - p.c.z;
  if (p.inv) {
    const m = p.inv;
    const ax = m[0] * lx + m[4] * ly + m[8] * lz, ay = m[1] * lx + m[5] * ly + m[9] * lz, az = m[2] * lx + m[6] * ly + m[10] * lz;
    lx = ax; ly = ay; lz = az;
  }
  return [lx, ly, lz];
}

function dist(p, x, y, z) {
  if (p.kind === 'e') {
    const [lx, ly, lz] = local(p, x, y, z);
    const r = p.r;
    const k0 = Math.hypot(lx / r[0], ly / r[1], lz / r[2]);
    const k1 = Math.hypot(lx / (r[0] * r[0]), ly / (r[1] * r[1]), lz / (r[2] * r[2]));
    return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
  }
  if (p.kind === 'c') {
    const ax = x - p.a.x, ay = y - p.a.y, az = z - p.a.z;
    const bx = p.b.x - p.a.x, by = p.b.y - p.a.y, bz = p.b.z - p.a.z;
    const bb = bx * bx + by * by + bz * bz;
    const h = bb ? Math.max(0, Math.min(1, (ax * bx + ay * by + az * bz) / bb)) : 0;
    return Math.hypot(ax - bx * h, ay - by * h, az - bz * h) - (p.r0 + (p.r1 - p.r0) * h);
  }
  const [lx, ly, lz] = local(p, x, y, z);
  const qx = Math.abs(lx) - p.h[0], qy = Math.abs(ly) - p.h[1], qz = Math.abs(lz) - p.h[2];
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}

function bounds(p) {
  if (p.kind === 'c') {
    const r = Math.max(p.r0, p.r1);
    return [Math.min(p.a.x, p.b.x) - r, Math.min(p.a.y, p.b.y) - r, Math.min(p.a.z, p.b.z) - r, Math.max(p.a.x, p.b.x) + r, Math.max(p.a.y, p.b.y) + r, Math.max(p.a.z, p.b.z) + r];
  }
  const r = p.kind === 'e' ? Math.max(...p.r) : Math.hypot(...p.h);
  return [p.c.x - r, p.c.y - r, p.c.z - r, p.c.x + r, p.c.y + r, p.c.z + r];
}

const _col = new THREE.Color();
function hash3(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1440662319) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Builds the sculpt as smooth, rounded shapes (the real animal's look, no blocks): every ellipsoid,
// capsule and box becomes a mesh; the paint shapes recolour the surface they cover; glowing parts
// carry a glow value per vertex (lit up by the material, brighter at night). One merged geometry per
// moving part. Returns the same { parts, size } as voxelize.
const _sv = new THREE.Vector3(), _sq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
function smoothen(S) {
  const solid = S.prims.filter((p) => !p.paint && !p.sub);
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of solid) {
    const pb = bounds(p);
    for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], pb[i]); b[i + 3] = Math.max(b[i + 3], pb[i + 3]); }
  }
  const dim = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  const pad = dim / 70; // how close to a paint shape a vertex must be to take its colour
  // the lowest point of the shapes stands on y = 0, centred on x / z
  const shift = new THREE.Vector3(-(b[0] + b[3]) / 2, -b[1], -(b[2] + b[5]) / 2);
  const partNames = Object.keys(S.parts);
  const lists = partNames.map(() => []);
  const paints = S.prims.filter((p) => p.paint);
  const darks = S.prims.filter((p) => p.sub); // carved holes (an open mouth) become dark insides
  const shape = (p) => {
    if (p.kind === 'e') {
      const g = new THREE.SphereGeometry(1, 22, 16).scale(p.r[0], p.r[1], p.r[2]);
      if (p.rot) g.applyQuaternion(_sq.setFromEuler(new THREE.Euler(...p.rot)));
      return g.translate(p.c.x, p.c.y, p.c.z);
    }
    if (p.kind === 'c') {
      const len = p.a.distanceTo(p.b);
      if (p.r1 <= p.r0 * 0.2 && len > 1e-4) {
        // a sharp spike (a tooth, a claw, a horn): a cheap cone on a little round base
        const c = new THREE.CylinderGeometry(p.r1, p.r0, len, 7, 1, true).translate(0, len / 2, 0);
        c.applyQuaternion(_sq.setFromUnitVectors(_up, _sv.copy(p.b).sub(p.a).normalize()));
        c.translate(p.a.x, p.a.y, p.a.z);
        return mergeGeometries([new THREE.SphereGeometry(p.r0, 7, 5).translate(p.a.x, p.a.y, p.a.z), c].map((g) => g.toNonIndexed()));
      }
      const parts = [new THREE.SphereGeometry(p.r0, 14, 10).translate(p.a.x, p.a.y, p.a.z), new THREE.SphereGeometry(Math.max(0.01, p.r1), 14, 10).translate(p.b.x, p.b.y, p.b.z)];
      if (len > 1e-4) {
        const c = new THREE.CylinderGeometry(p.r1, p.r0, len, 14, Math.max(1, Math.round(len / Math.max(p.r0, p.r1))), true).translate(0, len / 2, 0);
        c.applyQuaternion(_sq.setFromUnitVectors(_up, _sv.copy(p.b).sub(p.a).normalize()));
        parts.push(c.translate(p.a.x, p.a.y, p.a.z));
      }
      return mergeGeometries(parts.map((g) => g.toNonIndexed()));
    }
    const g = new THREE.BoxGeometry(p.h[0] * 2, p.h[1] * 2, p.h[2] * 2);
    if (p.rot) g.applyQuaternion(_sq.setFromEuler(new THREE.Euler(...p.rot)));
    return g.translate(p.c.x, p.c.y, p.c.z);
  };
  const add = (p, colPrim, forceCol = null) => {
    let g = shape(p);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g, 1e-4); // welded, so it shades smoothly and can be bent without cracks
    g.computeVertexNormals();
    // a little lumpy, like muscle / fur / scales under the skin (scaled to the part's size)
    const size = p.kind === 'e' ? Math.min(...p.r) : p.kind === 'c' ? Math.max(p.r0, p.r1) : Math.min(...p.h);
    const amp = size * 0.035, fq = 2.4 / Math.max(0.05, size);
    {
      const ps = g.attributes.position, nr = g.attributes.normal;
      for (let i = 0; i < ps.count; i++) {
        const x = ps.getX(i), y = ps.getY(i), z = ps.getZ(i);
        const d = (Math.sin(x * fq + 1.3) * Math.sin(y * fq * 1.2 + 0.7) * Math.sin(z * fq * 0.9 + 2.1) + 0.5 * Math.sin(x * fq * 2.3 + y * fq * 1.9)) * amp;
        ps.setXYZ(i, x + nr.getX(i) * d, y + nr.getY(i) * d, z + nr.getZ(i) * d);
      }
      g.computeVertexNormals();
    }
    const nrm = g.attributes.normal;
    const pos = g.attributes.position, n = pos.count;
    const col = new Float32Array(n * 3), glow = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let win = colPrim;
      for (const q of paints) if (dist(q, x, y, z) <= pad) win = q;
      let c = forceCol || (typeof win.col === 'function' ? win.col(x, y, z) : win.col);
      let gl = win.glow;
      if (Array.isArray(c)) { gl = gl || c[1]; c = c[0]; }
      _col.set(c);
      // mottled (patches a little lighter / darker, like real skin or fur) and darker underneath
      const m = Math.sin(x * 2.1 + Math.sin(z * 1.7) * 1.4) * Math.sin(y * 2.4 + Math.sin(x * 1.3)) * 0.5 + Math.sin(z * 4.3 + y * 3.1) * 0.25;
      const k = gl ? 1 : (0.9 + m * 0.16) * (0.72 + 0.28 * (nrm.getY(i) * 0.5 + 0.5));
      col[i * 3] = _col.r * k; col[i * 3 + 1] = _col.g * k; col[i * 3 + 2] = _col.b * k;
      glow[i] = gl ? 1 : 0;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    lists[partNames.indexOf(p.part)].push(g);
  };
  for (const p of solid) add(p, p);
  for (const p of darks) add({ ...p, part: p.part }, p, '#1a0608');
  const parts = partNames.map((name, i) => {
    const info = S.parts[name];
    if (!lists[i].length) return null;
    const geo = mergeGeometries(lists[i]);
    geo.translate(shift.x, shift.y, shift.z);
    let pivot = null;
    if (info.pivot) {
      pivot = info.pivot.clone().add(shift);
      geo.translate(-pivot.x, -pivot.y, -pivot.z);
    }
    // (the shapes keep their own smooth normals)
    geo.computeBoundingSphere();
    return { name, kind: info.kind, phase: info.phase, side: info.side, pivot, body: geo, glow: null };
  }).filter(Boolean);
  return { parts, size: [b[3] - b[0], b[4] - b[1], b[5] - b[2]] };
}

// Cuts the sculpt into cubes: res cubes along its longest side. Returns { body, glow, size }.
function voxelize(S, res) {
  const solid = S.prims.filter((p) => !p.paint && !p.sub);
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of solid) {
    const pb = bounds(p);
    for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], pb[i]); b[i + 3] = Math.max(b[i + 3], pb[i + 3]); }
  }
  const size = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / res;
  const nx = Math.ceil((b[3] - b[0]) / size) + 1, ny = Math.ceil((b[4] - b[1]) / size) + 1, nz = Math.ceil((b[5] - b[2]) / size) + 1;
  const cell = new Uint8Array(nx * ny * nz); // 0 empty, 1 solid, 2 glowing
  const partNames = Object.keys(S.parts);
  const partOf = new Uint8Array(nx * ny * nz);
  const color = new Float32Array(nx * ny * nz * 3);
  const idx = (i, j, k) => (k * ny + j) * nx + i;
  // a block counts as inside when its middle is within half a block of the shape (thin parts survive)
  const pad = size * 0.5;
  for (let k = 0; k < nz; k++) {
    const z = b[2] + (k + 0.5) * size;
    for (let j = 0; j < ny; j++) {
      const y = b[1] + (j + 0.5) * size;
      for (let i = 0; i < nx; i++) {
        const x = b[0] + (i + 0.5) * size;
        let win = null;
        for (const p of S.prims) {
          if (p.sub || p.paint) continue;
          if (dist(p, x, y, z) <= pad) win = p;
        }
        if (!win) continue;
        if (S.prims.some((p) => p.sub && dist(p, x, y, z) <= 0)) continue;
        const part = partNames.indexOf(win.part);
        for (const p of S.prims) if (p.paint && dist(p, x, y, z) <= pad) win = p;
        let c = typeof win.col === 'function' ? win.col(x, y, z) : win.col;
        let glow = win.glow;
        if (Array.isArray(c)) { glow = glow || c[1]; c = c[0]; }
        _col.set(c);
        // every block a little different: lighter / darker, now and then a darker block
        const h = hash3(i, j, k);
        const shade = (glow ? 0.95 : 0.88) + h * 0.2 - (h < 0.07 ? 0.14 : 0);
        const n = idx(i, j, k);
        cell[n] = glow ? 2 : 1;
        partOf[n] = part;
        color[n * 3] = _col.r * shade; color[n * 3 + 1] = _col.g * shade; color[n * 3 + 2] = _col.b * shade;
      }
    }
  }
  // the outer faces only
  const out = partNames.map(() => ({ body: { pos: [], nor: [], col: [] }, glow: { pos: [], nor: [], col: [] } }));
  const ox = -(nx * size) / 2, oz = -(nz * size) / 2; // centred on x / z, standing on y = 0
  let minJ = ny;
  for (let n = 0; n < cell.length; n++) if (cell[n]) minJ = Math.min(minJ, Math.floor(n / nx) % ny);
  const oy = -minJ * size;
  const FACES = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [-1, 0, 0, [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]],
    [0, 1, 0, [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]], [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [0, 0, 1, [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]]], [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const n = idx(i, j, k);
    if (!cell[n]) continue;
    const t = cell[n] === 2 ? out[partOf[n]].glow : out[partOf[n]].body;
    for (const [dx, dy, dz, quad] of FACES) {
      const ii = i + dx, jj = j + dy, kk = k + dz;
      if (ii >= 0 && jj >= 0 && kk >= 0 && ii < nx && jj < ny && kk < nz && cell[idx(ii, jj, kk)] && partOf[idx(ii, jj, kk)] === partOf[n]) continue;
      const v = quad.map(([a, bb, c]) => [ox + (i + a) * size, oy + (j + bb) * size, oz + (k + c) * size]);
      for (const q of [0, 1, 2, 0, 2, 3]) {
        t.pos.push(...v[q]);
        t.nor.push(dx, dy, dz);
        t.col.push(color[n * 3], color[n * 3 + 1], color[n * 3 + 2]);
      }
    }
  }
  // the sculpt's coordinates -> the geometry's (centred on x / z, standing on y = 0)
  const shift = new THREE.Vector3(ox - b[0], oy - b[1], oz - b[2]);
  const geo = (d, pivot) => {
    if (!d.pos.length) return null;
    const g = new THREE.BufferGeometry();
    if (pivot) for (let i = 0; i < d.pos.length; i += 3) { d.pos[i] -= pivot.x; d.pos[i + 1] -= pivot.y; d.pos[i + 2] -= pivot.z; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(d.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  const parts = partNames.map((name, i) => {
    const info = S.parts[name];
    const pivot = info.pivot ? info.pivot.clone().add(shift) : null;
    return { name, kind: info.kind, phase: info.phase, side: info.side, pivot, body: geo(out[i].body, pivot), glow: geo(out[i].glow, pivot) };
  }).filter((p) => p.body || p.glow);
  return { parts, size: [nx * size, (ny - minJ) * size, nz * size] };
}

// ------------------------------------------------------------------ anatomy helpers

const eyePair = (S, x, y, z, r, color, glow = true) => { for (const s of [-1, 1]) S.E(V(s * x, y, z), [r, r, r], color, { glow }); };

// Every animal is a monster: its mouth hangs open and is full of sharp teeth.
const TOOTH = '#fbf6e6';
const GUM = '#6a0a14';
const tooth = (S, base, tip, r) => S.C(base, tip, r, r * 0.12, TOOTH);
// angry brows slanting down over the eyes (x = the eyes' distance from the middle)
const brows = (S, x, y, z, r, col = '#140c0c') => { for (const s of [-1, 1]) S.E(V(s * x, y, z), [r * 1.5, r * 0.4, r * 0.6], col, { rot: [0, 0, s * 0.5] }); };
// Open jaws along a snout running from (z0, y0, radius r0) to its tip (z1, y1, r1), along +z: the
// lower jaw hangs open below it, a red mouth between them, a row of fangs down each side of the upper
// jaw (the front ones longest, like canines), fangs up from the lower jaw and little front teeth.
function jaws(S, z0, y0, r0, z1, y1, r1, jawCol, o = {}) {
  const gape = (r0 + r1) * (o.gape ?? 0.75);
  const ja = V(0, y0 - r0 * 0.7, z0 - r0 * 0.2), jb = V(0, y1 - r1 - gape, z1 - r1 * 0.2);
  const jr0 = r0 * 0.55, jr1 = r1 * 0.62;
  S.C(ja, jb, jr0, jr1, jawCol);                                                    // the lower jaw
  S.C(V(0, y0 - r0 * 0.55, z0 + r0 * 0.1), V(0, (y1 - r1 * 0.6 + jb.y + jr1 * 0.6) / 2, z1 - r1 * 0.55), r0 * 0.48, r1 * 0.6, GUM); // the mouth inside
  const n = o.n ?? 5, big = o.big ?? 1;
  for (const sd of [-1, 1]) for (let k = 0; k < n; k++) {
    const t = (k + 0.6) / n;
    const z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t, r = r0 + (r1 - r0) * t;
    const len = r * (k === n - 1 ? 1.05 : 0.6) * big;                             // the canines at the front
    const bx = sd * r * 0.7, by = y - r * 0.62;
    tooth(S, V(bx, by, z), V(bx * 0.96, by - len, z + r * 0.08), r * 0.15 * big);
    // the lower jaw's fangs, pointing up
    const jy = ja.y + (jb.y - ja.y) * t, jz = ja.z + (jb.z - ja.z) * t, jr = jr0 + (jr1 - jr0) * t;
    const lx = sd * jr * 0.62, ly = jy + jr * 0.7;
    tooth(S, V(lx, ly, jz), V(lx * 0.96, ly + jr * (k === n - 1 ? 1.4 : 0.85) * big, jz + jr * 0.1), jr * 0.22 * big);
  }
  for (let k = -1; k <= 1; k++) tooth(S, V(k * r1 * 0.3, y1 - r1 * 0.6, z1 + r1 * 0.45), V(k * r1 * 0.3, y1 - r1 * 0.6 - r1 * 0.5 * big, z1 + r1 * 0.5), r1 * 0.13 * big);
}
// a ring of fangs round a round mouth (centre c, radius r) facing +z, pointing inwards
function fangRing(S, c, r, n, len, tr) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = V(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.z);
    tooth(S, p, V(c.x + Math.cos(a) * (r - len), c.y + Math.sin(a) * (r - len), c.z + len * 0.3), tr);
  }
}
// a fanged maw on the front of a round head/body: a dark red hole ringed with fangs
function maw(S, c, w, h, depth, n = 7, big = 1) {
  S.E(c, [w, h, depth], GUM);
  S.E(V(c.x, c.y, c.z + depth * 0.88), [w * 0.8, h * 0.7, depth * 0.18], '#120306'); // the dark throat
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * 1.7 * w;
    const edge = Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
    const len = h * (0.55 + (i % 2) * 0.25) * big;
    tooth(S, V(x, c.y + h * 0.8 * edge, c.z + depth * 0.55), V(x, c.y + h * 0.8 * edge - len, c.z + depth * 0.65), w * 0.1 * big);
    tooth(S, V(x * 0.9, c.y - h * 0.8 * edge, c.z + depth * 0.55), V(x * 0.9, c.y - h * 0.8 * edge + len * 0.8, c.z + depth * 0.65), w * 0.09 * big);
  }
}

// A four-legged animal, built like the real one: a deep chest, a barrel and haunches (with a tucked
// waist for the hunters), shoulder and thigh muscles, a neck that can curve (a camel's S), a skull
// with its own muzzle, and legs in three parts: the hind legs bend back at the hock like a real
// animal's, and end in paws, hooves, a camel's flat pads or an elephant's round pillars.
// o: { len (shoulder to rump), h (top of the back), w (half width), depth (half the chest's height),
//   tuck (0..1 slimmer waist), body, belly, legCol, footCol, foot: 'paw' | 'hoof' | 'pad' | 'pillar',
//   legW, neck: [points from the chest, the last is where the head sits], neckR [base, top], neckCol,
//   head (skull size), headCol, snout (muzzle length), muzzle [base, tip radius x head], drop (muzzle
//   droop), snoutCol, nose, jaws (false: none), gape, ears: pointy | round | long | flap | small,
//   earSize, earCol, eye, tail: [points], tailR, tailEnd, tailCol, bushy (a fox's tail) }
// Returns where things are, so decorations can sit on the animal: { headC, hr, tip, backY, chestZ, rumpZ, neckBase, neckTop }
function quadruped(S, o) {
  const L = o.len, H = o.h, W = o.w;
  const D = o.depth ?? W;                 // half the chest's height
  const cy = H - D;                       // the body's middle
  const fz = L / 2 - D * 0.75, rz = -L / 2 + D * 0.8; // the shoulders and the hips
  const tuck = o.tuck ?? 0;
  const body = o.body, legCol = o.legCol || o.body;
  // the trunk: a deep chest, the barrel (slimmer at a tucked waist) and the haunches
  S.E(V(0, cy, fz - D * 0.15), [W, D, D * 1.1], body);
  S.E(V(0, cy + D * 0.2 * tuck, (fz + rz) / 2), [W * (0.95 - tuck * 0.18), D * (0.95 - tuck * 0.32), (fz - rz) * 0.62], body);
  S.E(V(0, cy + D * 0.08, rz + D * 0.15), [W * 0.95, D * 0.9, D * 1.05], body);
  S.E(V(0, cy + D * 0.28, (fz + rz) / 2), [W * 0.82, D * 0.72, (fz - rz) / 2 + D * 0.9], body); // the back, one smooth line
  for (const s of [-1, 1]) {
    S.E(V(s * W * 0.35, cy - D * 0.1, fz + D * 0.05), [W * 0.6, D * 0.8, D * 0.5], body, { rot: [0.25, 0, 0] }); // shoulder
    S.E(V(s * W * 0.35, cy - D * 0.05, rz + D * 0.05), [W * 0.62, D * 0.88, D * 0.7], body, { rot: [-0.2, 0, 0] }); // thigh
  }
  if (o.belly) S.E(V(0, cy - D * 0.55, (fz + rz) / 2 + D * 0.3), [W * 0.8, D * 0.55, (fz - rz) * 0.75], o.belly, { paint: true });
  // the neck: from the chest, through its points; the head sits on the last one
  const neckBase = V(0, cy + D * 0.35, fz + D * 0.45);
  const pts = [neckBase, ...(o.neck || [V(0, cy + D * 1.4, fz + D * 1.3)])];
  const [nr0, nr1] = o.neckR || [D * 0.62, D * 0.42];
  S.chain(pts, nr0, nr1, o.neckCol || body);
  const neckTop = pts[pts.length - 1];
  const hr = o.head ?? D * 0.75;
  const headC = V(0, neckTop.y + hr * 0.25, neckTop.z + hr * 0.3);
  S.begin('head', 'head', neckTop);
  const headCol = o.headCol || body;
  S.E(headC, [hr * 0.78, hr * 0.74, hr * 0.92], headCol); // the skull
  S.E(V(0, headC.y - hr * 0.3, headC.z + hr * 0.1), [hr * 0.62, hr * 0.5, hr * 0.7], headCol); // cheeks
  const sn = o.snout ?? hr * 0.6;
  const [m0, m1] = o.muzzle || [0.48, 0.3];
  const mb = V(0, headC.y - hr * 0.15, headC.z + hr * 0.5);
  const tip = V(0, mb.y - (o.drop ?? sn * 0.18), mb.z + sn);
  S.C(mb, tip, hr * m0, hr * m1, o.snoutCol || headCol); // the muzzle
  if (o.nose) S.E(V(0, tip.y + hr * m1 * 0.45, tip.z + hr * m1 * 0.75), [hr * m1 * 0.85, hr * m1 * 0.6, hr * m1 * 0.5], o.nose);
  if (o.jaws !== false) jaws(S, mb.z, mb.y, hr * m0, tip.z, tip.y, hr * m1, o.jawCol || o.snoutCol || headCol, { n: sn > hr ? 6 : 4, gape: o.gape ?? 0.5, big: 0.8 });
  eyePair(S, hr * 0.5, headC.y + hr * 0.18, headC.z + hr * 0.55, hr * 0.15, o.eye || '#ffd21f');
  brows(S, hr * 0.48, headC.y + hr * 0.36, headC.z + hr * 0.6, hr * 0.13);
  const es = o.earSize ?? 1, earCol = o.earCol || headCol;
  for (const s of [-1, 1]) {
    if (o.ears === 'pointy') S.C(V(s * hr * 0.42, headC.y + hr * 0.55, headC.z - hr * 0.15), V(s * hr * (0.42 + 0.25 * es), headC.y + hr * (0.55 + 0.85 * es), headC.z - hr * 0.3), hr * 0.3 * es, hr * 0.03, earCol);
    if (o.ears === 'small') S.C(V(s * hr * 0.45, headC.y + hr * 0.55, headC.z - hr * 0.2), V(s * hr * 0.55, headC.y + hr * 0.95, headC.z - hr * 0.3), hr * 0.22, hr * 0.05, earCol);
    if (o.ears === 'round') S.E(V(s * hr * 0.6, headC.y + hr * 0.6, headC.z - hr * 0.3), [hr * 0.22 * es, hr * 0.26 * es, hr * 0.1], earCol, { rot: [0, 0, -s * 0.4] });
    if (o.ears === 'long') S.E(V(s * hr * 0.45, headC.y + hr * 0.95, headC.z - hr * 0.3), [hr * 0.16, hr * 0.55 * es, hr * 0.12], earCol, { rot: [-0.15, 0, -s * 0.15] });
    if (o.ears === 'flap') S.E(V(s * hr * 0.8, headC.y - hr * 0.15 * es, headC.z - hr * 0.2), [hr * 0.12, hr * 0.7 * es, hr * 0.45 * es], earCol, { rot: [0.15, 0, s * 0.25] });
  }
  S.end();
  // the legs stand straight under the body (they looked crooked with deep bends): front (upper arm,
  // forearm, a short pastern) and hind (thigh, gaskin, cannon), with only a slight knee and hock
  const lw = o.legW ?? W * 0.28;
  const foot = o.foot || 'paw';
  const fh = foot === 'hoof' ? lw * 1.1 : foot === 'pillar' ? lw * 0.5 : lw * 0.55; // the foot's height
  const straight = foot === 'pillar';
  const fcol = o.footCol || legCol;
  for (const [s, f] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const x = s * W * 0.58;
    const top = V(x, cy - D * 0.1, f > 0 ? fz : rz);
    // a walk: the diagonal pairs move together (front-left with back-right)
    S.begin(`leg${s}${f}`, 'leg', top, { phase: s * f > 0 ? Math.PI : 0 });
    let ground;
    if (f > 0) {
      const elbow = V(x, cy - D * 0.85, top.z - (straight ? 0 : D * 0.06));
      const wrist = V(x, fh + (cy - fh) * 0.25, elbow.z);
      ground = V(x, fh, wrist.z + (straight ? 0 : lw * 0.1));
      const k = straight ? [1.45, 1.3, 1.2, 1.1, 1.05] : [1.55, 1.05, 0.68, 0.7, 0.65];
      S.C(top, elbow, lw * k[0], lw * k[1], legCol);
      S.C(elbow, wrist, lw * k[1], lw * k[2], legCol);
      S.C(wrist, ground, lw * k[3], lw * k[4], legCol);
    } else {
      const knee = V(x, cy - D * 0.95, top.z + (straight ? 0 : D * 0.12));
      const hock = V(x, fh + (cy - fh) * 0.32, top.z - (straight ? 0 : D * 0.14));
      ground = V(x, fh, hock.z + (straight ? 0 : lw * 0.1));
      const k = straight ? [1.6, 1.35, 1.2, 1.1, 1.05] : [1.75, 1.15, 0.62, 0.62, 0.6];
      S.C(top, knee, lw * k[0], lw * k[1], legCol);
      S.C(knee, hock, lw * k[1], lw * k[2], legCol);
      S.C(hock, ground, lw * k[3], lw * k[4], legCol);
    }
    if (foot === 'hoof') S.C(V(ground.x, fh, ground.z), V(ground.x, lw * 0.15, ground.z + lw * 0.2), lw * 0.68, lw * 0.85, fcol);
    else if (foot === 'pad') S.E(V(ground.x, fh * 0.6, ground.z + lw * 0.4), [lw * 1.15, fh * 0.65, lw * 1.5], fcol);
    else if (foot === 'pillar') S.C(V(ground.x, fh * 1.6, ground.z), V(ground.x, fh * 0.6, ground.z), lw * 1.08, lw * 1.12, fcol);
    else S.E(V(ground.x, fh * 0.75, ground.z + lw * 0.45), [lw * 0.85, fh * 0.8, lw * 1.15], fcol);
    S.end();
  }
  // the tail, from the top of the rump
  const tailRoot = V(0, cy + D * 0.6, rz - D * 0.7);
  if (o.tail) {
    S.begin('tail', 'tail', tailRoot);
    const tp = [tailRoot, ...o.tail];
    S.chain(tp, o.tailR ?? W * 0.18, o.tailEnd ?? W * 0.06, o.tailCol || body);
    if (o.bushy) { // a full brush: thick in the middle, thinner at the root and the tip
      const n = (tp.length - 1) * 4;
      for (let i = 1; i < n; i++) {
        const u = i / n * (tp.length - 1), j = Math.min(tp.length - 2, Math.floor(u));
        const a = tp[j], b = tp[j + 1];
        const at = a.clone().lerp(b, u - j);
        const r = o.bushy * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, i / n * 1.15)));
        S.E(at, [r, r * 0.95, Math.max(r * 1.5, a.distanceTo(b) * 0.6)], o.tailCol || body, { rot: [Math.atan2(-(b.y - a.y), b.z - a.z), 0, 0] }); // its long side along the tail
      }
    }
    S.end();
  }
  return { headC, hr, tip, backY: H, chestZ: fz, rumpZ: rz, neckBase, neckTop, tailRoot, cy, D };
}

// A two-legged monster (vampire, werewolf). o: { h (height), skin, top (shirt/fur), legs (trousers),
// feet, head [build(S, at)], arms [hand colour], claws, hunch, wide, tail }
function biped(S, o) {
  const H = o.h, W = o.wide ?? 1;
  const hipY = H * 0.47, shY = H * 0.78;
  // torso: hips, belly, broad chest, shoulders
  S.E(V(0, hipY + H * 0.03, 0), [H * 0.13 * W, H * 0.07, H * 0.09], o.legs);
  S.C(V(0, hipY + H * 0.05, 0), V(0, shY - H * 0.04, (o.hunch ?? 0) * H * 0.06), H * 0.1 * W, H * 0.14 * W, o.top);
  S.E(V(0, shY - H * 0.05, (o.hunch ?? 0) * H * 0.06), [H * 0.17 * W, H * 0.08, H * 0.1], o.top);
  if (o.chest) o.chest(S, V(0, shY - H * 0.12, H * 0.08 + (o.hunch ?? 0) * H * 0.06));
  // the neck and the head (it nods with each step)
  const neck = V(0, shY + H * 0.02, (o.hunch ?? 0) * H * 0.1);
  S.C(V(0, shY - H * 0.04, 0), neck, H * 0.045 * W, H * 0.04 * W, o.neck || o.skin);
  S.begin('head', 'head', neck);
  // the head is drawn by o.head round its middle c, scaled up by headScale (a proxy that scales every shape)
  const k = o.headScale ?? 1.45, c = V(0, shY + H * 0.15, (o.hunch ?? 0) * H * 0.13);
  const at = (p) => V(c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k, c.z + (p.z - c.z) * k);
  const HS = {
    E: (p, r, col, op = {}) => S.E(at(p), r.map((v) => v * k), col, op),
    C: (a2, b2, r0, r1, col, op) => S.C(at(a2), at(b2), r0 * k, r1 * k, col, op),
    B: (p, h, col, op) => S.B(at(p), h.map((v) => v * k), col, op),
  };
  o.head(HS, c);
  S.end();
  // the legs: thigh, shin, foot; swinging in turn
  for (const sd of [-1, 1]) {
    const hip = V(sd * H * 0.07 * W, hipY, 0);
    S.begin(`leg${sd}`, 'leg', hip, { phase: sd > 0 ? 0 : Math.PI });
    const knee = V(sd * H * 0.075 * W, H * 0.25, o.digi ? -H * 0.02 : H * 0.015);
    const ankle = V(sd * H * 0.075 * W, H * 0.05, o.digi ? -H * 0.06 : 0);
    S.C(hip, knee, H * 0.055 * W, H * 0.042 * W, o.legs);
    S.C(knee, ankle, H * 0.042 * W, H * 0.03 * W, o.shin || o.legs);
    S.E(V(ankle.x, H * 0.025, ankle.z + H * 0.05), [H * 0.04 * W, H * 0.028, H * 0.08], o.feet);
    if (o.claws) for (let k = -1; k <= 1; k++) S.C(V(ankle.x + k * H * 0.018, H * 0.02, ankle.z + H * 0.11), V(ankle.x + k * H * 0.02, H * 0.005, ankle.z + H * 0.15), H * 0.01, H * 0.002, o.claws);
    S.end();
  }
  // the arms swing opposite the legs
  for (const sd of [-1, 1]) {
    const sh = V(sd * H * 0.19 * W, shY - H * 0.03, (o.hunch ?? 0) * H * 0.05);
    S.begin(`arm${sd}`, 'leg', sh, { phase: sd > 0 ? Math.PI : 0 });
    const elbow = V(sd * H * 0.23 * W, shY - H * 0.21, H * 0.02);
    const wrist = V(sd * H * 0.24 * W, shY - H * (o.longArms ? 0.43 : 0.37), H * 0.06);
    S.E(sh, [H * 0.06 * W, H * 0.06, H * 0.06], o.top);
    S.C(sh, elbow, H * 0.045 * W, H * 0.036 * W, o.sleeve || o.top);
    S.C(elbow, wrist, H * 0.036 * W, H * 0.028 * W, o.sleeve || o.top);
    S.E(V(wrist.x, wrist.y - H * 0.025, wrist.z + H * 0.01), [H * 0.03, H * 0.04, H * 0.024], o.hand || o.skin);
    for (let k = -1; k <= 1; k++) {
      const base = V(wrist.x + k * H * 0.012, wrist.y - H * 0.055, wrist.z + H * 0.015);
      S.C(base, V(base.x + k * H * 0.004, base.y - H * 0.04, base.z + H * 0.012), H * 0.008, H * 0.004, o.claws || o.hand || o.skin, o.claws ? { glow: false } : {});
    }
    S.end();
  }
  if (o.tail) { S.begin('tail', 'tail', V(0, hipY, -H * 0.08)); S.chain(o.tail.map((p) => V(p[0] * H, p[1] * H, p[2] * H)), H * 0.05, H * 0.015, o.tailCol || o.top); S.end(); }
  if (o.cape) o.cape(S, H, shY);
}

// a fish / shark swimming along +z, or rearing straight up (vertical: jumping out of the water)
function shark(S, o) {
  const L = o.len, R = o.r;
  const at = (z, y = 0) => (o.vertical ? V(0, z + L * 0.55, -y * 0.6) : V(0, R * 1.6 + y, z)); // along the body
  S.E(at(0), o.vertical ? [R * 0.9, L / 2, R] : [R * 0.9, R, L / 2], o.body);
  // the pale belly on the underside (on the front when it rears up)
  if (o.vertical) S.E(V(0, L * 0.5, R * 0.75), [R * 0.75, L * 0.4, R * 0.45], o.belly, { paint: true });
  else S.E(at(-L * 0.05, -R * 0.35), [R * 0.8, R * 0.7, L * 0.42], o.belly, { paint: true });
  // the tail
  S.begin('tail', 'fish', at(-L * 0.38));
  S.C(at(-L * 0.4), at(-L * 0.62), R * 0.45, R * 0.15, o.body);
  S.C(at(-L * 0.6), at(-L * 0.78, R * 1.6), R * 0.22, R * 0.05, o.fin || o.body);
  S.C(at(-L * 0.6), at(-L * 0.72, -R * 1.2), R * 0.2, R * 0.05, o.fin || o.body);
  S.end();
  // the dorsal fin and the side fins
  S.C(at(0.05 * L, R * 0.8), at(-0.1 * L, R * 2.1), R * 0.3, R * 0.05, o.fin || o.body);
  for (const s of [-1, 1]) {
    const a = at(L * 0.15, -R * 0.4);
    S.C(a, V(a.x + s * R * 1.7, a.y - (o.vertical ? 0 : R * 0.5), a.z - (o.vertical ? -R * 0.5 : R * 0.6)), R * 0.25, R * 0.05, o.fin || o.body);
  }
  // the head: eyes, a mouth line of teeth (open wide when breaching)
  const hp = at(L * 0.4, R * 0.1);
  eyePair(S, R * 0.7, hp.y + (o.vertical ? 0 : R * 0.15), hp.z + (o.vertical ? R * 0.15 : 0), R * 0.2, o.eye || '#ff3a2a');
  // gill slits behind the head
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) {
    const g = at(L * (0.26 - k * 0.04));
    S.E(o.vertical ? V(sd * R * 0.85, g.y, g.z) : V(sd * R * 0.85, g.y - R * 0.1, g.z), o.vertical ? [R * 0.2, R * 0.06, R * 0.5] : [R * 0.2, R * 0.55, R * 0.06], '#14080c', { paint: true });
  }
  if (o.vertical) {
    // the jaws gaping open on the front: a deep red mouth ringed with rows of huge white teeth
    const my = L * 0.88, mz = R * 0.9, mh = L * 0.13;
    S.E(V(0, my, mz), [R * 0.85, mh, R * 0.55], GUM);
    S.E(V(0, my, mz + R * 0.5), [R * 0.68, mh * 0.78, R * 0.1], '#120306'); // the dark throat
    for (const [row, k] of [[0, 1], [1, 0.75]]) for (let i = 0; i < 11; i++) {
      const a = (i / 10 - 0.5) * 2.7;
      for (const up of [1, -1]) {
        const y0 = my + up * mh * (0.86 - row * 0.12);
        const x = Math.sin(a) * R * 0.74 * k, z = mz + Math.cos(a) * R * 0.38 * k + R * 0.05;
        tooth(S, V(x, y0, z), V(x * 0.92, y0 - up * mh * (0.42 - row * 0.1), z + R * 0.06), R * (0.14 - row * 0.03));
      }
    }
  } else {
    // the lower jaw dropped wide open, the red mouth inside, a row (or two) of teeth up and down
    const ja = at(L * 0.14, -R * 0.7), jb = at(L * 0.46, -R * 1.3);
    S.C(ja, jb, R * 0.55, R * 0.36, o.belly || o.body);
    S.E(at(L * 0.38, -R * 0.82), [R * 0.6, R * 0.36, L * 0.1], GUM);
    const rows = o.rows ?? 1;
    for (let row = 0; row < rows; row++) for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.6, k = 1 - row * 0.2;
      const up = at(L * 0.37 + Math.cos(a) * L * 0.075 * k, -R * 0.55);
      const x = Math.sin(a) * R * 0.6 * k;
      tooth(S, V(x, up.y, up.z), V(x * 0.95, up.y - R * (0.5 - row * 0.12), up.z + R * 0.1), R * (0.16 - row * 0.03));
      const lo = at(L * 0.42 + Math.cos(a) * L * 0.06 * k, -R * 1.05);
      tooth(S, V(x * 0.9, lo.y, lo.z), V(x * 0.85, lo.y + R * (0.42 - row * 0.1), lo.z + R * 0.1), R * (0.14 - row * 0.03));
    }
  }
  if (o.bill) S.C(at(L * 0.48), at(L * 0.48 + o.bill), R * 0.2, R * 0.03, o.billCol || o.fin || o.body);
  if (o.spots) for (let i = 0; i < o.spots.n; i++) S.E(at(-L * 0.35 + (i / o.spots.n) * L * 0.75, (i % 2 ? 0.6 : -0.1) * R), [R * 0.18, R * 0.18, R * 0.18], o.spots.col, { paint: true, glow: true });
  if (o.stripes) for (let i = 0; i < 4; i++) S.E(at(-L * 0.2 + i * L * 0.15), o.vertical ? [R * 1.02, L * 0.04, R * 1.02] : [R * 1.02, R * 1.02, L * 0.05], o.stripes, { paint: true, glow: !!o.stripeGlow });
}

function scorpion(S, o) {
  const B = o.body;
  S.E(V(0, 1.7, 1.6), [1.7, 0.8, 1.9], B);
  for (let i = 0; i < 5; i++) S.E(V(0, 1.6, -0.3 - i * 1.05), [1.5 - i * 0.08, 0.75, 0.62], i % 2 ? o.body2 : B);
  // the tail arching up and over the back, the stinger at its tip
  const tail = [V(0, 1.7, -5.2), V(0, 3.4, -6.6), V(0, 5.6, -6.2), V(0, 7.4, -4.4), V(0, 8.0, -2.0), V(0, 7.4, -0.1)];
  S.begin('tail', 'tail', V(0, 1.7, -4.8));
  tail.forEach((p, i) => S.E(p, [0.62 - i * 0.04, 0.62 - i * 0.04, 0.62 - i * 0.04], i % 2 ? o.body2 : B));
  S.chain(tail, 0.48, 0.36, B);
  S.E(V(0, 6.9, 0.6), [0.7, 0.75, 0.8], o.sting, { glow: true });
  S.C(V(0, 6.6, 1.0), V(0, 5.6, 1.9), 0.3, 0.05, o.sting, { glow: true });
  S.end();
  // pincers
  for (const s of [-1, 1]) {
    S.chain([V(s * 1.3, 1.7, 2.6), V(s * 2.6, 1.9, 3.6), V(s * 2.9, 1.9, 4.8)], 0.42, 0.36, B);
    S.E(V(s * 3.0, 2.0, 5.8), [0.95, 0.7, 1.3], o.claw);
    S.C(V(s * 2.7, 2.1, 6.6), V(s * 2.2, 2.0, 7.9), 0.35, 0.08, o.claw);
    S.C(V(s * 3.3, 1.9, 6.6), V(s * 3.0, 1.8, 7.7), 0.32, 0.07, o.claw);
    // four legs a side, in two sets that lift in turn
    for (let k = 0; k < 4; k++) {
      const z = 1.6 - k * 1.1;
      const set = (k + (s > 0 ? 1 : 0)) % 2;
      S.begin(`legs${set}`, 'crawl', V(0, 1.7, 0), { phase: set * Math.PI });
      S.chain([V(s * 1.3, 1.7, z), V(s * 3.0, 2.6, z + 0.2), V(s * 4.0, 0.1, z - 0.3 + k * 0.1)], 0.26, 0.12, o.legs || B);
      S.end();
    }
  }
  eyePair(S, 0.45, 2.45, 3.0, 0.28, o.eye || '#ff3a2a');
  brows(S, 0.45, 2.75, 3.05, 0.22);
  // hooked fangs and a toothy mouth under the eyes
  S.E(V(0, 1.55, 3.35), [0.7, 0.4, 0.3], GUM);
  for (const sd of [-1, 1]) S.chain([V(sd * 0.55, 1.9, 3.2), V(sd * 0.6, 1.2, 3.8), V(sd * 0.3, 0.75, 3.95)], 0.22, 0.05, TOOTH);
  for (let k = -2; k <= 2; k++) tooth(S, V(k * 0.18, 1.8, 3.5), V(k * 0.18, 1.35, 3.6), 0.07);
  if (o.stripes) for (let i = 0; i < 5; i++) S.E(V(0, 2.25, -0.3 - i * 1.05), [0.5, 0.25, 0.25], o.stripes, { paint: true, glow: true });
}

function crab(S, o) {
  S.E(V(0, 2.4, 0), [3.2, 1.3, 2.4], o.body);
  maw(S, V(0, 2.2, 2.2), 1.3, 0.55, 0.35, 7, 1.2); // a wide mouth full of fangs on its front
  if (o.bands) S.E(V(0, 2.4, 0), [3.25, 1.35, 2.45], (x, y) => (y > 3.2 ? o.bands[2] : y > 2.6 ? o.bands[1] : o.bands[0]), { paint: true });
  for (const s of [-1, 1]) {
    S.C(V(s * 0.7, 3.2, 2), V(s * 0.9, 4.6, 2.4), 0.18, 0.15, o.legs);
    S.E(V(s * 0.9, 4.8, 2.4), [0.42, 0.42, 0.42], o.eye || '#ffd21f', { glow: true });
    S.E(V(s * 0.85, 5.15, 2.45), [0.45, 0.12, 0.2], '#140c0c', { rot: [0, 0, s * 0.5] });
    S.chain([V(s * 2.6, 2.2, 1.6), V(s * 4.0, 2.8, 2.8), V(s * 4.3, 3.0, 3.9)], 0.45, 0.4, o.legs);
    S.E(V(s * 4.4, 3.2, 5.0), [1.15, 0.95, 1.6], o.claw);
    S.C(V(s * 4.0, 3.5, 5.9), V(s * 3.5, 3.6, 7.2), 0.4, 0.1, o.claw);
    S.C(V(s * 4.8, 3.0, 5.9), V(s * 4.5, 2.8, 6.9), 0.36, 0.1, o.claw);
    for (let k = 0; k < 3; k++) {
      const z = 0.8 - k * 1.2;
      const set = (k + (s > 0 ? 1 : 0)) % 2;
      S.begin(`legs${set}`, 'crawl', V(0, 2.2, 0), { phase: set * Math.PI });
      S.chain([V(s * 2.8, 2.2, z), V(s * 4.6, 3.0, z - 0.3), V(s * 5.6, 0.1, z - 0.8)], 0.3, 0.12, o.legs);
      S.end();
    }
  }
}

function octopus(S, o) {
  const raised = !!o.raised;
  S.E(V(0, raised ? 7 : 5.4, -0.6), [2.6, 3.2, 2.8], o.body, { rot: [-0.35, 0, 0] });
  S.E(V(0, raised ? 4.6 : 3.2, 0.4), [2.4, 1.6, 2.3], o.body);
  eyePair(S, 1.45, raised ? 5.0 : 3.6, 1.9, 0.55, o.eye || '#ffd21f');
  brows(S, 1.4, raised ? 5.6 : 4.2, 2.0, 0.45);
  // a round mouth under the eyes, ringed with fangs
  const mc = V(0, raised ? 3.8 : 2.4, 2.45);
  S.E(mc, [1.0, 0.85, 0.35], GUM);
  S.E(V(mc.x, mc.y, mc.z + 0.3), [0.75, 0.62, 0.08], '#120306');
  fangRing(S, V(mc.x, mc.y, mc.z + 0.15), 0.8, 12, 0.55, 0.12);
  if (o.spots) for (let i = 0; i < 9; i++) S.E(V(Math.sin(i * 2.4) * 2.2, (raised ? 6.4 : 4.8) + Math.cos(i * 1.7) * 1.8, -0.6 + Math.cos(i * 2.4) * 2), [0.35, 0.35, 0.35], o.spots, { paint: true, glow: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const ox = Math.sin(a), oz = Math.cos(a);
    const base = V(ox * 1.7, raised ? 3.6 : 2.4, 0.4 + oz * 1.7);
    let pts;
    if (raised && i % 2 === 0) {
      // the raised arms: up and curling at the top, taller than the body
      pts = [base, V(ox * 3.4, 6, oz * 3.4), V(ox * 4.2, 11, oz * 4.2), V(ox * 3.6, 15.5, oz * 3.6), V(ox * 2.2, 17.5, oz * 2.2), V(ox * 1.4, 16.2, oz * 1.4)];
    } else {
      pts = [base, V(ox * 3.2, 0.9, 0.4 + oz * 3.2), V(ox * 5.0, 0.5, 0.4 + oz * 5.0), V(ox * 6.4, 1.2, 0.4 + oz * 6.4), V(ox * 6.9, 2.4, 0.4 + oz * 6.2)];
    }
    S.begin(`arm${i}`, 'arm', base, { phase: i * 0.8 });
    S.chain(pts, 0.85, 0.12, o.arms || o.body);
    // suckers: little round pads standing out of the arm's underside
    if (o.suckers) for (let k = 1; k < pts.length - 1; k++) {
      const r = 0.85 + (0.12 - 0.85) * (k / (pts.length - 1));
      S.E(V(pts[k].x * 0.92, pts[k].y - r * 0.7, pts[k].z * 0.92), [r * 0.45, r * 0.3, r * 0.45], o.suckers, { glow: !!o.suckerGlow });
    }
    S.end();
  }
}

function spider(S, o) {
  S.E(V(0, 3.2, -1.8), [2.6, 2.2, 2.9], o.body);
  S.E(V(0, 2.8, 1.4), [1.6, 1.2, 1.6], o.body2 || o.body);
  if (o.mark) { S.E(V(0, 5.0, -1.8), [0.6, 0.6, 1.0], o.mark, { paint: true, glow: true }); }
  for (let k = 0; k < 4; k++) eyePair(S, 0.35 + (k % 2) * 0.5, 3.4 + Math.floor(k / 2) * 0.4, 2.85, 0.22, o.eye || '#ff2a2a');
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const z = 2.2 - k * 0.9, spread = 1 - k * 0.1;
    const set = (k + (s > 0 ? 1 : 0)) % 2;
    S.begin(`legs${set}`, 'crawl', V(0, 2.8, 0), { phase: set * Math.PI });
    S.chain([V(s * 1.2, 2.8, z), V(s * 3.8, 5.6, z + (1.5 - k) * 0.9 * spread), V(s * 6.2, 0.1, z + (1.5 - k) * 1.8 * spread)], 0.32, 0.12, o.legs || o.body);
    S.end();
  }
  // big curved fangs and a toothy mouth between them
  S.E(V(0, 2.2, 2.75), [0.55, 0.4, 0.3], GUM);
  for (const s of [-1, 1]) S.chain([V(s * 0.5, 2.6, 2.6), V(s * 0.6, 1.6, 3.4), V(s * 0.3, 0.9, 3.5)], 0.3, 0.06, o.fang || TOOTH);
  for (let k = -1; k <= 1; k++) tooth(S, V(k * 0.2, 2.45, 2.95), V(k * 0.2, 1.95, 3.05), 0.08);
}

function wings(S, o, y, z, span, col, edge) {
  for (const s of [-1, 1]) {
    S.begin(`wing${s}`, 'wing', V(s * 0.5, y, z), { side: s });
    S.E(V(s * span * 0.5, y, z), [span * 0.5, 0.18, span * 0.32], col, { rot: [0, s * 0.25, s * 0.12] });
    S.E(V(s * span * 0.55, y - 0.1, z - span * 0.35), [span * 0.42, 0.16, span * 0.22], col, { rot: [0, -s * 0.2, s * 0.1] });
    if (edge) S.chain([V(s * 0.6, y + 0.1, z + 0.3), V(s * span * 0.6, y + 0.4, z + span * 0.2), V(s * span, y + 0.1, z - span * 0.1)], 0.22, 0.1, edge);
    S.end();
  }
}

// ------------------------------------------------------------------ the animals

const ANIMALS = {
  // ---------- Pumpkin Patch (about a player's size)
  // a dromedary: long thin legs with flat pads, the neck dipping forward then rising in an S, a
  // small head held high on a long muzzle; its hump is a pumpkin
  pumpkinCamel(S) {
    const q = quadruped(S, { len: 6, h: 6.6, w: 1.15, depth: 1.25, tuck: 0.15, body: '#ff8a1a', belly: '#ffc070', legCol: '#e8701a', foot: 'pad', footCol: '#c85a14', legW: 0.28,
      neck: [V(0, 5.3, 3.8), V(0, 6.4, 4.9), V(0, 7.6, 5.3)], neckR: [0.62, 0.34], head: 0.62, snout: 0.85, muzzle: [0.46, 0.32], drop: 0.1, ears: 'round', earSize: 0.6, eye: '#ffd21f',
      tail: [V(0, 5.6, -3.2), V(0, 4.4, -3.3)], tailR: 0.14, tailEnd: 0.1 });
    S.E(V(0, q.backY + 0.35, -0.2), [1.0, 1.15, 1.35], (x, y, z) => (Math.abs(Math.sin(Math.atan2(x, z) * 4)) < 0.14 ? '#d8620a' : '#ff7a10')); // the pumpkin hump, ribbed
    S.C(V(0, q.backY + 1.4, -0.2), V(0.15, q.backY + 1.95, -0.1), 0.18, 0.12, '#3a8a2a');
    S.E(V(0, q.backY + 0.45, 1.05), [0.55, 0.28, 0.25], '#ffd21f', { paint: true, glow: true }); // a carved grin on the hump
  },
  // a red fox: a slim low body on thin black legs, a narrow pointed muzzle, big upright ears and a
  // long bushy tail with a white tip
  sheetGhost(S) { // Harvest Fox
    quadruped(S, { len: 4.6, h: 2.7, w: 0.62, depth: 0.75, tuck: 0.3, body: '#ff7a1a', belly: '#fff4e0', legCol: '#2a1a10', legW: 0.16,
      neck: [V(0, 2.8, 2.6)], neckR: [0.48, 0.36], head: 0.62, snout: 0.85, muzzle: [0.42, 0.17], nose: '#1a1a1a', ears: 'pointy', earSize: 1.3, earCol: '#2a1a10', eye: '#7dff3f',
      tail: [V(0, 2.2, -3.0), V(0, 1.7, -3.9), V(0, 1.5, -4.8)], tailR: 0.3, tailEnd: 0.22, bushy: 0.52 });
    S.E(V(0, 1.5, -4.95), [0.5, 0.5, 0.6], '#ffffff', { paint: true }); // the white tip
  },
  // a lean cat with a round head, a short face, upright ears, a long tail held up; a scarecrow's
  // straw hat on its head and a sewn-on patch
  scarecrowCat(S) {
    const q = quadruped(S, { len: 3.8, h: 2.4, w: 0.6, depth: 0.68, tuck: 0.35, body: '#e8c860', belly: '#c8a040', legW: 0.19,
      neck: [V(0, 2.45, 1.95)], neckR: [0.45, 0.35], head: 0.7, snout: 0.25, muzzle: [0.42, 0.32], drop: 0.04, nose: '#ff7aa8', ears: 'pointy', earSize: 0.8, eye: '#ffd21f',
      tail: [V(0, 2.6, -2.4), V(0, 3.6, -2.6), V(0, 4.2, -2.2)], tailR: 0.13, tailEnd: 0.1 });
    S.E(V(0.6, q.cy, -0.1), [0.45, 0.5, 0.6], '#8a5a2a', { paint: true }); // a sewn-on patch
    S.begin('head', 'head', q.neckTop); // the hat moves with the head
    const top = q.headC.y + q.hr * 0.7;
    S.E(V(0, top, q.headC.z - 0.05), [1.0, 0.09, 1.0], '#6a3a1a'); // a straw hat
    S.E(V(0, top + 0.3, q.headC.z - 0.05), [0.5, 0.36, 0.5], '#6a3a1a');
    S.end();
  },

  // ---------- Candy Lane (bigger than a player)
  gummyBat(S) { scorpion(S, { body: '#ff4fa8', body2: '#ff8ad0', claw: '#ff2a8a', sting: '#fff04a', legs: '#ff6ab8', eye: '#ffffff', stripes: '#fff04a' }); }, // Gummy Scorpion
  // a woolly llama: a long upright neck, a small head with banana ears, a short tail; a lollipop on its back
  lollipopLlama(S) {
    const q = quadruped(S, { len: 4.6, h: 4.8, w: 0.95, depth: 1.0, tuck: 0.1, body: '#ffffff', legW: 0.23, foot: 'pad', footCol: '#d8d0e0',
      neck: [V(0, 5.6, 2.5), V(0, 7.0, 2.65)], neckR: [0.55, 0.42], head: 0.6, snout: 0.6, muzzle: [0.44, 0.3], ears: 'long', earSize: 0.9, eye: '#ff2a8a',
      tail: [V(0, 4.3, -2.7), V(0, 3.9, -2.8)], tailR: 0.25, tailEnd: 0.18,
      belly: (x, y, z) => ['#ff6ab0', '#ffd21f', '#7dff6a', '#5fd0ff'][Math.floor((y + z * 0.5) * 1.3) & 3] });
    const cy = q.backY + 2.1;
    S.C(V(0, q.backY - 0.1, -0.4), V(0, cy - 0.9, -0.4), 0.1, 0.1, '#ffffff');
    S.E(V(0, cy, -0.4), [0.9, 0.9, 0.2], (x, y) => [['#ff2a8a', '#ffffff'][Math.floor(Math.atan2(y - cy, x) * 2 + Math.hypot(x, y - cy) * 4) & 1], true], { glow: true });
  },
  candyCornCrab(S) { crab(S, { body: '#ffd21f', bands: ['#ffd21f', '#ff8a1a', '#ffffff'], claw: '#ff7a10', legs: '#ff9a3a', eye: '#ff2a8a' }); },

  // ---------- Graveyard
  // a werewolf: hunched, shaggy dark fur, a wolf's head with a long snout and fangs, glowing yellow
  // eyes, long arms with claws, torn trousers, legs bent like a wolf's and a bushy tail
  boneDog(S) {
    const FUR = (x, y, z) => (Math.sin(x * 9 + y * 3) * Math.sin(z * 7 - y * 5) > 0.55 ? '#3a2c22' : '#5a4636');
    biped(S, {
      h: 12, wide: 1.2, hunch: 1, digi: true, longArms: true, skin: '#5a4636', top: FUR, neck: FUR, legs: '#3a4a6a', shin: FUR, feet: '#4a3a2c', hand: '#4a3a2c', claws: '#e8dcc0',
      tail: [[0, 0.46, -0.08], [0, 0.4, -0.2], [0, 0.34, -0.3]],
      chest: (S2, at) => S2.E(at, [1.0, 1.2, 0.5], '#8a6a4e', { paint: true }), // the paler chest fur
      head(S2, c) {
        S2.E(c, [0.95, 0.9, 1.0], FUR);
        S2.C(V(0, c.y - 0.2, c.z + 0.6), V(0, c.y - 0.35, c.z + 1.9), 0.55, 0.32, '#4a3a2c'); // the long snout
        S2.E(V(0, c.y - 0.2, c.z + 2.05), [0.24, 0.18, 0.15], '#141010'); // nose
        jaws(S2, c.z + 0.6, c.y - 0.2, 0.55, c.z + 1.9, c.y - 0.35, 0.32, '#3a2018', { n: 6, big: 1.2, gape: 0.9 }); // snarling jaws
        brows(S2, 0.36, c.y + 0.38, c.z + 0.84, 0.14, '#1e140e');
        for (const sd of [-1, 1]) {
          S2.C(V(sd * 0.5, c.y + 0.6, c.z - 0.1), V(sd * 0.65, c.y + 1.45, c.z - 0.3), 0.3, 0.04, FUR); // ears
          S2.E(V(sd * 0.36, c.y + 0.22, c.z + 0.85), [0.16, 0.11, 0.08], '#ffd21f', { glow: true }); // eyes
          S2.E(V(sd * 0.36, c.y + 0.36, c.z + 0.82), [0.22, 0.06, 0.08], '#2a1a12'); // the brow
        }
        S2.E(V(0, c.y + 0.5, c.z - 0.4), [0.9, 0.5, 0.7], '#2e221a'); // the mane
      },
    });
  },
  zombieBunny(S) { spider(S, { body: '#3a3f4a', body2: '#2a2e36', legs: '#2a2e36', eye: '#ff2a2a', mark: '#7dff3f' }); }, // Grave Spider
  // a vampire: deathly pale, slicked-back black hair with a widow's peak, pointed ears, glowing red
  // eyes, fangs, a black suit with a red waistcoat and a high-collared cape lined in red
  tombBat(S) {
    const SKIN = '#e4dcd6';
    biped(S, {
      h: 12, skin: SKIN, top: '#16141c', sleeve: '#16141c', legs: '#16141c', feet: '#0a0a0e', hand: SKIN, neck: SKIN,
      chest: (S2, at) => {
        S2.E(V(0, at.y + 0.2, at.z), [0.75, 1.2, 0.35], '#a01020', { paint: true }); // waistcoat
        S2.E(V(0, at.y + 0.9, at.z + 0.1), [0.3, 0.35, 0.3], '#f4f0ea'); // cravat
        S2.E(V(0, at.y + 0.6, at.z + 0.35), [0.14, 0.14, 0.1], '#ff2030', { glow: true }); // ruby brooch
      },
      head(S2, c) {
        S2.E(c, [0.72, 0.92, 0.82], SKIN);
        S2.E(V(0, c.y - 0.62, c.z + 0.2), [0.5, 0.3, 0.55], SKIN); // narrow chin
        S2.E(V(0, c.y + 0.35, c.z - 0.12), [0.78, 0.65, 0.85], '#0c0a10'); // slicked hair
        S2.C(V(0, c.y + 0.55, c.z + 0.6), V(0, c.y + 0.2, c.z + 0.8), 0.18, 0.04, '#0c0a10'); // widow's peak
        S2.C(V(0, c.y, c.z + 0.75), V(0, c.y - 0.28, c.z + 0.95), 0.12, 0.07, SKIN); // nose
        for (const sd of [-1, 1]) {
          S2.E(V(sd * 0.3, c.y + 0.08, c.z + 0.68), [0.15, 0.09, 0.06], '#ff1a2a', { glow: true }); // eyes
          S2.E(V(sd * 0.3, c.y + 0.24, c.z + 0.66), [0.2, 0.05, 0.07], '#1a1218'); // the brow
          S2.C(V(sd * 0.68, c.y + 0.05, c.z), V(sd * 1.05, c.y + 0.45, c.z - 0.3), 0.14, 0.02, SKIN); // pointed ears
          S2.C(V(sd * 0.14, c.y - 0.38, c.z + 0.76), V(sd * 0.12, c.y - 0.78, c.z + 0.8), 0.07, 0.012, TOOTH); // long fangs
          S2.C(V(sd * 0.08, c.y - 0.62, c.z + 0.74), V(sd * 0.08, c.y - 0.46, c.z + 0.77), 0.04, 0.01, TOOTH); // lower fangs
        }
        S2.E(V(0, c.y - 0.5, c.z + 0.68), [0.28, 0.15, 0.08], GUM); // the open mouth
        for (let t = -2; t <= 2; t++) tooth(S2, V(t * 0.05, c.y - 0.38, c.z + 0.75), V(t * 0.05, c.y - 0.45, c.z + 0.76), 0.022);
      },
      cape(S2, H, shY) {
        S2.begin('cape', 'tail', V(0, shY, -H * 0.08));
        // the cape hangs from the shoulders to the ankles, black outside, red inside, high collar
        S2.E(V(0, shY * 0.6, -H * 0.11), [H * 0.24, shY * 0.55, H * 0.035], '#0e0c12', { rot: [0.08, 0, 0] });
        S2.E(V(0, shY * 0.6, -H * 0.085), [H * 0.22, shY * 0.52, H * 0.02], '#8a0a18', { rot: [0.08, 0, 0] });
        for (const sd of [-1, 1]) S2.E(V(sd * H * 0.12, shY + H * 0.06, -H * 0.04), [H * 0.09, H * 0.1, H * 0.015], '#8a0a18', { rot: [0.3, sd * 0.5, 0] }); // the collar
        S2.end();
      },
    });
  },

  // ---------- Witch Swamp
  bogFrog(S) {
    S.E(V(0, 2.6, -0.4), [2.4, 1.9, 2.8], '#4f9a3a', { rot: [-0.35, 0, 0] });
    S.E(V(0, 3.4, 1.8), [2.0, 1.3, 1.6], '#4f9a3a');
    for (const s of [-1, 1]) {
      S.E(V(s * 1.1, 4.5, 2.1), [0.6, 0.6, 0.6], '#4f9a3a');
      S.E(V(s * 1.15, 4.6, 2.55), [0.4, 0.4, 0.3], '#ffd21f', { glow: true });
      S.chain([V(s * 1.8, 1.8, -1.6), V(s * 3.2, 2.4, -0.6), V(s * 3.0, 0.4, 0.8)], 0.8, 0.5, '#3f8a2e');
      S.E(V(s * 3.0, 0.3, 1.4), [0.8, 0.3, 1.0], '#3f8a2e');
      S.chain([V(s * 1.3, 2.0, 2.0), V(s * 1.8, 0.4, 2.8)], 0.4, 0.3, '#3f8a2e');
    }
    for (let i = 0; i < 8; i++) S.E(V(Math.sin(i * 2.1) * 1.8, 3.4 + Math.cos(i * 1.3) * 0.9, -0.6 + Math.cos(i * 2.1) * 1.6), [0.3, 0.3, 0.3], '#d07aff', { paint: true, glow: true });
    brows(S, 1.15, 5.05, 2.4, 0.4, '#1e3a14');
    maw(S, V(0, 2.6, 3.0), 1.5, 0.6, 0.45, 9, 1.1); // a wide toothy mouth
  },
  slimeSnail(S) { // Swamp Croc
    S.E(V(0, 1.4, 0), [1.6, 1.0, 4.0], '#3a6a3a');
    S.C(V(0, 1.3, 3.6), V(0, 1.2, 7.2), 1.1, 0.5, '#3a6a3a');
    S.C(V(0, 1.4, -3.6), V(0, 1.0, -9.0), 1.0, 0.15, '#3a6a3a');
    for (let i = 0; i < 12; i++) S.E(V(0, 2.3 - i * 0.05, 2.4 - i * 0.95), [0.35, 0.3, 0.3], '#5a8a3a');
    for (const s of [-1, 1]) {
      S.E(V(s * 0.75, 2.3, 4.0), [0.38, 0.38, 0.38], '#ffd21f', { glow: true });
      for (const f of [1, -1]) {
        S.begin(`legs${s * f > 0 ? 1 : 0}`, 'crawl', V(0, 1.2, 0), { phase: s * f > 0 ? Math.PI : 0 });
        S.chain([V(s * 1.3, 1.2, f * 2.2), V(s * 2.4, 0.9, f * 2.4), V(s * 2.6, 0.2, f * 2.7)], 0.4, 0.3, '#2e5a2e');
        S.end();
      }
      for (let k = 0; k < 9; k++) {
        tooth(S, V(s * 0.62, 1.05, 4.2 + k * 0.33), V(s * 0.7, 0.45, 4.25 + k * 0.33), 0.13);
        tooth(S, V(s * 0.5, 0.75, 4.35 + k * 0.33), V(s * 0.55, 1.2, 4.4 + k * 0.33), 0.1);
      }
      S.E(V(s * 0.75, 2.65, 4.0), [0.45, 0.12, 0.25], '#14200e', { rot: [0, 0, s * 0.5] });
    }
  },
  rainbowToad(S) { octopus(S, { body: '#7a3ab0', arms: '#6a2aa0', eye: '#7dff3f', spots: '#7dff3f', suckers: '#d8a8ff' }); }, // Witch Octopus

  // ---------- Creepy Carnival (the elephant is a giant)
  // a sturdy dog: a deep chest, floppy ears, a medium muzzle and a tail held up; striped like a popcorn box
  popcornPup(S) {
    const q = quadruped(S, { len: 4.0, h: 3.0, w: 0.8, depth: 0.85, tuck: 0.2, body: (x, y, z) => (Math.floor(z * 2.2 + 10) % 2 ? '#e8202a' : '#ffffff'), legCol: '#fff6d0', legW: 0.24,
      neck: [V(0, 3.1, 2.0)], neckR: [0.5, 0.42], head: 0.8, headCol: '#fff6d0', snout: 0.65, muzzle: [0.45, 0.3], nose: '#1a1a1a', ears: 'flap', earCol: '#ffd21f', eye: '#ff2a2a',
      tail: [V(0, 3.2, -2.3), V(0, 3.8, -2.4)], tailR: 0.14, tailEnd: 0.08 });
    const c = q.neckBase.clone().lerp(q.neckTop, 0.55);
    S.E(c, [0.56, 0.2, 0.56], '#ffd21f', { glow: true, rot: [0.6, 0, 0] }); // a glowing collar round its neck
  },
  clownFish(S) { shark(S, { len: 9, r: 1.9, body: '#ff5a1a', belly: '#ffffff', fin: '#ffffff', stripes: '#ffffff', eye: '#ff2a1a' }); }, // Clown Shark
  // an elephant: a huge rounded body on straight pillar legs, almost no neck, a big domed head with
  // wide flapping ears, a long trunk hanging to the ground and curved tusks; a circus blanket and plume
  circusElephant(S) {
    const G = '#9aa0b8';
    const q = quadruped(S, { len: 6.0, h: 7.0, w: 1.9, depth: 2.1, body: G, foot: 'pillar', footCol: '#b8bccc', legW: 0.72,
      neck: [V(0, 6.0, 3.0)], neckR: [1.35, 1.25], head: 1.7, snout: 0.4, muzzle: [0.55, 0.45], drop: 0.2, jaws: false, ears: 'flap', earSize: 1.35, earCol: '#ff6ab0', eye: '#ff2a2a',
      tail: [V(0, 5.0, -3.1), V(0, 3.8, -3.15)], tailR: 0.14, tailEnd: 0.1 });
    S.begin('head', 'head', q.neckTop); // the trunk, the tusks and the mouth move with the head
    const t = q.tip;
    S.chain([V(0, t.y, t.z - 0.1), V(0, t.y - 1.6, t.z + 0.45), V(0, t.y - 3.4, t.z + 0.55), V(0, t.y - 4.5, t.z + 1.0)], 0.62, 0.3, G); // the trunk
    for (const s of [-1, 1]) S.chain([V(s * 0.6, t.y - 0.6, t.z - 0.3), V(s * 0.9, t.y - 1.7, t.z + 0.7), V(s * 0.8, t.y - 1.3, t.z + 1.7)], 0.24, 0.05, '#fff6e0'); // curved tusks
    maw(S, V(0, t.y - 0.8, t.z - 0.35), 0.5, 0.3, 0.3, 5, 1); // a fanged mouth under the trunk
    S.end();
    const by = q.backY - 0.05;
    S.E(V(0, by, 0), [1.95, 0.4, 2.3], '#e8202a'); // the circus blanket
    S.E(V(0, by, 0), [2.0, 0.42, 2.35], (x, y, z) => (Math.floor(z * 1.4 + 10) % 2 ? ['#ffd21f', true] : '#e8202a'), { paint: true });
    S.C(V(0, by + 0.3, 0.3), V(0, by + 2.2, 0.3), 0.4, 0.16, '#ffd21f', { glow: true }); // the plume
  },

  // ---------- Frostbite Hollow (the bear is a giant)
  snowWisp(S) { // Snow Owl
    S.E(V(0, 3.4, 0), [2.0, 2.6, 1.9], '#f4f8ff');
    S.E(V(0, 6.4, 0.3), [1.7, 1.5, 1.6], '#f4f8ff');
    for (const s of [-1, 1]) {
      S.E(V(s * 0.65, 6.6, 1.65), [0.55, 0.55, 0.25], '#5fd8ff', { glow: true });
      S.E(V(s * 0.65, 6.6, 1.8), [0.2, 0.2, 0.15], '#0a1a2a', { paint: true });
      S.C(V(s * 0.7, 7.6, 0.2), V(s * 1.1, 8.6, 0), 0.35, 0.05, '#dfe8f4');
      S.E(V(s * 1.9, 3.6, -0.2), [0.5, 2.0, 1.3], '#c8d8ec');
      S.C(V(s * 0.6, 0.9, 0.5), V(s * 0.7, 0.1, 1.1), 0.3, 0.2, '#ffcf4a');
    }
    S.C(V(0, 6.2, 1.7), V(0, 5.6, 2.1), 0.28, 0.05, '#ffcf4a');
    brows(S, 0.7, 7.2, 1.75, 0.38, '#8a9ab4');
    maw(S, V(0, 5.1, 1.55), 0.95, 0.4, 0.3, 7, 1.1);
    for (let i = 0; i < 10; i++) S.E(V(Math.sin(i) * 1.2, 2.4 + (i % 5) * 0.6, 1.6), [0.25, 0.12, 0.12], '#9ab4d4', { paint: true });
  },
  icicleSwordfish(S) { shark(S, { len: 10, r: 1.75, body: '#3a7ad0', belly: '#d8f0ff', fin: '#7fd8ff', bill: 5, billCol: '#e8f8ff', eye: '#ffffff', stripes: '#7fe8ff', stripeGlow: true }); },
  frostbiteBear(S) { // standing up on its hind legs, arms raised
    S.E(V(0, 7.5, 0), [3.0, 4.2, 2.4], '#e8eef8');
    S.E(V(0, 8.0, 1.0), [2.0, 3.0, 1.6], '#c8d6e8', { paint: true });
    S.E(V(0, 12.6, 0.4), [1.9, 1.8, 1.9], '#e8eef8');
    S.C(V(0, 12.2, 1.6), V(0, 11.8, 3.2), 0.95, 0.6, '#e8eef8');
    S.E(V(0, 12.0, 3.4), [0.4, 0.3, 0.25], '#1a2030');
    jaws(S, 1.6, 12.2, 0.95, 3.2, 11.8, 0.6, '#d8e2f0', { n: 5, big: 1.2, gape: 1.0 }); // roaring
    eyePair(S, 0.75, 13.2, 1.9, 0.3, '#5fd8ff');
    brows(S, 0.75, 13.55, 1.95, 0.25, '#8a9ab4');
    for (const s of [-1, 1]) {
      S.E(V(s * 1.4, 14.2, 0), [0.55, 0.55, 0.3], '#e8eef8');
      S.chain([V(s * 2.6, 9.8, 0), V(s * 4.2, 12.0, 0.8), V(s * 4.6, 15.0, 1.2)], 1.0, 0.8, '#e8eef8'); // raised arms
      for (let k = -1; k <= 1; k++) S.C(V(s * 4.6 + k * 0.35, 15.6, 1.6), V(s * 4.6 + k * 0.4, 16.4, 2.2), 0.18, 0.04, '#bfeaff', { glow: true }); // ice claws
      S.chain([V(s * 1.6, 4.4, 0), V(s * 1.8, 2.2, 0.5), V(s * 1.8, 0.6, 0.4)], 1.2, 1.0, '#e8eef8');
      S.E(V(s * 1.8, 0.5, 1.0), [1.0, 0.5, 1.4], '#c8d6e8');
    }
    for (let i = 0; i < 7; i++) S.C(V((i % 2 ? 1 : -1) * (0.4 + (i % 3) * 0.5), 6 + i * 1.0, -2.0), V((i % 2 ? 1 : -1) * (0.6 + (i % 3) * 0.6), 7 + i * 1.0, -3.6), 0.4, 0.05, '#7fe8ff', { glow: true }); // ice spikes on its back
  },

  // ---------- The Backrooms (the mantis is a giant)
  candleGhost(S) { // Lamp Moth
    S.E(V(0, 3.4, 0), [0.8, 0.8, 2.2], '#c8a860');
    S.E(V(0, 3.6, 2.4), [0.75, 0.7, 0.7], '#c8a860');
    eyePair(S, 0.45, 3.8, 2.8, 0.34, '#ff5a1a');
    S.E(V(0, 3.2, 3.0), [0.45, 0.3, 0.2], GUM);
    for (const sd of [-1, 1]) S.chain([V(sd * 0.3, 3.4, 2.9), V(sd * 0.35, 2.7, 3.3), V(sd * 0.12, 2.3, 3.35)], 0.12, 0.03, TOOTH);
    for (const s of [-1, 1]) S.chain([V(s * 0.3, 4.2, 2.8), V(s * 1.0, 5.6, 3.6), V(s * 1.6, 6.0, 3.2)], 0.12, 0.06, '#8a6a30');
    wings(S, {}, 4.0, 0.2, 7, '#e8d088', '#8a6a30');
    for (const s of [-1, 1]) for (const dz of [0.6, -1.6]) S.E(V(s * 3.4, 4.25, dz), [0.8, 0.12, 0.8], '#fff6a0', { paint: true, glow: true }); // the wing eyespots
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) S.chain([V(s * 0.6, 3.0, 1.0 - k * 0.8), V(s * 1.6, 2.0, 1.2 - k * 0.8), V(s * 2.0, 0.1, 1.5 - k * 0.8)], 0.14, 0.08, '#8a6a30');
  },
  // a panther: long, low and muscular, a small head with short round ears, a long tail hanging
  // low and curling up at the end; glowing stripes down its back
  phantomCat(S) { // Phantom Panther
    const q = quadruped(S, { len: 5.4, h: 2.9, w: 0.75, depth: 0.8, tuck: 0.4, body: '#2a2238', legW: 0.25,
      neck: [V(0, 2.75, 2.85)], neckR: [0.52, 0.42], head: 0.68, snout: 0.35, muzzle: [0.45, 0.33], drop: 0.05, nose: '#1a1020', ears: 'small', eye: '#c04aff',
      tail: [V(0, 2.0, -3.4), V(0, 1.2, -4.2), V(0, 1.0, -5.2), V(0, 1.5, -5.9)], tailR: 0.16, tailEnd: 0.12 });
    for (let i = 0; i < 6; i++) S.E(V(0, q.backY - 0.1, 1.9 - i * 0.75), [0.85, 0.25, 0.14], '#c04aff', { paint: true, glow: true }); // glowing stripes
  },
  ghostPrince(S) { // Hallway Mantis: standing tall, raptorial arms folded
    S.E(V(0, 3.6, -2.0), [1.6, 1.4, 3.2], '#9ab83a', { rot: [0.35, 0, 0] });
    S.C(V(0, 4.4, 0.4), V(0, 11.0, 1.4), 1.0, 0.7, '#a8c84a'); // the long upright thorax
    S.E(V(0, 12.2, 1.8), [1.4, 0.9, 0.9], '#b8d85a');
    eyePair(S, 1.15, 12.4, 2.1, 0.55, '#ff4a1a');
    S.E(V(0, 11.5, 2.4), [0.6, 0.4, 0.3], GUM);
    for (const sd of [-1, 1]) {
      S.chain([V(sd * 0.6, 11.8, 2.3), V(sd * 0.7, 11.0, 2.9), V(sd * 0.2, 10.7, 3.0)], 0.22, 0.05, '#5a6a1a'); // mandibles
      for (let k = 0; k < 3; k++) tooth(S, V(sd * (0.6 - k * 0.15), 11.2 - k * 0.12, 2.75), V(sd * (0.45 - k * 0.15), 11.2 - k * 0.12, 2.8), 0.06);
    }
    for (const s of [-1, 1]) {
      S.chain([V(s * 0.3, 12.8, 1.8), V(s * 1.2, 15, 2.6), V(s * 2.0, 16.2, 2.0)], 0.12, 0.05, '#7a9a2a');
      // the raptorial arms: up, then folded down with spikes
      S.chain([V(s * 0.8, 10.0, 1.8), V(s * 1.6, 11.6, 3.6), V(s * 1.4, 8.6, 4.4)], 0.5, 0.42, '#a8c84a');
      S.chain([V(s * 1.4, 8.6, 4.4), V(s * 1.2, 9.8, 5.6)], 0.38, 0.12, '#a8c84a');
      for (let k = 0; k < 3; k++) S.C(V(s * 1.4, 9.0 + k * 0.6, 4.5), V(s * 1.4, 9.2 + k * 0.6, 5.2), 0.12, 0.02, '#e8ffb0', { glow: true });
      for (const z of [0.4, -1.6]) S.chain([V(s * 0.8, 4.4, z), V(s * 3.0, 5.4, z + 0.4), V(s * 4.0, 0.1, z + 0.9)], 0.28, 0.14, '#7a9a2a');
      S.E(V(s * 1.4, 5.0, -2.0), [0.12, 1.2, 2.8], '#c8e070', { rot: [0.35, 0, s * 0.3] }); // folded wings
    }
  },

  // ---------- Blood Moon (the dragon is a giant)
  // a big wolf-like hound: a deep chest, a tucked waist, a long muzzle, tall ears; lava cracks
  // in its fur and burning spikes down its spine
  hellPup(S) { // Hell Hound
    const q = quadruped(S, { len: 5.6, h: 3.9, w: 0.9, depth: 1.0, tuck: 0.3, body: (x, y, z) => (Math.abs(Math.sin(x * 2.1 + z * 1.3) + Math.sin(y * 2.7 - z * 0.9)) < 0.18 ? ['#ff6a1a', true] : '#1e1416'), legW: 0.27,
      neck: [V(0, 3.9, 2.75)], neckR: [0.6, 0.45], head: 0.8, snout: 0.95, muzzle: [0.45, 0.24], nose: '#ff3a1a', ears: 'pointy', eye: '#ffd21f', gape: 0.7,
      tail: [V(0, 3.9, -3.4), V(0, 4.5, -4.2)], tailR: 0.15, tailEnd: 0.05, tailCol: '#ff4a1a' });
    for (let i = 0; i < 5; i++) S.C(V(0, q.backY - 0.15, 1.6 - i * 0.8), V(0, q.backY + 0.65, 1.3 - i * 0.8), 0.2, 0.03, '#ff6a1a', { glow: true });
  },
  magmaImp(S) { scorpion(S, { body: '#2a1414', body2: '#3a1a16', claw: '#4a1a14', sting: '#ff6a1a', legs: '#2a1414', eye: '#ffd21f', stripes: '#ff5a10' }); }, // Magma Scorpion
  demonCalf(S) { // Blood Dragon: rearing up, wings spread
    S.E(V(0, 5.6, -0.6), [2.2, 3.4, 2.0], '#8a1018', { rot: [0.45, 0, 0] });
    S.E(V(0, 5.4, 0.6), [1.5, 2.6, 1.2], '#e8b080', { paint: true });
    S.chain([V(0, 8.0, 0.6), V(0, 11.0, 1.6), V(0, 13.6, 1.2)], 1.0, 0.75, '#8a1018'); // the neck
    S.E(V(0, 14.3, 1.8), [1.0, 0.9, 1.4], '#8a1018');
    S.C(V(0, 14.0, 2.8), V(0, 13.8, 4.4), 0.7, 0.4, '#8a1018');
    jaws(S, 2.6, 14.0, 0.7, 4.4, 13.8, 0.4, '#6a0a12', { n: 6, big: 1.15, gape: 1.1 });
    eyePair(S, 0.6, 14.7, 2.6, 0.28, '#ffd21f');
    brows(S, 0.6, 15.0, 2.7, 0.22, '#3a0408');
    for (const s of [-1, 1]) {
      S.C(V(s * 0.5, 15.0, 1.2), V(s * 0.9, 16.6, -0.4), 0.3, 0.05, '#f2e6c8');
      // the wings: arm bone and a spread membrane
      S.chain([V(s * 1.6, 8.0, -1.0), V(s * 4.6, 11.0, -2.0), V(s * 8.4, 12.6, -2.6)], 0.4, 0.2, '#5a0a10');
      S.E(V(s * 5.2, 9.4, -2.4), [3.6, 3.0, 0.2], '#c81a2a', { rot: [0, s * 0.2, s * 0.3] });
      S.E(V(s * 5.2, 9.4, -2.4), [3.65, 3.05, 0.22], (x, y) => (Math.abs(Math.sin((x * 1.5 + y) * 1.2)) < 0.15 ? ['#ff6a3a', true] : '#c81a2a'), { paint: true, rot: [0, s * 0.2, s * 0.3] });
      S.chain([V(s * 1.6, 7.0, 0.8), V(s * 2.4, 8.2, 2.2), V(s * 2.2, 7.0, 3.0)], 0.45, 0.25, '#8a1018');
      S.chain([V(s * 1.3, 3.4, -1.2), V(s * 1.8, 1.6, 0.2), V(s * 1.6, 0.4, 0.4)], 0.9, 0.6, '#8a1018');
      S.E(V(s * 1.6, 0.4, 1.0), [0.8, 0.4, 1.2], '#5a0a10');
    }
    S.chain([V(0, 3.2, -2.4), V(0, 1.0, -4.6), V(0, 0.8, -7.4), V(0, 2.0, -9.4)], 0.8, 0.15, '#8a1018');
    for (let i = 0; i < 6; i++) S.C(V(0, 8.6 + i * 0.9, -0.2 + i * 0.25), V(0, 9.0 + i * 0.9, -1.0 + i * 0.25), 0.25, 0.04, '#ff6a3a', { glow: true });
  },

  // ---------- The Void (the octopus is a giant)
  voidEye(S) { // Void Jelly
    S.E(V(0, 7.5, 0), [3.0, 2.2, 3.0], '#7a3aff');
    S.E(V(0, 6.6, 0), [2.6, 1.0, 2.6], '#2a0a5a', { sub: true });
    S.E(V(0, 7.8, 0), [2.0, 1.4, 2.0], '#d8a8ff', { paint: true, glow: true });
    eyePair(S, 1.0, 7.6, 2.75, 0.42, '#ff2a2a');
    brows(S, 1.0, 8.1, 2.8, 0.36, '#2a0a5a');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      tooth(S, V(Math.cos(a) * 2.5, 6.4, Math.sin(a) * 2.5), V(Math.cos(a) * 2.2, 5.3 - (i % 2) * 0.4, Math.sin(a) * 2.2), 0.2);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      S.chain([V(Math.cos(a) * 2.4, 6.0, Math.sin(a) * 2.4), V(Math.cos(a) * 2.8, 4.0, Math.sin(a) * 2.8), V(Math.cos(a + 0.5) * 2.4, 2.0, Math.sin(a + 0.5) * 2.4), V(Math.cos(a + 0.9) * 2.0, 0.2, Math.sin(a + 0.9) * 2.0)], 0.22, 0.08, i % 2 ? '#ff4af0' : '#b88aff', { glow: i % 3 === 0 });
    }
  },
  starEater(S) { shark(S, { len: 11, r: 2.2, body: '#1a1450', belly: '#3a2a8a', fin: '#2a1a6a', eye: '#ff4af0', spots: { n: 12, col: '#fff6a0' } }); }, // Star Shark
  goldenAbomination(S) { octopus(S, { raised: true, body: '#d8a020', arms: '#7a3ab0', eye: '#ff4af0', spots: '#ff4af0', suckers: '#ffd84a', suckerGlow: true }); }, // Void Colossus Octopus

  // ---------- The Nightmare (the megalodon is a giant)
  spikePuffer(S) {
    S.E(V(0, 3.6, 0), [3.0, 2.8, 3.2], '#c8a060');
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4, e = Math.acos(1 - 2 * ((i + 0.5) / 26));
      const d = V(Math.sin(e) * Math.cos(a), Math.cos(e), Math.sin(e) * Math.sin(a));
      S.C(V(d.x * 2.6, 3.6 + d.y * 2.4, d.z * 2.8), V(d.x * 4.2, 3.6 + d.y * 3.9, d.z * 4.4), 0.3, 0.04, i % 4 ? '#f2e6c8' : '#ff5a1a', { glow: i % 4 === 0 });
    }
    eyePair(S, 1.6, 4.4, 2.5, 0.5, '#ff3a1a');
    brows(S, 1.6, 5.1, 2.55, 0.45, '#3a2410');
    maw(S, V(0, 2.8, 2.75), 1.5, 0.8, 0.55, 9, 1.3);
    S.C(V(0, 3.6, -3.0), V(0, 3.8, -4.6), 0.6, 0.2, '#a87a40');
    S.E(V(0, 3.9, -5.0), [0.2, 1.4, 0.8], '#a87a40');
  },
  nightmareRaven(S) {
    S.E(V(0, 5.0, 0), [1.8, 2.0, 2.8], '#141018', { rot: [0.4, 0, 0] });
    S.E(V(0, 7.6, 1.6), [1.3, 1.3, 1.4], '#141018');
    S.C(V(0, 7.5, 2.8), V(0, 7.0, 5.0), 0.5, 0.05, '#3a3040');
    S.C(V(0, 6.8, 2.7), V(0, 6.2, 4.4), 0.35, 0.05, '#2a2230'); // the lower beak, open
    S.C(V(0, 7.0, 2.8), V(0, 6.6, 3.9), 0.3, 0.1, GUM);
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) {
      tooth(S, V(sd * 0.2, 7.15 - k * 0.08, 3.0 + k * 0.38), V(sd * 0.18, 6.75 - k * 0.08, 3.05 + k * 0.38), 0.07);
      tooth(S, V(sd * 0.15, 6.5 - k * 0.1, 3.0 + k * 0.3), V(sd * 0.13, 6.85 - k * 0.1, 3.05 + k * 0.3), 0.06);
    }
    eyePair(S, 0.75, 8.0, 2.4, 0.34, '#ff2a2a');
    brows(S, 0.75, 8.35, 2.5, 0.3, '#08060a');
    for (const s of [-1, 1]) {
      S.E(V(s * 1.7, 5.4, -0.6), [0.45, 1.8, 3.0], '#1e1826', { rot: [0.4, 0, s * 0.15] });
      S.chain([V(s * 0.7, 3.4, 0.2), V(s * 0.8, 1.6, 0.6), V(s * 0.8, 0.2, 0.9)], 0.3, 0.18, '#3a3040');
      for (let k = -1; k <= 1; k++) S.C(V(s * 0.8, 0.2, 0.9), V(s * 0.8 + k * 0.5, 0.1, 1.9), 0.14, 0.04, '#3a3040');
    }
    S.E(V(0, 3.4, -3.4), [1.2, 0.3, 1.8], '#1e1826', { rot: [-0.5, 0, 0] });
    for (let i = 0; i < 4; i++) S.E(V(0, 5.5 + i * 0.5, 2.4 - i * 0.9), [0.3, 0.08, 0.3], '#8a2aff', { paint: true, glow: true });
  },
  shadowShark(S) { shark(S, { len: 16, r: 3.3, vertical: true, body: '#2a2e3a', belly: '#c8ccd8', fin: '#1a1d26', eye: '#ff2a1a', stripes: '#ff4a1a', stripeGlow: true }); }, // Shadow Megalodon, breaching
};

// The new names (the ids are kept so older saves keep their pets).
export const ANIMAL_NAMES = {
  pumpkinCamel: 'Pumpkin Camel', sheetGhost: 'Harvest Fox', scarecrowCat: 'Scarecrow Cat',
  gummyBat: 'Gummy Scorpion', lollipopLlama: 'Lollipop Llama', candyCornCrab: 'Candy Corn Crab',
  boneDog: 'Wolf Man', zombieBunny: 'Grave Spider', tombBat: 'Vampire Man',
  bogFrog: 'Bog Frog', slimeSnail: 'Swamp Croc', rainbowToad: 'Witch Octopus',
  popcornPup: 'Popcorn Pup', clownFish: 'Clown Shark', circusElephant: 'Giant Circus Elephant',
  snowWisp: 'Snow Owl', icicleSwordfish: 'Icicle Swordfish', frostbiteBear: 'Giant Frostbite Bear',
  candleGhost: 'Lamp Moth', phantomCat: 'Phantom Panther', ghostPrince: 'Giant Hallway Mantis',
  hellPup: 'Hell Hound', magmaImp: 'Magma Scorpion', demonCalf: 'Giant Blood Dragon',
  voidEye: 'Void Jelly', starEater: 'Star Shark', goldenAbomination: 'Giant Void Octopus',
  spikePuffer: 'Spike Puffer', nightmareRaven: 'Nightmare Raven', shadowShark: 'Giant Shadow Megalodon',
};

// size in world units; h: it is the height (the giants, taller than the 70-unit walls), else the longest side.
// From the third stage on the animals are large (about 1.5x), still under the walls; the giants from the fifth.
export const PET_LOOK = {
  pumpkinCamel: { size: 25 }, sheetGhost: { size: 30 }, scarecrowCat: { size: 28 },
  gummyBat: { size: 34 }, lollipopLlama: { size: 33 }, candyCornCrab: { size: 33 },
  boneDog: { size: 50 }, zombieBunny: { size: 52 }, tombBat: { size: 48 },
  bogFrog: { size: 54 }, slimeSnail: { size: 60 }, rainbowToad: { size: 54 },
  popcornPup: { size: 54 }, clownFish: { size: 66 }, circusElephant: { size: 94, h: true },
  snowWisp: { size: 52 }, icicleSwordfish: { size: 72 }, frostbiteBear: { size: 101, h: true },
  candleGhost: { size: 56 }, phantomCat: { size: 64 }, ghostPrince: { size: 108, h: true },
  hellPup: { size: 62 }, magmaImp: { size: 72 }, demonCalf: { size: 114, h: true },
  voidEye: { size: 62 }, starEater: { size: 80 }, goldenAbomination: { size: 119, h: true },
  spikePuffer: { size: 64 }, nightmareRaven: { size: 70 }, shadowShark: { size: 130, h: true },
};
export const hasBlockAnimal = (id) => !!ANIMALS[id];
export const isGiant = (id) => !!PET_LOOK[id]?.h;

// ------------------------------------------------------------------ meshes

const nightGlow = { value: 0.8 };
const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
bodyMaterial.onBeforeCompile = (sh) => {
  sh.uniforms.uGlow = nightGlow;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying float vGlow;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow;');
};
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
glowMaterial.color.setScalar(0.85);
const built = new Map();

function geometryOf(id) {
  if (!built.has(id)) {
    const S = new Sculpt();
    ANIMALS[id](S);
    built.set(id, smoothen(S)); // smooth, rounded shapes (voxelize(S, res) would make it of blocks)
  }
  return built.get(id);
}

// 0 = day .. 1 = night: the glowing parts shine brighter as the night comes (and pulse a little)
export function setPetNight(k, t = 0) {
  glowMaterial.color.setScalar(0.8 + 0.2 * k + Math.sin(t * 2.4) * 0.05 * k);
  nightGlow.value = 0.7 + 0.9 * k + Math.sin(t * 2.4) * 0.12 * k;
}

// The animal as a group standing on y = 0, facing +z, sized for a pen (whose group is drawn
// PLOT_SCALE times bigger) when inPen, else at its sculpted size. The geometry is shared: do not dispose it.
export function createBlockAnimal(id, inPen = true) {
  const g = geometryOf(id);
  const look = PET_LOOK[id] || { size: 6 };
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const parts = [];
  for (const p of g.parts) {
    const holder = new THREE.Group();
    if (p.pivot) holder.position.copy(p.pivot);
    if (p.body) {
      const m = new THREE.Mesh(p.body, bodyMaterial);
      m.castShadow = true;
      holder.add(m);
    }
    if (p.glow) holder.add(new THREE.Mesh(p.glow, glowMaterial));
    inner.add(holder);
    if (p.kind !== 'body') parts.push({ obj: holder, kind: p.kind, phase: p.phase, side: p.side, home: holder.position.clone() });
  }
  const dim = look.h ? g.size[1] : Math.max(...g.size);
  if (inPen) inner.scale.setScalar(look.size / PLOT_SCALE / dim);
  group.userData.sharedGeometry = true;
  group.userData.worldSize = look.size;
  group.userData.parts = parts;
  group.userData.blockSize = dim / 25; // how high crawling legs lift, in the animal's own units
  return group;
}

// Moves an animal's parts: walk = how fast it is walking (0 standing .. 1 full stride), step = its
// stride phase (radians), t = time. Legs swing, crawling legs lift in turn, tails sway, heads bob,
// wings flap and tentacles curl; standing still they settle back with a slow idle sway.
export function animateBlockAnimal(group, walk, step, t) {
  const lift = group.userData.blockSize || 0.5;
  for (const p of group.userData.parts || []) {
    const o = p.obj;
    switch (p.kind) {
      case 'leg': o.rotation.x = Math.sin(step + p.phase) * 0.24 * walk; break;
      case 'crawl': {
        const k = Math.sin(step * 1.5 + p.phase);
        o.position.y = p.home.y + Math.max(0, k) * lift * 1.6 * walk;
        o.rotation.y = k * 0.18 * walk;
        break;
      }
      case 'tail': o.rotation.y = Math.sin(t * 2.2) * 0.18 + Math.sin(step) * 0.25 * walk; o.rotation.x = Math.sin(t * 1.3) * 0.06; break;
      case 'head': o.rotation.x = Math.sin(step * 2) * 0.06 * walk + Math.sin(t * 0.7) * 0.04; o.rotation.y = Math.sin(t * 0.4) * 0.15 * (1 - walk); break;
      case 'wing': o.rotation.z = p.side * (Math.sin(t * (4 + walk * 6)) * (0.18 + walk * 0.3)); break;
      case 'arm': o.rotation.x = Math.sin(t * 1.4 + p.phase) * (0.1 + walk * 0.12); o.rotation.z = Math.cos(t * 1.1 + p.phase) * 0.08; break;
      case 'fish': o.rotation.y = Math.sin(t * (2.5 + walk * 5)) * (0.2 + walk * 0.2); break;
      default: break;
    }
  }
}
