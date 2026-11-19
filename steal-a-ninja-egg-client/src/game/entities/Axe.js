// The weapon held in the player's right hand (hotbar slot 1): the starter bat, or one of the swords
// unlocked in the Weapon Index (see WEAPONS in progression.js). Built in world units with the grip at
// the origin and the weapon along +Z. A swing knocks the egg out of another player's hands or dazes
// a guardian (better weapons daze it longer and reach further).

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { weaponById } from '../../shared/progression.js';

const shade = (hex, k) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

function bat(v) {
  v.box(0, -0.18, -0.35, 0.42, 0.36, 0.3, '#3a2414');   // knob
  v.box(0, -0.15, 0.5, 0.3, 0.3, 1.6, '#2a2a30');       // taped grip
  v.box(0, -0.2, 1.9, 0.4, 0.4, 1.4, '#c8894a');        // handle widening
  v.box(0, -0.27, 3.3, 0.54, 0.54, 1.6, '#d89a58');     // barrel
  v.box(0, -0.3, 4.3, 0.6, 0.6, 0.5, '#b8783a');        // end cap
  v.box(0, -0.29, 2.75, 0.58, 0.58, 0.16, '#e8432f');   // red stripe
}

// The grip, pommel and guard every blade shares. Returns where the blade starts (z).
function hilt(v, w, guard = 1.7) {
  v.box(0, -0.2, -0.45, 0.4, 0.4, 0.4, shade(w.hilt, 1.4));       // pommel
  v.box(0, -0.15, 0.45, 0.3, 0.3, 1.5, w.hilt);                    // grip
  for (let k = 0; k < 3; k++) v.box(0, -0.17, 0.05 + k * 0.5, 0.34, 0.34, 0.12, shade(w.hilt, 0.6)); // wraps
  v.box(0, -0.2, 1.3, guard, 0.4, 0.34, shade(w.hilt, 1.6));     // guard
  return 1.47;
}

// A straight blade from z0, `len` long, `w` wide, tapering to a point; striped if the weapon says so.
function straight(v, w, z0, len, width, thick = 0.16) {
  const body = len - width * 0.9;
  const n = w.stripe ? 7 : 1;
  for (let k = 0; k < n; k++) {
    v.box(0, -thick / 2, z0 + (body / n) * (k + 0.5), width, thick, body / n + 0.01, k % 2 ? w.stripe : w.blade);
  }
  v.box(0, -thick / 2, z0 + body + width * 0.25, width * 0.62, thick, width * 0.5, w.blade);
  v.box(0, -thick / 2, z0 + body + width * 0.62, width * 0.28, thick, width * 0.36, w.blade);
  v.box(0, -thick / 2 - 0.02, z0 + body / 2, width * 0.18, thick + 0.04, body * 0.92, shade(w.blade, 0.75)); // the fuller
}

// A blade that curves to one side as it goes (sabres, katanas).
function curved(v, w, z0, len, width, bend) {
  const n = 9;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const x = bend * t * t;
    const wk = width * (1 - t * 0.45);
    v.box(x, -0.08, z0 + len * t, wk, 0.16, len / n + 0.06, w.blade, { ry: -bend * 2 * t / len * 1.6 });
  }
}

const BUILD = {
  bat: (v) => bat(v),
  sword: (v, w) => straight(v, w, hilt(v, w), 4.2, 0.5),
  great: (v, w) => straight(v, w, hilt(v, w, 2.3), 5.2, 0.85, 0.22),
  rapier: (v, w) => {
    const z = hilt(v, w, 0.9);
    v.box(0, -0.35, 1.3, 0.9, 0.7, 0.2, shade(w.hilt, 1.6)); // the round cup guard
    straight(v, w, z, 5.4, 0.2, 0.12);
  },
  katana: (v, w) => {
    const z = hilt(v, w, 0.8);
    v.box(0, -0.35, 1.3, 0.8, 0.7, 0.16, '#d8b04a');
    curved(v, w, z, 5, 0.34, 0.55);
  },
  curved: (v, w) => curved(v, w, hilt(v, w), 4.4, 0.6, 0.9),
  cleaver: (v, w) => {
    const z = hilt(v, w, 0.6);
    v.box(0.35, -0.1, z + 1.7, 1.5, 0.2, 3.4, w.blade);
    v.box(-0.38, -0.12, z + 1.7, 0.1, 0.24, 3.4, shade(w.blade, 1.4)); // the sharp edge
    v.box(0.75, -0.13, z + 3.2, 0.3, 0.26, 0.3, shade(w.blade, 0.6)); // a hole near the top
  },
  scythe: (v, w) => {
    v.box(0, -0.15, 1.2, 0.3, 0.3, 4.8, w.hilt);                       // the long shaft
    v.box(0, -0.2, 3.6, 0.4, 0.4, 0.3, shade(w.hilt, 1.6));
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      v.box(-0.3 - t * 2.4, -0.08, 3.6 - Math.sin(t * 2.2) * 0.9, 0.7 - t * 0.35, 0.16, 0.5, w.blade, { ry: t * 0.9 });
    }
  },
};

export function createAxeMesh(id = 'bat') {
  const w = weaponById(id);
  const v = new Voxels();
  (BUILD[w.kind] || BUILD.sword)(v, w);
  const group = new THREE.Group();
  group.add(v.mesh({ receiveShadow: false }));
  // the better blades glow a little along their edge
  if (w.glow) {
    const g = new Voxels();
    const len = w.kind === 'great' ? 5.2 : w.kind === 'rapier' ? 5.4 : 4.4;
    g.box(0, 0.02, 1.5 + len * 0.45, 0.08, 0.06, len * 0.85, w.blade);
    group.add(new THREE.Mesh(g.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })));
  }
  return group;
}
