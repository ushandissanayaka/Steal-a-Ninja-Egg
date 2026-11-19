// A tall, blocky ghost in the Bloxity style (built of boxes like a Bloxity character): a tattered
// black robe with no legs (it floats, ragged strips hanging), a torn chest with ribs showing, long
// bony arms hanging to its knees with black claws, and a pale face under a hood: hollow black
// sockets with glowing red eyes, black tears and a jagged grin. It does not dance: it floats, sways
// a little and slowly turns its head to watch you.
//
// Cheap: the body, each arm and the head are one merged mesh each (vertex colours, one material
// for every ghost); the eyes share one unlit red material.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGlow } from './Effects.js';

const ROBE = ['#16131c', '#1d1824', '#110e15'];
const PALE = '#d6dadc';
const BONE = '#c9c3b4';
const BLACK = '#050405';
const CLAW = '#1a1414';
const bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#ff1a10' });
const _c = new THREE.Color();

// collects boxes into one merged geometry
function builder() {
  const list = [];
  return {
    box(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) {
      const g = new THREE.BoxGeometry(w, h, d);
      g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
      g.translate(x, y, z);
      _c.set(color);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('uv');
      list.push(g);
    },
    mesh(material = bodyMaterial) {
      return new THREE.Mesh(mergeGeometries(list), material);
    },
  };
}

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const SHOULDER_Y = 9.3;
const NECK_Y = 9.7;

// the geometries are the same for every ghost: built once
let parts = null;
function buildParts() {
  const rnd = seeded(1337);
  const robe = () => ROBE[(rnd() * ROBE.length) | 0];
  // ---- the body: ragged robe, hips, torso with a torn chest and ribs, hunched shoulders
  const b = builder();
  for (let i = 0; i < 14; i++) { // ragged strips hanging from the waist (no legs)
    const a = (i / 14) * Math.PI * 2;
    const len = 2 + rnd() * 2.2;
    b.box(0.55, len, 0.3, Math.sin(a) * 1.25, 4.3 - len / 2, Math.cos(a) * 0.8, robe(), (rnd() - 0.5) * 0.25, a, (rnd() - 0.5) * 0.2);
  }
  b.box(2.7, 1.4, 1.7, 0, 4.9, 0, ROBE[0]);
  b.box(2.5, 1.3, 1.5, 0, 6.1, 0, ROBE[1]);
  b.box(2.4, 2.8, 1.3, 0, 7.9, 0, ROBE[0]);
  b.box(1.3, 2.0, 0.1, 0, 8.0, 0.66, BLACK);                       // the torn-open chest
  for (let r = 0; r < 4; r++) b.box(1.1 - r * 0.08, 0.16, 0.12, 0, 8.7 - r * 0.42, 0.7, BONE); // ribs
  b.box(0.18, 1.8, 0.12, 0, 8.0, 0.72, BONE);                      // the breastbone
  for (const s of [-1, 1]) {
    b.box(0.25, 2.2, 0.12, s * 0.75, 8.0, 0.7, ROBE[2], 0, 0, s * 0.08); // the ragged edges of the tear
    b.box(1.1, 0.8, 1.5, s * 1.3, SHOULDER_Y, -0.05, ROBE[1], 0, 0, s * -0.25); // hunched shoulders
  }
  b.box(0.7, 0.6, 0.7, 0, NECK_Y - 0.1, 0.1, PALE);                // a thin neck
  const body = b.mesh();

  // ---- an arm (built for the left side, mirrored for the right): sleeve, bony forearm, claws.
  // Its pivot is the shoulder (y = 0 here).
  const arm = (s) => {
    const a = builder();
    a.box(0.85, 2.3, 0.85, 0, -1.1, 0, ROBE[0]);
    a.box(1.0, 0.6, 1.0, 0, -2.3, 0, ROBE[2]);                     // the ragged cuff
    a.box(0.42, 2.6, 0.42, 0, -3.6, 0.05, BONE);                    // a long bony forearm
    a.box(0.7, 0.55, 0.45, 0, -5.1, 0.1, PALE);                     // the hand
    for (let f = 0; f < 4; f++) a.box(0.13, 1.3, 0.13, (f - 1.5) * 0.17, -5.9, 0.2 + Math.abs(f - 1.5) * 0.03, CLAW, -0.25, 0, (f - 1.5) * 0.08 * s);
    const m = a.mesh();
    return m;
  };

  // ---- the head under its hood: the pivot is the neck (y = 0 here)
  const h = builder();
  h.box(2.0, 2.3, 2.0, 0, 1.25, 0.15, PALE);                       // the face block
  h.box(2.6, 0.4, 2.6, 0, 2.6, -0.05, ROBE[0]);                    // the hood: top,
  h.box(1.6, 0.6, 1.6, 0, 3.0, -0.5, ROBE[1], -0.4);               //   a point at the back,
  for (const s of [-1, 1]) h.box(0.35, 2.7, 2.6, s * 1.15, 1.3, -0.05, ROBE[1]); // sides,
  h.box(2.6, 2.7, 0.4, 0, 1.3, -1.2, ROBE[0]);                     //   the back
  for (const s of [-1, 1]) {
    h.box(0.72, 0.55, 0.1, s * 0.5, 1.65, 1.17, BLACK, 0, 0, s * -0.3); // hollow, slanting sockets
    h.box(0.14, 0.8, 0.06, s * 0.52, 1.0, 1.17, BLACK);             // black tears running down
  }
  h.box(1.35, 0.6, 0.1, 0, 0.55, 1.17, BLACK);                     // the gaping mouth
  for (let t = 0; t < 5; t++) {                                    // jagged teeth, top and bottom
    h.box(0.14, 0.26, 0.08, -0.52 + t * 0.26, 0.74, 1.21, BONE, 0, 0, 0.3 * (t % 2 ? 1 : -1));
    h.box(0.14, 0.22, 0.08, -0.4 + t * 0.2, 0.34, 1.21, BONE, 0, 0, 0.3 * (t % 2 ? -1 : 1));
  }
  const head = h.mesh();
  // the glowing eyes deep in the sockets
  const e = builder();
  for (const s of [-1, 1]) e.box(0.34, 0.22, 0.06, s * 0.5, 1.63, 1.22, '#ffffff', 0, 0, s * -0.3);
  const eyes = e.mesh(eyeMaterial);
  parts = { body: body.geometry, armL: arm(1).geometry, armR: arm(-1).geometry, head: head.geometry, eyes: eyes.geometry };
}

