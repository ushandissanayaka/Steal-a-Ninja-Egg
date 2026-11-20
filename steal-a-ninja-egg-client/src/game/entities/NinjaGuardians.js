// The guardians of the first two stages are Bloxity characters dressed for the dojo (like the video):
//
//   Brown Ninja (Brown Ninja's Dojo): a dark brown hooded ninja suit with a mask, only a yellow
//     slit of face and two narrow eyes showing, a gold emblem on the chest, a black belt, dark
//     gloves and boots.
//   Old Master Hoshi (Old Master's Garden): an old man in a white karate gi under a dark vest with
//     big shoulder pads, a red sash, white wrapped trousers, a wide conical straw hat, bushy white
//     brows, a drooping moustache and a long white beard.
//
// Each is the Bloxity base rig (so it walks, runs and throws its arms up like a player) with its
// outfit built from boxes pinned to the rig's bones: the boxes are drawn where they sit on the body
// in the rig's rest pose (model units: feet at 0, the head from 4.8 to 6.4, facing +z), and each
// bone's group carries the inverse of that bone's rest matrix, so the clothes follow every move.

import * as THREE from 'three';
import { BloxityAvatar } from './BloxityAvatar.js';
import { Voxels } from '../util/bake.js';
import { glowMap } from './Effects.js';

export const NINJA_GUARDIANS = new Set(['brownNinja', 'oldMaster', 'redNinja', 'blueNinja', 'earthNinja', 'greenNinja', 'iceNinja', 'waterQueen', 'ghostNinja', 'shadowLord']);

// model units: how tall each one stands (the master's hat sticks up over his head)
const HEIGHT = { brownNinja: 6.6, oldMaster: 7.6, redNinja: 6.6, blueNinja: 7.6, earthNinja: 7.0, greenNinja: 6.6, iceNinja: 6.6, waterQueen: 7.0, ghostNinja: 7.0, shadowLord: 7.4 };

let clothMaterial = null;
const cloth = () => (clothMaterial ??= new THREE.MeshLambertMaterial({ vertexColors: true }));

// A box by its middle (Voxels.box takes the bottom).
const put = (v, x, y, z, w, h, d, color, opts) => v.box(x, y - h / 2, z, w, h, d, color, opts);

// Body parts in the rest pose (model units), and the bone each one follows.
const PART = {
  head: { bone: 'Neck1', at: [0, 5.6, 0] },
  torso: { bone: 'Spine2', at: [0, 3.6, 0] },
  waist: { bone: 'Spine1', at: [0, 2.5, 0] },
  armL: { bone: 'ArmL_Offset', at: [2.0, 3.6, 0] },
  armR: { bone: 'ArmR_Offset', at: [-2.0, 3.6, 0] },
  legL: { bone: 'LegL_Offset', at: [0.7, 1.2, 0] },
  legR: { bone: 'LegR_Offset', at: [-0.7, 1.2, 0] },
};

// ------------------------------------------------------------------ the outfits

// draw(part, v): the boxes for that part. eyes: [x, y, z] of each eye (on the head bone).
const OUTFITS = {
  brownNinja: {
    eyes: [[-0.34, 5.66, 0.9], [0.34, 5.66, 0.9]],
    eyeColor: '#14100c',
    head(v) {
      const HOOD = '#4a2a1a', DARK = '#3a2014';
      put(v, 0, 6.2, 0, 1.78, 0.5, 1.78, HOOD);          // the top of the hood
      put(v, 0, 5.05, 0, 1.78, 0.6, 1.78, DARK);         // the mask over the mouth and chin
      put(v, 0, 5.62, -0.18, 1.78, 0.66, 1.42, HOOD);    // the sides and back round the eye slit
      put(v, 0, 5.62, 0.66, 1.72, 0.62, 0.42, '#f2c94c'); // the yellow face in the slit
      // angry brows, the hood's ridge, and the knot with two tails at the back
      put(v, -0.36, 5.93, 0.9, 0.5, 0.12, 0.06, DARK, { rz: -0.35 });
      put(v, 0.36, 5.93, 0.9, 0.5, 0.12, 0.06, DARK, { rz: 0.35 });
      put(v, 0, 6.48, 0.1, 1.2, 0.12, 1.5, DARK);
      put(v, 0, 5.62, -0.98, 0.4, 0.4, 0.3, DARK);
      put(v, 0.18, 5.15, -1.05, 0.22, 0.9, 0.12, DARK, { rz: 0.25 });
      put(v, -0.18, 5.1, -1.05, 0.22, 0.95, 0.12, DARK, { rz: -0.2 });
    },
    // the dragon logo: gold, on the chest and big across the back
    dragon: { color: '#ffc21f', dark: '#6a3a08', light: '#fff2a8', front: [0, 3.55, 0.915, 2.3, 2.3], back: [0, 3.65, -0.9, 2.7, 2.35] },
    torso(v) {
      const GI = '#5a3420', LAPEL = '#7a4a2a';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, GI);
      // the jacket crossing over the chest (a V of lighter lapels)
      put(v, -0.42, 4.15, 0.88, 0.36, 1.5, 0.06, LAPEL, { rz: -0.5 });
      put(v, 0.42, 4.15, 0.88, 0.36, 1.5, 0.06, LAPEL, { rz: 0.5 });
      // shoulder plates
      for (const s of [-1, 1]) put(v, s * 1.12, 4.82, 0, 0.9, 0.22, 1.8, '#3a2014');
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.36, 1.78, '#16120e');
      put(v, 0.5, 2.55, 0.92, 0.36, 0.36, 0.12, '#16120e');
      put(v, 0.62, 2.15, 0.94, 0.2, 0.7, 0.08, '#16120e', { rz: 0.15 });
      put(v, 0.38, 2.12, 0.94, 0.2, 0.75, 0.08, '#16120e', { rz: -0.1 });
    },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#5a3420');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#1c1410'); // the glove
      put(v, s * 2.0, 3.0, 0, 1.38, 0.14, 1.78, '#3a2014');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#3a2216');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#16120e'); // the boot
      put(v, s * 0.7, 0.68, 0, 1.56, 0.14, 1.78, '#2a1a12');   // a wrap round the ankle
    },
  },

  // Red Ninja (Red Ninja's Fire Temple): a bright red hooded ninja suit, a yellow face slit, dark
  // red patterned chest with a grey strap across it, black belt, black gloves and dark knee pads
  redNinja: {
    eyes: [[-0.34, 5.66, 0.9], [0.34, 5.66, 0.9]],
    eyeColor: '#14100c',
    head(v) {
      const HOOD = '#d6202e', DARK = '#a8141f';
      put(v, 0, 6.2, 0, 1.78, 0.5, 1.78, HOOD);
      put(v, 0, 5.05, 0, 1.78, 0.6, 1.78, HOOD);
      put(v, 0, 5.62, -0.18, 1.78, 0.66, 1.42, HOOD);
      put(v, 0, 5.62, 0.66, 1.72, 0.62, 0.42, '#f2c94c');
      put(v, -0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#2a0a0a', { rz: -0.35 });
      put(v, 0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#2a0a0a', { rz: 0.35 });
      // the folds of the mask under the eyes and the hood's ridge, the knot at the back
      put(v, 0, 5.28, 0.9, 1.5, 0.1, 0.06, DARK);
      put(v, 0, 6.48, 0.1, 1.2, 0.12, 1.5, DARK);
      put(v, 0, 5.62, -0.98, 0.4, 0.4, 0.3, DARK);
      put(v, 0.18, 5.15, -1.05, 0.22, 0.9, 0.12, HOOD, { rz: 0.25 });
      put(v, -0.18, 5.1, -1.05, 0.22, 0.95, 0.12, HOOD, { rz: -0.2 });
    },
    // the dragon logo: flame orange, on the chest and big across the back
    dragon: { color: '#ff8a1a', dark: '#4a0a06', light: '#ffe08a', front: [0, 3.45, 0.915, 2.0, 2.0], back: [0, 3.65, -0.9, 2.7, 2.35] },
    torso(v) {
      const GI = '#c81a28', DARK = '#7a0e18', STRAP = '#7d828c';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, GI);
      // the dark red patterned chest piece with gold-ish swirls at the collar
      put(v, 0, 4.35, 0.87, 2.2, 0.9, 0.06, DARK);
      for (const s of [-1, 1]) put(v, s * 0.6, 4.45, 0.91, 0.5, 0.12, 0.04, '#e0a03a', { rz: s * 0.4 });
      // the grey strap across the chest (shoulder to hip) with two buckles, round the back too
      put(v, 0.15, 3.85, 0.9, 0.34, 2.6, 0.06, STRAP, { rz: -0.72 });
      put(v, 0.15, 3.85, -0.9, 0.34, 2.6, 0.06, STRAP, { rz: 0.72 });
      put(v, -0.35, 4.3, 0.93, 0.28, 0.22, 0.05, '#c8ccd4', { rz: -0.72 });
      put(v, 0.55, 3.45, 0.93, 0.28, 0.22, 0.05, '#c8ccd4', { rz: -0.72 });
      for (const s of [-1, 1]) put(v, s * 1.12, 4.82, 0, 0.9, 0.22, 1.8, DARK);
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.36, 1.78, '#16120e');
      put(v, 0, 2.55, 0.92, 0.5, 0.4, 0.12, '#7d828c');
    },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#c81a28');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#16120e'); // the glove
      put(v, s * 2.0, 3.0, 0, 1.38, 0.14, 1.78, '#7a0e18');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#b0161f');
      put(v, s * 0.7, 1.15, 0.86, 1.1, 0.7, 0.06, '#2a0a0e'); // the knee pad
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#16120e');
      put(v, s * 0.7, 0.68, 0, 1.56, 0.14, 1.78, '#7a0e18');
    },
  },

  // Blue Ninja (Blue Ninja's Lightning Ruins): a wide dark-blue conical hat, a yellow face slit in
  // a dark blue mask, a blue gi with gold-and-white lightning streaks, a red sash, blue gloves
  blueNinja: {
    eyes: [[-0.34, 5.66, 0.9], [0.34, 5.66, 0.9]],
    eyeColor: '#14100c',
    head(v) {
      const MASK = '#1c3a8a', HAT = '#1a2c6a', RIM = '#2a4aa8';
      put(v, 0, 5.05, 0, 1.78, 0.6, 1.78, MASK);
      put(v, 0, 5.62, -0.18, 1.78, 0.66, 1.42, MASK);
      put(v, 0, 6.1, 0, 1.78, 0.36, 1.78, MASK);
      put(v, 0, 5.62, 0.66, 1.72, 0.62, 0.42, '#f2c94c');
      put(v, -0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#0a0a1a', { rz: -0.35 });
      put(v, 0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#0a0a1a', { rz: 0.35 });
      // the wide hat in rings, with a lighter rim and a blue band
      const rings = [[4.6, 0.2, RIM], [3.8, 0.24, HAT], [2.9, 0.26, HAT], [2.0, 0.28, HAT], [1.1, 0.3, HAT]];
      let y = 6.28;
      for (const [w, h, c] of rings) {
        put(v, 0, y + h / 2, 0, w, h, w, c);
        put(v, 0, y + h / 2, 0, w * 0.92, h, w * 0.92, c, { ry: Math.PI / 4 });
        y += h;
      }
      put(v, 0, 6.36, 0, 1.86, 0.16, 1.86, '#4ab8ff');
      put(v, 0, y + 0.1, 0, 0.36, 0.3, 0.36, '#4ab8ff');
    },
    // the dragon logo: electric blue, big across the back
    dragon: { color: '#5fd0ff', dark: '#0a1a4a', light: '#e8fbff', front: [0, 3.45, 0.915, 1.9, 1.9], back: [0, 3.65, -0.9, 2.7, 2.35] },
    torso(v) {
      const GI = '#2a56c8', DARK = '#1c3a8a';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, GI);
      put(v, 0, 4.35, 0.87, 2.2, 0.9, 0.06, DARK);
      // gold and white lightning streaks down the jacket
      for (const [x, y, rz, c] of [[-0.9, 4.2, 0.6, '#ffd84a'], [-0.7, 3.5, -0.6, '#ffffff'], [0.85, 3.9, -0.5, '#ffd84a'], [0.65, 3.2, 0.6, '#ffffff']]) {
        put(v, x, y, 0.91, 0.16, 0.8, 0.04, c, { rz });
      }
      for (const s of [-1, 1]) put(v, s * 1.12, 4.82, 0, 0.9, 0.22, 1.8, DARK);
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.42, 1.78, '#c81e2a');
      put(v, 0.5, 2.15, 0.94, 0.3, 0.8, 0.08, '#c81e2a', { rz: 0.15 });
    },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#2a56c8');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#1a2c6a');
      put(v, s * 2.0, 3.0, 0, 1.38, 0.14, 1.78, '#ffd84a');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#1c3a8a');
      put(v, s * 0.7, 1.2, 0.86, 0.9, 0.6, 0.06, '#4ab8ff');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#10183a');
    },
  },

  // Black Ninja (Black Ninja's Earth Caves): no hood, a yellow face under long thick black hair, a
  // dark navy gi with a gold plate on the chest, a tan sash, bare yellow upper arms, dark gloves
  earthNinja: {
    eyes: [[-0.36, 5.72, 0.88], [0.36, 5.72, 0.88]],
    eyeColor: '#14141a',
    head(v) {
      const SKIN = '#f2c94c', HAIR = '#16161c';
      put(v, 0, 5.6, 0, 1.7, 1.66, 1.7, SKIN);
      put(v, -0.36, 6.0, 0.88, 0.5, 0.13, 0.08, HAIR, { rz: -0.15 });
      put(v, 0.36, 6.0, 0.88, 0.5, 0.13, 0.08, HAIR, { rz: 0.15 });
      put(v, 0.2, 5.15, 0.88, 0.5, 0.1, 0.06, '#8a3a1e', { rz: 0.1 });  // a smirk
      // the hair: a thick top, a fringe swept over the forehead, and long locks down the back and sides
      put(v, 0, 6.5, -0.05, 1.95, 0.55, 1.95, HAIR);
      put(v, -0.25, 6.2, 0.86, 1.4, 0.32, 0.2, HAIR, { rz: 0.18 });
      put(v, 0, 5.2, -0.95, 1.95, 2.1, 0.3, HAIR);
      for (const s of [-1, 1]) put(v, s * 0.95, 5.55, -0.2, 0.25, 1.5, 1.3, HAIR);
      for (const x of [-0.6, 0, 0.6]) put(v, x, 4.15, -1.0, 0.5, 0.8, 0.22, HAIR, { rz: x * 0.3 });
    },
    // the dragon logo: earthy gold, big across the back
    dragon: { color: '#e0b040', dark: '#2a1a08', light: '#fff0b0', front: [0.55, 3.35, 0.915, 1.3, 1.3], back: [0, 3.65, -0.985, 2.7, 2.35], sleeves: true },
    heavy: { gold: '#ffcc33', dark: '#16161c', plate: '#3a4060', swords: 2 },
    torso(v) {
      const GI = '#1e2238', GOLD = '#c8a040';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, GI);
      // the gold chest plate and its studs, a strap across
      put(v, -0.45, 4.2, 0.9, 1.0, 0.9, 0.08, GOLD);
      for (const [x, y] of [[-0.7, 4.4], [-0.2, 4.4], [-0.45, 3.95]]) put(v, x, y, 0.95, 0.2, 0.2, 0.05, '#8a6a20');
      put(v, 0.15, 3.85, 0.9, 0.28, 2.6, 0.06, '#2a2e48', { rz: 0.7 });
      for (const s of [-1, 1]) put(v, s * 1.15, 4.82, 0, 0.9, 0.24, 1.8, '#2a2e48');
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.44, 1.78, '#a08460');
      put(v, -0.4, 2.1, 0.94, 0.4, 0.8, 0.08, '#a08460', { rz: -0.1 });
    },
    arm(v, s) {
      put(v, s * 2.0, 4.15, 0, 1.32, 1.3, 1.72, '#f2c94c');   // bare upper arm
      put(v, s * 2.0, 4.82, 0, 1.36, 0.3, 1.76, '#1e2238');   // the sleeve's edge
      put(v, s * 2.0, 3.0, 0, 1.36, 1.0, 1.76, '#16161c');    // the long glove
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#1e2238');
      put(v, s * 0.7, 1.15, 0.86, 1.0, 0.6, 0.06, '#c8a040');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#10121e');
    },
  },

  // Green Ninja (Green Ninja's Energy Temple): a bright green hooded ninja suit with gold trim,
  // a yellow face slit, a gold belt
  greenNinja: {
    eyes: [[-0.34, 5.66, 0.9], [0.34, 5.66, 0.9]],
    eyeColor: '#14100c',
    head(v) {
      const HOOD = '#2fae3a', DARK = '#1e7a28';
      put(v, 0, 6.2, 0, 1.78, 0.5, 1.78, HOOD);
      put(v, 0, 5.05, 0, 1.78, 0.6, 1.78, HOOD);
      put(v, 0, 5.62, -0.18, 1.78, 0.66, 1.42, HOOD);
      put(v, 0, 5.62, 0.66, 1.72, 0.62, 0.42, '#f2c94c');
      put(v, -0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#0a1a0a', { rz: -0.35 });
      put(v, 0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#0a1a0a', { rz: 0.35 });
      put(v, 0, 6.48, 0.1, 1.2, 0.12, 1.5, '#ffd84a');
      put(v, 0, 5.62, -0.98, 0.4, 0.4, 0.3, DARK);
      put(v, 0.18, 5.15, -1.05, 0.22, 0.9, 0.12, HOOD, { rz: 0.25 });
      put(v, -0.18, 5.1, -1.05, 0.22, 0.95, 0.12, HOOD, { rz: -0.2 });
    },
    // the dragon logo: glowing gold-green, on the chest and big across the back
    dragon: { color: '#d8ff3a', dark: '#0e3a12', light: '#ffffd0', front: [0, 3.45, 0.915, 2.0, 2.0], back: [0, 3.65, -0.985, 2.7, 2.35], sleeves: true },
    heavy: { gold: '#ffd84a', dark: '#145a1e', plate: '#2fae3a', swords: 2 },
    torso(v) {
      const GI = '#2fae3a', DARK = '#1e7a28';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, GI);
      put(v, -0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#ffd84a', { rz: -0.5 });
      put(v, 0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#ffd84a', { rz: 0.5 });
      for (const s of [-1, 1]) put(v, s * 1.12, 4.82, 0, 0.9, 0.22, 1.8, DARK);
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.38, 1.78, '#d8a020');
      put(v, 0, 2.55, 0.92, 0.5, 0.42, 0.12, '#ffd84a');
    },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#2fae3a');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#1e7a28');
      put(v, s * 2.0, 3.0, 0, 1.38, 0.14, 1.78, '#ffd84a');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#26943a');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#14501c');
      put(v, s * 0.7, 0.68, 0, 1.56, 0.14, 1.78, '#ffd84a');
    },
  },

  // White Ninja (White Ninja's Ice Temple): a frost-pale hood and mask round a pale blue-grey face, a
  // dark navy gi with silver lapels, frost-blue dragons
  iceNinja: {
    eyes: [[-0.34, 5.66, 0.9], [0.34, 5.66, 0.9]],
    eyeColor: '#0a1a3a',
    head(v) {
      const HOOD = '#d4e2f2', DARK = '#9ab4d0';
      put(v, 0, 6.2, 0, 1.78, 0.5, 1.78, HOOD);
      put(v, 0, 5.05, 0, 1.78, 0.6, 1.78, HOOD);
      put(v, 0, 5.62, -0.18, 1.78, 0.66, 1.42, HOOD);
      put(v, 0, 5.62, 0.66, 1.72, 0.62, 0.42, '#b8cde4');
      put(v, -0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#3a5a8a', { rz: -0.35 });
      put(v, 0.36, 5.93, 0.9, 0.5, 0.12, 0.06, '#3a5a8a', { rz: 0.35 });
      put(v, 0, 6.48, 0.1, 1.2, 0.12, 1.5, '#7fd8ff');
      put(v, 0, 5.62, -0.98, 0.4, 0.4, 0.3, DARK);
      put(v, 0.18, 5.15, -1.05, 0.22, 0.9, 0.12, HOOD, { rz: 0.25 });
      put(v, -0.18, 5.1, -1.05, 0.22, 0.95, 0.12, HOOD, { rz: -0.2 });
    },
    dragon: { color: '#8ae4ff', dark: '#0a2a5a', light: '#ffffff', front: [0, 3.45, 0.915, 1.9, 1.9], back: [0, 3.65, -0.985, 2.7, 2.35], sleeves: true },
    heavy: { gold: '#ffcc33', dark: '#141c34', plate: '#c8d4e4', swords: 1 },
    torso(v) {
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, '#1a2440');
      put(v, -0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#c8ccd4', { rz: -0.5 });
      put(v, 0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#c8ccd4', { rz: 0.5 });
    },
    waist(v) { put(v, 0, 2.55, 0, 2.98, 0.4, 1.78, '#c8ccd4'); },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#1a2440');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#b8cde4');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#1a2440');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#0e1428');
    },
  },

  // Water Queen (Water Queen's Sea Kingdom): a woman made of water: an aqua face and hands, long
  // flowing hair down her back, a light aqua wrap gown with a white wave on the chest, sea-blue trim
  waterQueen: {
    eyes: [[-0.34, 5.7, 0.88], [0.34, 5.7, 0.88]],
    eyeColor: '#0a2a6a',
    head(v) {
      const SKIN = '#8ae4ff', HAIR = '#3ab0e0', DEEP = '#1a7ac0';
      put(v, 0, 5.6, 0, 1.7, 1.66, 1.7, SKIN);
      // a soft smile, lashes
      put(v, 0, 5.2, 0.86, 0.46, 0.08, 0.06, '#1a5a9a');
      for (const s of [-1, 1]) put(v, s * 0.42, 5.88, 0.87, 0.3, 0.06, 0.05, DEEP, { rz: s * 0.3 });
      // the hair: a crown of it on top, a fringe swept to one side, and long locks flowing down the back
      put(v, 0, 6.5, -0.05, 1.95, 0.5, 1.95, HAIR);
      put(v, -0.3, 6.15, 0.86, 1.3, 0.38, 0.22, HAIR, { rz: 0.22 });
      for (const s of [-1, 1]) put(v, s * 0.95, 5.4, -0.15, 0.28, 2.0, 1.3, HAIR);
      put(v, 0, 4.9, -0.98, 1.9, 3.2, 0.32, HAIR);
      for (const [x, rz] of [[-0.6, 0.15], [0, 0], [0.6, -0.15]]) put(v, x, 3.1, -1.02, 0.55, 1.0, 0.24, DEEP, { rz });
      put(v, 0.55, 6.4, 0.7, 0.4, 0.4, 0.2, '#ffffff'); // a pearl clip
    },
    dragon: { color: '#bff4ff', dark: '#0a3a7a', light: '#ffffff', front: null, back: null, sleeves: true },
    heavy: { gold: '#ffd84a', dark: '#0a3a7a', plate: '#e8faff', swords: 0 },
    torso(v) {
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, '#5fd0f0');
      // the wrap of the gown and the white wave on her chest
      put(v, -0.4, 4.15, 0.88, 0.3, 1.5, 0.06, '#1a7ac0', { rz: -0.5 });
      put(v, 0.4, 4.15, 0.88, 0.3, 1.5, 0.06, '#1a7ac0', { rz: 0.5 });
      for (const [x, y, w, rz] of [[-0.45, 3.4, 0.9, 0.5], [0.15, 3.6, 0.8, -0.4], [0.55, 3.3, 0.6, 0.6]]) put(v, x, y, 0.91, w, 0.2, 0.05, '#ffffff', { rz });
    },
    waist(v) { put(v, 0, 2.55, 0, 2.98, 0.4, 1.78, '#1a7ac0'); },
    arm(v, s) {
      put(v, s * 2.0, 3.95, 0, 1.32, 1.75, 1.72, '#5fd0f0');
      put(v, s * 2.0, 3.0, 0, 1.38, 0.2, 1.78, '#1a7ac0');
      put(v, s * 2.0, 2.66, 0.1, 1.28, 0.62, 1.6, '#8ae4ff');
    },
    leg(v, s) {
      // the long gown, flaring a little at the hem
      put(v, s * 0.7, 1.4, 0, 1.52, 2.1, 1.74, '#5fd0f0');
      put(v, s * 0.72, 0.3, 0, 1.62, 0.5, 1.9, '#3ab0e0');
    },
  },

  // Ghost Ninja (Ghost Ninja's Haunted District): a ghost of a ninja: a pale green ghostly face with
  // sunken dark eyes, wild dark hair swept back, a green gi under dark green armour, a cyan spirit
  // light round his left fist and a glowing yellow sword held out in his right hand
  ghostNinja: {
    eyes: [[-0.36, 5.68, 0.88], [0.36, 5.68, 0.88]],
    eyeColor: '#06140a',
    head(v) {
      const FACE = '#a8f0b0', SHADE = '#5ab872', HAIR = '#16222e';
      put(v, 0, 5.6, 0, 1.7, 1.66, 1.7, FACE);
      // dark hollows round the eyes, a thin grim mouth, grey-green cheek lines
      for (const s of [-1, 1]) {
        put(v, s * 0.36, 5.7, 0.86, 0.5, 0.42, 0.04, SHADE);
        put(v, s * 0.4, 5.98, 0.87, 0.5, 0.1, 0.05, '#0e2a14', { rz: s * 0.35 });
        put(v, s * 0.55, 5.25, 0.87, 0.08, 0.36, 0.04, SHADE);
      }
      put(v, 0, 5.18, 0.87, 0.5, 0.08, 0.05, '#0e2a14');
      // the hair: a thick mop on top, swept back into spikes, long at the back
      put(v, 0, 6.5, -0.05, 1.9, 0.5, 1.9, HAIR);
      put(v, 0.15, 6.32, 0.82, 1.5, 0.3, 0.24, HAIR, { rz: -0.15 });
      for (const [x, rz] of [[-0.6, 0.5], [0, 0], [0.6, -0.5]]) put(v, x, 6.8, -0.5, 0.4, 0.7, 0.4, HAIR, { rx: -0.5, rz });
      for (const s of [-1, 1]) put(v, s * 0.92, 5.7, -0.25, 0.22, 1.4, 1.2, HAIR);
      put(v, 0, 5.2, -0.95, 1.8, 2.0, 0.3, HAIR);
      // a dark scarf round the neck
      put(v, 0, 4.85, 0, 1.9, 0.3, 1.9, '#0e3a1a');
    },
    dragon: { color: '#5aff9a', dark: '#06200e', light: '#e8fff0', front: [0, 3.45, 0.915, 1.9, 1.9], back: [0, 3.65, -0.985, 2.7, 2.35], sleeves: true },
    heavy: { gold: '#c8ff5a', dark: '#0a1a10', plate: '#1e5a2a', swords: 1 },
    blade: { hand: -1, color: '#fff27a', edge: '#ffd21f', glow: '#ffe23a', grip: '#2a1a0a' },
    fist: { hand: 1, color: '#7ff8ff', glow: '#3ae8ff' },
    torso(v) {
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, '#1e8a3a');
      put(v, -0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#0e3a1a', { rz: -0.5 });
      put(v, 0.42, 4.15, 0.88, 0.36, 1.5, 0.06, '#0e3a1a', { rz: 0.5 });
    },
    waist(v) { put(v, 0, 2.55, 0, 2.98, 0.4, 1.78, '#0e3a1a'); },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#1e8a3a');
      put(v, s * 2.0, 2.78, 0, 1.36, 0.7, 1.76, '#0e2a14');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#145a24');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#0a1a10');
    },
  },

  // The Shadow Lord (Shadow Lord's Fortress, the last stage): a monster of a ninja: a charcoal face
  // with deep wrinkles, glowing red eyes, a fanged grin and bone horns, a bone ribcage armour over a
  // black gi, a purple sash, bone bracers and greaves, lilac clawed hands and a purple glowing sword
  shadowLord: {
    eyes: [[-0.4, 5.74, 0.89], [0.4, 5.74, 0.89]],
    eyeColor: '#ff1a1a',
    glowEyes: '#ff2a1a',
    head(v) {
      const SKIN = '#34323c', DEEP = '#1a1820', BONE = '#ece4d4';
      put(v, 0, 5.6, 0, 1.76, 1.7, 1.76, SKIN);
      // a heavy angry brow, wrinkles down the cheeks and over the nose
      put(v, 0, 6.0, 0.9, 1.6, 0.22, 0.1, DEEP);
      for (const s of [-1, 1]) {
        put(v, s * 0.42, 6.06, 0.94, 0.62, 0.14, 0.06, DEEP, { rz: s * 0.45 });
        put(v, s * 0.66, 5.3, 0.9, 0.08, 0.6, 0.04, DEEP, { rz: s * 0.2 });
        put(v, s * 0.2, 5.45, 0.92, 0.06, 0.3, 0.04, DEEP);
      }
      // the grin: a black mouth with white fangs
      put(v, 0, 5.08, 0.9, 1.1, 0.34, 0.06, '#0a0608');
      for (const x of [-0.42, -0.14, 0.14, 0.42]) put(v, x, 5.16, 0.93, 0.14, 0.2, 0.04, BONE);
      for (const x of [-0.28, 0, 0.28]) put(v, x, 4.98, 0.93, 0.12, 0.16, 0.04, BONE);
      // a black top knot and two bone horns curling up
      put(v, 0, 6.55, -0.1, 1.84, 0.34, 1.7, DEEP);
      put(v, 0, 6.85, -0.35, 0.6, 0.6, 0.6, DEEP);
      for (const s of [-1, 1]) {
        put(v, s * 0.95, 6.6, 0, 0.36, 0.7, 0.36, BONE, { rz: -s * 0.5 });
        put(v, s * 1.2, 7.1, 0, 0.26, 0.6, 0.26, BONE, { rz: -s * 0.15 });
      }
    },
    dragon: { color: '#ff3ad8', dark: '#1a0624', light: '#ffd0f4', front: null, back: [0, 3.65, -0.985, 2.7, 2.35], sleeves: true },
    heavy: { gold: '#b04ae0', dark: '#0e0a14', plate: '#3a3444', swords: 2, straps: false },
    blade: { hand: -1, color: '#e8a8ff', edge: '#a83aff', glow: '#c84aff', grip: '#0e0a14' },
    torso(v) {
      const BONE = '#ece4d4';
      put(v, 0, 3.66, 0, 2.94, 2.36, 1.74, '#24222c');
      // the ribcage armour: a breastbone and ribs curving round
      put(v, 0, 3.7, 0.9, 0.3, 2.0, 0.08, BONE);
      for (let i = 0; i < 5; i++) {
        const y = 4.4 - i * 0.36, w = 2.3 - i * 0.12;
        put(v, 0, y, 0.9, w, 0.16, 0.06, BONE);
        for (const s of [-1, 1]) put(v, s * 1.45, y, 0.45, 0.06, 0.16, 0.8, BONE);
      }
      // a purple sash across the chest
      put(v, 0, 3.4, 0.95, 0.4, 3.0, 0.06, '#c84ae0', { rz: 0.8 });
    },
    waist(v) {
      put(v, 0, 2.55, 0, 2.98, 0.44, 1.78, '#a83ac8');
      put(v, 0.6, 2.2, 0.92, 0.4, 0.8, 0.06, '#a83ac8', { rz: 0.2 });
    },
    arm(v, s) {
      put(v, s * 2.0, 3.85, 0, 1.32, 1.95, 1.72, '#24222c');
      for (const y of [3.2, 3.5]) put(v, s * 2.0, y, 0, 1.4, 0.12, 1.8, '#ece4d4');
      put(v, s * 2.0, 2.72, 0, 1.36, 0.66, 1.76, '#d890e8');
      for (const x of [-0.4, 0, 0.4]) put(v, s * 2.0 + x, 2.3, 0.6, 0.18, 0.3, 0.18, '#ece4d4');
    },
    leg(v, s) {
      put(v, s * 0.7, 1.4, 0, 1.5, 2.06, 1.72, '#24222c');
      for (const y of [0.9, 1.25, 1.6]) put(v, s * 0.7, y, 0.88, 1.2, 0.12, 0.08, '#ece4d4');
      put(v, s * 0.7, 0.3, 0.06, 1.54, 0.64, 1.86, '#0e0a14');
    },
  },

  oldMaster: {
    eyes: [[-0.36, 5.72, 0.88], [0.36, 5.72, 0.88]],
    eyeColor: '#14141a',
    head(v) {
      const SKIN = '#f2c94c', WHITE = '#f4f2ea', HAT = '#efeadb', RIM = '#cfc4a6';
      put(v, 0, 5.6, 0, 1.7, 1.66, 1.7, SKIN);
      // bushy white brows, frowning
      put(v, -0.4, 6.02, 0.88, 0.62, 0.2, 0.12, WHITE, { rz: -0.3 });
      put(v, 0.4, 6.02, 0.88, 0.62, 0.2, 0.12, WHITE, { rz: 0.3 });
      // the moustache drooping down past the chin either side
      put(v, -0.3, 5.3, 0.9, 0.5, 0.2, 0.14, WHITE, { rz: 0.4 });
      put(v, 0.3, 5.3, 0.9, 0.5, 0.2, 0.14, WHITE, { rz: -0.4 });
      put(v, -0.62, 4.85, 0.9, 0.18, 0.8, 0.14, WHITE, { rz: 0.15 });
      put(v, 0.62, 4.85, 0.9, 0.18, 0.8, 0.14, WHITE, { rz: -0.15 });
      // the long beard, over the chest
      put(v, 0, 4.7, 0.98, 0.8, 1.3, 0.26, WHITE);
      put(v, 0, 3.75, 1.02, 0.56, 0.8, 0.22, WHITE);
      put(v, 0, 3.15, 1.04, 0.3, 0.5, 0.2, WHITE);
      put(v, 0, 5.18, 0.9, 0.5, 0.18, 0.1, '#8a3a1e'); // a frowning mouth under the moustache
      // the straw hat: a wide flat cone in rings, a dark band under it, a knob on top
      put(v, 0, 6.42, 0, 1.76, 0.18, 1.76, '#3a2a1a');
      const rings = [[4.4, 0.2, RIM], [3.6, 0.26, HAT], [2.7, 0.28, HAT], [1.8, 0.3, HAT], [0.9, 0.3, HAT]];
      let y = 6.58;
      for (const [w, h, c] of rings) {
        put(v, 0, y + h / 2, 0, w, h, w, c);
        put(v, 0, y + h / 2, 0, w * 0.92, h, w * 0.92, c, { ry: Math.PI / 4 });
        y += h;
      }
      put(v, 0, y + 0.12, 0, 0.3, 0.3, 0.3, '#d8b84a');
    },
    // the dragon logo: red like his sash, big across the back of the vest and small on its front
    dragon: { color: '#e02a36', dark: '#3a0608', light: '#ff9a8a', front: [0.95, 3.6, 0.885, 1.0, 1.2], back: [0, 3.65, -0.915, 2.8, 2.35] },
    torso(v) {
      const GI = '#f4f2ea', VEST = '#2e1c14', TRIM = '#5a3424';
      put(v, 0, 3.66, 0, 2.92, 2.36, 1.72, GI);
      // the dark vest: the back, both sides of the front (the white gi shows down the middle)
      put(v, 0, 3.66, -0.1, 2.98, 2.38, 1.6, VEST);
      for (const s of [-1, 1]) {
        put(v, s * 0.95, 3.66, 0.82, 1.0, 2.38, 0.1, VEST);
        put(v, s * 0.45, 3.66, 0.86, 0.12, 2.38, 0.06, TRIM);
        // the big rounded shoulder pads
        put(v, s * 1.35, 4.86, 0, 1.3, 0.42, 2.0, VEST);
        put(v, s * 1.55, 4.62, 0, 1.0, 0.4, 1.9, TRIM);
      }
    },
    waist(v) {
      put(v, 0, 2.6, 0, 2.98, 0.46, 1.78, '#c81e2a');
      put(v, 0, 2.6, 0.92, 0.5, 0.5, 0.14, '#a8141e');
      put(v, -0.15, 2.0, 0.95, 0.32, 1.0, 0.1, '#c81e2a', { rz: 0.12 });
      put(v, 0.2, 2.05, 0.95, 0.3, 0.9, 0.1, '#c81e2a', { rz: -0.12 });
    },
    arm(v, s) {
      put(v, s * 2.0, 3.95, 0, 1.34, 1.75, 1.74, '#f4f2ea');
      put(v, s * 2.0, 3.05, 0, 1.38, 0.22, 1.78, '#2e1c14'); // the cuff
      put(v, s * 2.0, 2.66, 0.1, 1.28, 0.62, 1.6, '#f2c94c'); // the hand
    },
    leg(v, s) {
      put(v, s * 0.7, 1.45, 0, 1.5, 1.95, 1.72, '#f4f2ea');
      // the dark wraps round the shins and the shoes
      for (const y of [0.95, 0.62]) put(v, s * 0.7, y, 0, 1.54, 0.16, 1.76, '#2e1c14');
      put(v, s * 0.7, 0.24, 0.08, 1.54, 0.5, 1.9, '#1c1410');
    },
  },
};