export const GHOST_HEIGHT = 12.6; // in its own units, from the tips of the rags to the hood

export function createGhost() {
  if (!parts) buildParts();
  const root = new THREE.Group();
  const body = new THREE.Mesh(parts.body, bodyMaterial);
  const head = new THREE.Group();
  head.position.set(0, NECK_Y, 0.1);
  head.rotation.x = 0.18; // looking down at you
  head.add(new THREE.Mesh(parts.head, bodyMaterial), new THREE.Mesh(parts.eyes, eyeMaterial));
  // red glow round the eyes
  const glows = [-1, 1].map((s) => {
    const g = createGlow('#ff2010', 1.6);
    g.position.set(s * 0.5, 1.63, 1.4);
    head.add(g);
    return g;
  });
  const arms = [[1, parts.armL], [-1, parts.armR]].map(([s, geo]) => {
    const a = new THREE.Mesh(geo, bodyMaterial);
    a.position.set(s * 1.55, SHOULDER_Y, 0.1);
    a.rotation.set(-0.35, 0, s * 0.08); // reaching forward a little
    root.add(a);
    return a;
  });
  root.add(body, head);
  return { root, head, arms, glows };
}

// red eyes pulse slowly (one shared material, so all ghosts at once)
export function pulseGhostEyes(time) {
  const k = 0.75 + 0.25 * Math.sin(time * 2.1);
  eyeMaterial.color.setRGB(1, 0.1 * k, 0.06 * k).multiplyScalar(0.7 + 0.5 * k);
}