// ------------------------------------------------------------------ the dragon logo

// A coiled eastern dragon (like the reference): a long scaly body in an S from the tail at the
// bottom up to the head at the top right, a row of spines down its back, two clawed legs, and a
// fierce horned head with an open jaw and whiskers. Drawn once per colour on a canvas.
const DRAGON_W = 256, DRAGON_H = 300;
const dragonTextures = new Map();

const cubic = (a, b, c, d, t) => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
// the body's path, tail (t = 0) to neck (t = 1), as three curves
const DRAGON_PATH = [
  [[52, 282], [150, 300], [232, 262], [196, 206]],
  [[196, 206], [160, 150], [36, 186], [44, 128]],
  [[44, 128], [50, 80], [120, 70], [150, 92]],
];

function dragonPoints(n = 160) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, seg = Math.min(2, Math.floor(t * 3)), lt = t * 3 - seg;
    pts.push({ p: cubic(...DRAGON_PATH[seg], lt), t });
  }
  // the side of the body each point's spines stick out of (left of the way it runs)
  pts.forEach((q, i) => {
    const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    q.n = [dy / len, -dx / len];
  });
  return pts;
}

export function dragonTexture({ color, dark, light }) {
  if (dragonTextures.has(color)) return dragonTextures.get(color);
  const c = document.createElement('canvas');
  c.width = DRAGON_W;
  c.height = DRAGON_H;
  const g = c.getContext('2d');
  const pts = dragonPoints();
  const radius = (t) => 4 + 15 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5);
  const dot = (x, y, r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const poly = (list, fill) => {
    g.fillStyle = fill;
    g.strokeStyle = dark;
    g.lineWidth = 4;
    g.lineJoin = 'round';
    g.beginPath();
    list.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
    g.fill();
  };

  // the spines down its back (behind the body)
  for (let i = 6; i < pts.length - 4; i += 7) {
    const { p, n, t } = pts[i];
    const r = radius(t), s = 6 + r * 0.7;
    const ax = p[0] + n[0] * r * 0.6, ay = p[1] + n[1] * r * 0.6;
    const back = pts[Math.max(0, i - 4)].p;
    const dx = (p[0] - back[0]) * 0.6, dy = (p[1] - back[1]) * 0.6;
    poly([[ax - dx, ay - dy], [ax + n[0] * s + dx * 0.4, ay + n[1] * s + dy * 0.4], [ax + dx, ay + dy]], color);
  }
  // two clawed legs
  for (const [k, side] of [[0.38, -1], [0.72, -1]]) {
    const { p, n } = pts[Math.round(k * (pts.length - 1))];
    const r = radius(k);
    const kx = p[0] - n[0] * side * -1 * r * 1.6, ky = p[1] - n[1] * side * -1 * r * 1.6;
    g.strokeStyle = dark; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(kx, ky); g.stroke();
    g.strokeStyle = color; g.lineWidth = 7;
    g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(kx, ky); g.stroke();
    for (let f = -1; f <= 1; f++) {
      const a = Math.atan2(ky - p[1], kx - p[0]) + f * 0.6;
      g.strokeStyle = dark; g.lineWidth = 4;
      g.beginPath(); g.moveTo(kx, ky); g.lineTo(kx + Math.cos(a) * 11, ky + Math.sin(a) * 11); g.stroke();
    }
  }
  // the body: a dark outline, the colour, a lighter stripe of light along it, then scales
  for (const { p, t } of pts) dot(p[0], p[1], radius(t) + 3.5, dark);
  for (const { p, t } of pts) dot(p[0], p[1], radius(t), color);
  for (const { p, n, t } of pts) dot(p[0] + n[0] * radius(t) * 0.35, p[1] + n[1] * radius(t) * 0.35, radius(t) * 0.38, light);
  g.strokeStyle = dark;
  g.lineWidth = 2.2;
  for (let i = 4; i < pts.length - 6; i += 4) {
    const { p, n, t } = pts[i];
    const r = radius(t) * 0.75;
    const back = pts[i - 2].p, a = Math.atan2(p[1] - back[1], p[0] - back[0]);
    g.beginPath();
    g.arc(p[0] - n[0] * r * 0.25, p[1] - n[1] * r * 0.25, r * 0.55, a - 1.1, a + 1.1);
    g.stroke();
  }

  // the head, at the neck (150, 92), looking right and a little up
  g.save();
  g.translate(152, 88);
  g.rotate(-0.25);
  // the mane / back horns, swept back
  poly([[-10, -6], [-46, -40], [-18, -14], [-40, -2], [-12, 4]], color);
  poly([[-4, -14], [-30, -58], [-10, -30], [4, -18]], light);
  // the upper jaw and the snout
  poly([[-14, -16], [18, -22], [56, -14], [70, -6], [64, 2], [34, 2], [6, 6], [-14, 8]], color);
  // the lower jaw, open, with a tooth
  poly([[0, 10], [30, 8], [58, 14], [52, 22], [20, 24], [-6, 20]], color);
  poly([[34, 4], [38, 13], [42, 4]], '#ffffff');
  // nostril, the eye with its brow, the head's highlight
  dot(62, -8, 2.6, dark);
  dot(20, -10, 6, '#ffffff');
  dot(21, -10, 3, dark);
  poly([[6, -18], [34, -24], [28, -16]], dark);
  dot(-2, -4, 6, light);
  // whiskers trailing back
  g.strokeStyle = color;
  g.lineWidth = 3.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(58, 4); g.bezierCurveTo(70, 26, 40, 40, 64, 56);
  g.moveTo(46, -18); g.bezierCurveTo(40, -46, 80, -44, 74, -66);
  g.stroke();
  g.restore();
  // the tail tip: a little flame
  poly([[52, 282], [28, 270], [40, 290], [22, 296], [50, 292]], color);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  dragonTextures.set(color, tex);
  return tex;
}

// Pins the logo flat on the torso: [x, y, z, width, height] in rest-pose model units; a negative z
// puts it on the back, facing backwards.
const _r = new THREE.Matrix4();
function dragonDecal(avatar, dragon, [x, y, z, w, h], part = 'torso', turn = null) {
  const bone = avatar.bones[PART[part].bone];
  const rest = avatar.restInverse[PART[part].bone];
  if (!bone || !rest) return;
  const material = new THREE.MeshLambertMaterial({ map: dragonTexture(dragon), transparent: true, alphaTest: 0.35, depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(rest).multiply(_t.makeTranslation(x, y, z));
  if (turn !== null) mesh.matrix.multiply(_r.makeRotationY(turn));
  else if (z < 0) mesh.matrix.multiply(_r.makeRotationY(Math.PI));
  bone.add(mesh);
}

// ------------------------------------------------------------------ the heavier gear (stage 5 on)

// From the fifth stage on the guardians are dressed for battle: heavy layered shoulder armour edged in
// gold, gold straps crossed over the chest, a wide gold belt with a buckle and armoured flaps hanging
// from it, gold-trimmed shin guards, a dragon running down each sleeve, and (for some) swords crossed
// on the back. h: { gold, dark, plate, swords }
const HEAVY = {
  torso(v, h) {
    // the gold straps crossed over the chest and the back, with a round boss where they cross
    for (const z of h.straps === false ? [-0.93] : [0.93, -0.93]) {
      put(v, 0, 3.8, z, 0.3, 2.7, 0.06, h.gold, { rz: 0.62 });
      put(v, 0, 3.8, z, 0.3, 2.7, 0.06, h.gold, { rz: -0.62 });
      put(v, 0, 3.8, z * 1.02, 0.55, 0.55, 0.08, h.dark);
      put(v, 0, 3.8, z * 1.05, 0.32, 0.32, 0.06, h.gold);
    }
    // a gold collar
    put(v, 0, 4.88, 0, 2.2, 0.26, 1.86, h.gold);
    // the shoulder armour: two layered plates each side, gold edged, with rivets
    for (const s of [-1, 1]) {
      put(v, s * 1.5, 5.0, 0, 1.6, 0.36, 2.06, h.dark);
      put(v, s * 1.62, 4.7, 0, 1.5, 0.34, 2.0, h.plate);
      put(v, s * 1.7, 4.48, 0, 1.4, 0.14, 1.96, h.gold);
      put(v, s * 1.5, 5.2, 0, 1.64, 0.1, 2.1, h.gold);
      for (const z of [-0.6, 0, 0.6]) put(v, s * 1.62, 4.72, z, 0.12, 0.12, 2.04, h.gold);
    }
  },
  waist(v, h) {
    // the wide belt, its buckle and the armoured flaps hanging in front and at the sides
    put(v, 0, 2.55, 0, 3.06, 0.5, 1.86, h.gold);
    put(v, 0, 2.55, 0.95, 0.7, 0.62, 0.1, h.dark);
    put(v, 0, 2.55, 1.0, 0.42, 0.36, 0.06, h.gold);
    for (const [x, z, w, d] of [[-0.75, 0.93, 1.0, 0.08], [0.75, 0.93, 1.0, 0.08], [-1.5, 0, 0.08, 1.4], [1.5, 0, 0.08, 1.4]]) {
      put(v, x, 1.85, z, w, 0.95, d, h.plate);
      put(v, x, 1.38, z, w + 0.04, 0.12, d + 0.04, h.gold);
      put(v, x, 2.28, z, w + 0.04, 0.1, d + 0.04, h.dark);
    }
  },
  arm(v, h, s) {
    // a gold cuff and a gold band at the top of the glove
    put(v, s * 2.0, 3.28, 0, 1.42, 0.18, 1.82, h.gold);
    put(v, s * 2.0, 4.65, 0, 1.4, 0.12, 1.8, h.gold);
  },
  leg(v, h, s) {
    // shin guards with gold edges
    put(v, s * 0.7, 0.95, 0.88, 1.2, 1.0, 0.1, h.plate);
    put(v, s * 0.7, 1.45, 0.9, 1.24, 0.1, 0.12, h.gold);
    put(v, s * 0.7, 0.46, 0.9, 1.24, 0.1, 0.12, h.gold);
  },
  // a katana in its scabbard, slung across the back (on the torso bone)
  sword(v, h, s) {
    const rz = s * 0.75;
    put(v, 0, 3.5, -1.02, 0.32, 3.2, 0.26, h.dark, { rz });            // the scabbard
    for (const k of [-0.9, 0.9]) put(v, -Math.sin(rz) * k, 3.5 + Math.cos(rz) * k, -1.04, 0.38, 0.14, 0.3, h.gold, { rz });
    const ty = 3.5 + Math.cos(rz) * 1.75, tx = -Math.sin(rz) * 1.75;
    put(v, tx, ty, -1.02, 0.5, 0.12, 0.34, h.gold, { rz });              // the guard
    const gy = 3.5 + Math.cos(rz) * 2.3, gx = -Math.sin(rz) * 2.3;
    put(v, gx, gy, -1.02, 0.24, 1.0, 0.22, '#1a1414', { rz });            // the grip, wrapped
    for (const k of [-0.3, 0, 0.3]) put(v, gx - Math.sin(rz) * k, gy + Math.cos(rz) * k, -1.03, 0.27, 0.06, 0.24, h.gold, { rz });
  },
};

// ------------------------------------------------------------------ building one

function partMesh(avatar, part, draw) {
  const bone = avatar.bones[PART[part].bone];
  const rest = avatar.restInverse[PART[part].bone];
  if (!bone || !rest) return null;
  const v = new Voxels();
  draw(v);
  const mesh = new THREE.Mesh(v.geometry(), cloth());
  mesh.matrixAutoUpdate = false;
  mesh.matrix.copy(rest);
  mesh.castShadow = true;
  bone.add(mesh);
  return mesh;
}

// A glowing sword held out in one hand (pointing ahead, like the video's guardians): an unlit blade
// with a bright edge, a guard and a wrapped grip, and a soft glow along the blade.
function heldSword(avatar, b) {
  const part = b.hand > 0 ? 'armL' : 'armR';
  const x = b.hand * 2.0, y = 2.45, L = 4.6;
  const grip = partMesh(avatar, part, (v) => {
    put(v, x, y, 0.35, 0.3, 0.3, 1.1, b.grip);
    put(v, x, y, 0.95, 0.9, 0.22, 0.26, b.edge);
  });
  if (!grip) return;
  const v = new Voxels();
  put(v, x, y, 1.1 + L / 2, 0.16, 0.5, L, b.color);
  put(v, x, y + 0.27, 1.1 + L / 2, 0.18, 0.08, L, b.edge);
  put(v, x, y, 1.1 + L + 0.2, 0.16, 0.3, 0.4, b.color);
  const blade = new THREE.Mesh(v.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  grip.add(blade);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: b.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(2.2, 2.2, 1);
    s.position.set(x, y, 1.6 + i * 1.5);
    grip.add(s);
  }
}

// A spirit light round one fist: a glowing gem of light over the glove and a big soft glow.
function spiritFist(avatar, f) {
  const x = f.hand * 2.0, y = 2.5;
  const mesh = partMesh(avatar, f.hand > 0 ? 'armL' : 'armR', (w) => put(w, x, 3.1, 0, 1.42, 0.16, 1.82, f.color));
  if (!mesh) return;
  const v = new Voxels();
  put(v, x, y, 0.1, 1.7, 1.2, 1.9, f.color);
  put(v, x, y, 0.1, 1.3, 1.6, 1.5, f.color, { ry: Math.PI / 4 });
  const gem = new THREE.Mesh(v.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }));
  mesh.add(gem);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: f.glow, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(4.5);
  s.position.set(x, y, 0.1);
  mesh.add(s);
}

function dress(avatar, type, eyes) {
  const o = OUTFITS[type];
  if (!o || avatar.fallback) return; // the offline box rig: no clothes
  partMesh(avatar, 'head', (v) => o.head(v));
  const h = o.heavy; // stage 5 on: the heavier battle gear (HEAVY)
  partMesh(avatar, 'torso', (v) => {
    o.torso(v);
    if (!h) return;
    HEAVY.torso(v, h);
    for (let i = 0; i < (h.swords || 0); i++) HEAVY.sword(v, h, i ? -1 : 1);
  });
  partMesh(avatar, 'waist', (v) => { o.waist(v); if (h) HEAVY.waist(v, h); });
  partMesh(avatar, 'armL', (v) => { o.arm(v, 1); if (h) HEAVY.arm(v, h, 1); });
  partMesh(avatar, 'armR', (v) => { o.arm(v, -1); if (h) HEAVY.arm(v, h, -1); });
  partMesh(avatar, 'legL', (v) => { o.leg(v, 1); if (h) HEAVY.leg(v, h, 1); });
  partMesh(avatar, 'legR', (v) => { o.leg(v, -1); if (h) HEAVY.leg(v, h, -1); });
  if (o.dragon) {
    for (const at of [o.dragon.front, o.dragon.back]) if (at) dragonDecal(avatar, o.dragon, at);
    // a dragon running down the outside of each sleeve
    if (o.dragon.sleeves) {
      dragonDecal(avatar, o.dragon, [2.0 + 0.69, 3.8, 0, 1.5, 1.7], 'armL', Math.PI / 2);
      dragonDecal(avatar, o.dragon, [-2.0 - 0.69, 3.8, 0, 1.5, 1.7], 'armR', -Math.PI / 2);
    }
  }
  if (o.blade) heldSword(avatar, o.blade);
  if (o.fist) spiritFist(avatar, o.fist);
  // the eyes: one small box each, squashed to a line while shut (glowing ones light up and shine)
  const head = avatar.bones.Neck1, rest = avatar.restInverse.Neck1;
  if (!head || !rest) return;
  const geometry = new Voxels().box(0, -0.15, 0, o.glowEyes ? 0.36 : 0.24, o.glowEyes ? 0.24 : 0.3, 0.08, o.eyeColor).geometry();
  const eyeMaterial = o.glowEyes ? new THREE.MeshBasicMaterial({ vertexColors: true }) : cloth();
  for (const [x, y, z] of o.eyes) {
    const eye = new THREE.Mesh(geometry, eyeMaterial);
    if (o.glowEyes) {
      const shine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: o.glowEyes, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      shine.scale.setScalar(1.1);
      shine.position.set(0, -0.05, 0.1);
      eye.add(shine);
    }
    eye.matrixAutoUpdate = false;
    eye.userData.rest = rest;
    eye.userData.at = new THREE.Vector3(x, y, z);
    head.add(eye);
    eyes.push(eye);
  }
}

const _t = new THREE.Matrix4();
const _s = new THREE.Matrix4();

// A dressed guardian: { root, height, update(pose) } like a horror (see Guardians.js).
export function buildNinjaGuardian(type) {
  const avatar = new BloxityAvatar({});
  const eyes = [];
  avatar.ready.then(() => dress(avatar, type, eyes)).catch(() => {});
  let open = 1;
  return {
    root: avatar.root,
    avatar,
    height: (HEIGHT[type] || 6.6) * avatar.inner.scale.y,
    // pose: { dt, open (0 shut .. 1), awake, run (0/1), speed, roar (0..1) }
    update({ dt = 1 / 60, open: eyeOpen = 1, run = 0, speed = 0, roar = 0 }) {
      // a fright when it wakes: both arms thrown up; then it runs after you like a player
      avatar.anim = roar > 0.35 ? 'jump' : run ? 'run' : 'idle';
      avatar.speed = speed;
      avatar.update(dt);
      if (Math.abs(eyeOpen - open) > 0.01 || eyes.some((e) => !e.userData.placed)) {
        open = eyeOpen;
        for (const e of eyes) {
          const { x, y, z } = e.userData.at;
          e.matrix.copy(e.userData.rest).multiply(_t.makeTranslation(x, y, z)).multiply(_s.makeScale(1, Math.max(0.14, open), 1));
          e.userData.placed = true;
        }
      }
    },
  };
}
