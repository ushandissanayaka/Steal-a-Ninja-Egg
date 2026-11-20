// The ninjas that hatch out of the first six stages' eggs (like the video): three different ones per
// stage, each in its stage's colours. Some have their faces covered, some show their faces, some wear
// a long hooded robe that covers them from the head down. From the second stage on they carry a karate
// weapon (a long staff, a sword or nunchaku) and have a power round them (smoke, sparks of lightning),
// and every stage's ninjas are bigger than the last (the first a little bigger than a player).
//
// About every four seconds each one turns into a whirlwind of its stage's colours and whirls about
// the pen for a moment, then turns back into a ninja.
//
// They are light block figures (not full avatars): a body, and arms and legs on pivots that swing as
// they walk, each part one mesh with a geometry shared by every ninja of that kind. Their powers show
// in full only when FX.fancy (a smooth frame rate and a good connection).

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { glowMap } from './Effects.js';
import { FX, Tornado } from './Tornado.js';

const SKIN = '#f2c94c';

// The stages' colours: gi, dark, trim, accent; glow: the power's colour; power: what it is
const STAGES = [
  { gi: '#7a4a2a', dark: '#4a2a1a', trim: '#ffc21f', accent: '#f2c94c', glow: '#ffb02a', power: null },
  { gi: '#2f9a3a', dark: '#1e5a24', trim: '#f4f2ea', accent: '#c81e2a', glow: '#6aff5a', power: 'smoke' },
  { gi: '#d6202e', dark: '#7a0e18', trim: '#ff8a1a', accent: '#16120e', glow: '#ff5a1a', power: 'smoke' },
  { gi: '#2a56c8', dark: '#1a2c6a', trim: '#ffd84a', accent: '#7fe8ff', glow: '#7fe8ff', power: 'thunder' },
  { gi: '#262b48', dark: '#16161c', trim: '#e0b040', accent: '#a08460', glow: '#ffcf3a', power: 'smoke' },
  { gi: '#2fae3a', dark: '#1e7a28', trim: '#ffd84a', accent: '#d8ff3a', glow: '#b8ff4a', power: 'thunder' },
  { gi: '#dce8f6', dark: '#1a2440', trim: '#7fd8ff', accent: '#ffffff', glow: '#bff0ff', power: 'smoke' },
  { gi: '#3ab0e0', dark: '#0e2a6a', trim: '#bff4ff', accent: '#ffd84a', glow: '#7fe8ff', power: 'smoke' },
  { gi: '#2a9a4a', dark: '#0c2a1a', trim: '#7dffb0', accent: '#ffe23a', glow: '#5aff9a', power: 'smoke' },
  { gi: '#26222e', dark: '#0e0a14', trim: '#ff3ad8', accent: '#e8e0f0', glow: '#ff4ae0', power: 'thunder' },
];

// Each stage's three pets (their ids are the old pet ids, so saves keep them): [stage, look, weapon,
// female]. From the fifth stage on every stage has one female ninja (a kunoichi).
export const NINJA_PETS = {
  pumpkinCamel: [0, 'face', null], sheetGhost: [0, 'mask', null], scarecrowCat: [0, 'hood', null],
  gummyBat: [1, 'face', 'staff'], lollipopLlama: [1, 'mask', 'sword'], candyCornCrab: [1, 'hood', 'nunchaku'],
  boneDog: [2, 'mask', 'sword'], zombieBunny: [2, 'hood', 'staff'], tombBat: [2, 'face', 'nunchaku'],
  bogFrog: [3, 'mask', 'nunchaku'], slimeSnail: [3, 'hood', 'staff'], rainbowToad: [3, 'face', 'sword'],
  popcornPup: [4, 'face', 'nunchaku', true], clownFish: [4, 'mask', 'staff'], circusElephant: [4, 'hood', 'sword'],
  snowWisp: [5, 'mask', 'sword', true], icicleSwordfish: [5, 'hood', 'staff'], frostbiteBear: [5, 'face', 'nunchaku'],
  candleGhost: [6, 'mask', 'sword'], phantomCat: [6, 'face', 'staff', true], ghostPrince: [6, 'hood', 'nunchaku'],
  hellPup: [7, 'face', 'nunchaku'], magmaImp: [7, 'mask', 'sword', true], demonCalf: [7, 'hood', 'staff'],
  voidEye: [8, 'mask', 'sword'], starEater: [8, 'face', 'nunchaku', true], goldenAbomination: [8, 'hood', 'staff'],
  spikePuffer: [9, 'mask', 'sword'], nightmareRaven: [9, 'face', 'sword', true], shadowShark: [9, 'hood', 'staff'],
};
export const isNinjaPet = (id) => !!NINJA_PETS[id];

// how tall (pen units: the pen is drawn 1.5x, a player is about 3.4 of them): every ninja the same
// size, from whichever stage, a good bit taller than a player
const heightOf = () => 4.6;
// they turn into a whirlwind 3 seconds after they hatch, and then every SPIN_EVERY seconds, each on
// its own clock (counted from its own hatching), for SPIN_FOR seconds
const SPIN_FIRST = 3, SPIN_FOR = 1.3, SPIN_EVERY = SPIN_FIRST + SPIN_FOR;
const MODEL_H = 6.4; // the figure is built in avatar units (feet 0, top of the head 6.4)

// A box by its middle.
const put = (v, x, y, z, w, h, d, color, opts) => v.box(x, y - h / 2, z, w, h, d, color, opts);

// ------------------------------------------------------------------ building the parts

// A kunoichi's hair: long and dark, down her back and at the sides, with a band of the trim colour.
function femaleHair(v, c, look) {
  const HAIR = '#3a1e14';
  if (look === 'mask') {
    // a long ponytail out of the back of the hood
    put(v, 0, 6.0, -0.98, 0.5, 0.4, 0.3, c.trim);
    put(v, 0, 5.0, -1.1, 0.55, 1.8, 0.35, HAIR, { rx: 0.15 });
    put(v, 0, 3.9, -1.22, 0.42, 0.8, 0.3, HAIR, { rx: 0.25 });
    return;
  }
  put(v, 0, 6.4, -0.05, 1.8, 0.45, 1.8, HAIR);
  put(v, -0.25, 6.1, 0.8, 1.2, 0.32, 0.18, HAIR, { rz: 0.2 });
  for (const sd of [-1, 1]) put(v, sd * 0.88, 5.25, -0.15, 0.24, 1.9, 1.2, HAIR);
  put(v, 0, 4.6, -0.9, 1.75, 2.9, 0.28, HAIR);
  put(v, 0, 6.05, 0, 1.7, 0.18, 1.7, c.trim);
}

function buildBody(v, c, look, female = false) {
  if (female) {
    // a sash tied in a bow at her side and the gi flaring a little over the hips
    put(v, 0, 2.2, 0, 3.0, 0.7, 1.66, c.gi);
    put(v, 1.1, 2.55, 0.8, 0.5, 0.4, 0.12, c.trim);
    put(v, 1.25, 2.2, 0.82, 0.22, 0.6, 0.08, c.trim, { rz: -0.3 });
  }
  // the torso: the gi, a belt, the jacket's crossing lapels
  put(v, 0, 3.6, 0, 2.8, 2.4, 1.5, c.gi);
  put(v, 0, 2.55, 0, 2.86, 0.36, 1.56, look === 'hood' ? c.trim : c.dark);
  put(v, -0.4, 4.1, 0.78, 0.3, 1.4, 0.06, c.trim, { rz: -0.5 });
  put(v, 0.4, 4.1, 0.78, 0.3, 1.4, 0.06, c.trim, { rz: 0.5 });
  if (look === 'hood') {
    // the long robe, down over the hips, and a big hood with a dark opening and two glowing eyes
    put(v, 0, 2.9, 0, 3.0, 3.6, 1.7, c.gi);
    put(v, 0, 1.4, 0, 3.1, 1.2, 1.8, c.dark);
    put(v, 0, 5.7, -0.05, 1.9, 1.9, 1.9, c.gi);
    put(v, 0, 6.7, -0.2, 1.3, 0.3, 1.3, c.gi);
    put(v, 0, 5.55, 0.8, 1.3, 1.1, 0.4, '#141418');
    for (const s of [-1, 1]) put(v, s * 0.32, 5.6, 1.0, 0.28, 0.16, 0.06, c.glow ?? '#ffffff');
    return;
  }
  // the head
  put(v, 0, 5.6, 0, 1.6, 1.6, 1.6, SKIN);
  if (look === 'mask') {
    // a hood and a mask round a slit for the eyes
    put(v, 0, 6.2, 0, 1.7, 0.5, 1.7, c.gi);
    put(v, 0, 5.05, 0, 1.7, 0.6, 1.7, c.gi);
    put(v, 0, 5.62, -0.15, 1.7, 0.66, 1.4, c.gi);
    put(v, 0, 6.42, 0.1, 1.1, 0.12, 1.4, c.trim);
    for (const s of [-1, 1]) put(v, s * 0.33, 5.64, 0.82, 0.22, 0.28, 0.05, '#14100c');
    if (female) {
      for (const s of [-1, 1]) put(v, s * 0.42, 5.84, 0.83, 0.3, 0.07, 0.05, '#14100c', { rz: s * 0.4 }); // lashes
      femaleHair(v, c, look);
    }
  } else if (female) {
    // her face: big eyes with lashes, rosy cheeks and pink lips, under her long hair
    for (const s of [-1, 1]) {
      put(v, s * 0.33, 5.6, 0.81, 0.22, 0.3, 0.05, '#14100c');
      put(v, s * 0.42, 5.82, 0.82, 0.3, 0.07, 0.05, '#14100c', { rz: s * 0.4 });
      put(v, s * 0.55, 5.3, 0.81, 0.24, 0.12, 0.04, '#ff9a9a');
    }
    put(v, 0, 5.18, 0.81, 0.34, 0.1, 0.05, '#e0506a');
    femaleHair(v, c, look);
  } else {
    // a face with eyes, brows and a smile, a band of the trim colour, dark hair on top
    put(v, 0, 6.32, 0, 1.68, 0.36, 1.68, '#2a1a10');
    put(v, 0, 6.02, 0, 1.66, 0.22, 1.66, c.trim);
    put(v, 0.75, 6.0, -0.75, 0.3, 0.7, 0.12, c.trim, { rz: -0.3 });
    for (const s of [-1, 1]) {
      put(v, s * 0.33, 5.6, 0.81, 0.2, 0.26, 0.05, '#14100c');
      put(v, s * 0.36, 5.85, 0.81, 0.4, 0.09, 0.05, '#2a1a10', { rz: s * 0.25 });
    }
    put(v, 0, 5.2, 0.81, 0.5, 0.08, 0.05, '#7a3a1e');
  }
}

function buildArm(v, c, look) {
  // hangs down from the shoulder pivot (0): a sleeve, a cuff, a hand
  put(v, 0, -0.9, 0, 1.2, 1.9, 1.3, c.gi);
  put(v, 0, -1.9, 0, 1.24, 0.2, 1.34, look === 'hood' ? c.dark : c.trim);
  put(v, 0, -2.2, 0.05, 1.0, 0.45, 1.0, look === 'mask' ? c.dark : SKIN);
}

function buildLeg(v, c, look) {
  put(v, 0, -1.0, 0, 1.36, 2.0, 1.4, look === 'hood' ? c.dark : c.dark);
  put(v, 0, -2.15, 0.08, 1.4, 0.5, 1.6, '#16120e');
}

function buildWeapon(v, kind) {
  // held in the right hand (the pivot is at the hand), pointing up and a little forward
  if (kind === 'staff') {
    put(v, 0, 0, 0.4, 0.3, 7.5, 0.3, '#8a5530');
    for (const y of [-3.6, 3.6]) put(v, 0, y, 0.4, 0.4, 0.5, 0.4, '#3a2414');
  } else if (kind === 'sword') {
    put(v, 0, 0.3, 0.4, 0.5, 0.9, 0.5, '#2a1a14');      // the grip
    put(v, 0, 0.85, 0.4, 0.9, 0.18, 0.9, '#ffcc33');   // the guard
    put(v, 0, 2.6, 0.4, 0.22, 3.4, 0.5, '#d8e0ea');    // the blade
    put(v, 0, 4.35, 0.4, 0.16, 0.3, 0.3, '#d8e0ea', { rx: 0.6 });
  } else if (kind === 'nunchaku') {
    put(v, 0, 0.6, 0.4, 0.32, 1.6, 0.32, '#3a2414');
    put(v, 0, 1.5, 0.4, 0.08, 0.5, 0.08, '#9aa0aa');
    put(v, 0.5, 2.3, 0.4, 0.32, 1.6, 0.32, '#3a2414', { rz: -0.5 });
  }
}

// one geometry per kind of part per pet, shared by every ninja of that kind
const parts = new Map();
function partGeometry(key, build) {
  if (!parts.has(key)) {
    const v = new Voxels();
    build(v);
    parts.set(key, v.geometry());
  }
  return parts.get(key);
}

let material = null;
const ninjaMaterial = () => (material ??= new THREE.MeshLambertMaterial({ vertexColors: true }));

// ------------------------------------------------------------------ one ninja

class NinjaFigure {
  constructor(id) {
    const [stage, look, weapon, female] = NINJA_PETS[id];
    this.stage = stage;
    this.weapon = weapon;
    this.female = !!female;
    this.c = { ...STAGES[stage] };
    const c = this.c;
    this.root = new THREE.Group();
    this.root.userData.ninja = this;
    this.root.userData.sharedGeometry = true;
    this.figure = new THREE.Group();
    this.figure.scale.setScalar(heightOf(stage) / MODEL_H);
    this.root.add(this.figure);
    const mesh = (geo) => {
      const m = new THREE.Mesh(geo, ninjaMaterial());
      m.castShadow = true;
      return m;
    };
    this.figure.add(mesh(partGeometry(`${id}:body`, (v) => buildBody(v, c, look, !!female))));
    const pivot = (x, y, geo) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      p.add(mesh(geo));
      this.figure.add(p);
      return p;
    };
    const arm = partGeometry(`${id}:arm`, (v) => buildArm(v, c, look));
    const leg = partGeometry(`${id}:leg`, (v) => buildLeg(v, c, look));
    this.armL = pivot(2.0, 4.7, arm);
    this.armR = pivot(-2.0, 4.7, arm);
    this.legL = pivot(0.7, 2.4, leg);
    this.legR = pivot(-0.7, 2.4, leg);
    if (weapon) {
      const w = mesh(partGeometry(`weapon:${weapon}`, (v) => buildWeapon(v, weapon)));
      w.position.set(0, -2.3, 0.2);
      w.rotation.x = 0.35;
      this.armR.add(w);
    }
    this.height = heightOf(stage);
    this.t = Math.random() * 10;
    this.age = 0; // seconds since it hatched (its own spin clock; see setAge)
    this.fighting = false;
  }

  // The power round it (from the second stage on), made the first time it is seen.
  buildPower() {
    this.powerBuilt = true;
    const { glow, power } = this.c;
    const h = this.height;
    const sprite = (color, size, opacity = 1) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(size);
      this.root.add(s);
      return s;
    };
    if (!power) return;
    this.halo = sprite(glow, h * 1.2, 0.35);
    this.halo.position.y = h * 0.5;
    if (power === 'smoke') {
      // soft puffs rising round it (normal blending, so they read as smoke)
      this.puffs = Array.from({ length: 5 }, (_, i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: i % 2 ? glow : '#c8c8d0', transparent: true, opacity: 0, depthWrite: false }));
        this.root.add(s);
        return { s, t: i / 5, a: Math.random() * Math.PI * 2 };
      });
    } else {
      // short bolts of lightning flicking out from its body
      this.bolts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({
        color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }), 3 * 4);
      this.bolts.frustumCulled = false;
      this.root.add(this.bolts);
      this.boltT = 0;
    }
  }

  updatePower(dt) {
    const fancy = FX.fancy;
    if (this.halo) this.halo.material.opacity = (fancy ? 0.4 : 0.25) * (0.85 + Math.sin(this.t * 4) * 0.15) * (1 - this.whirlK);
    const h = this.height;
    if (this.puffs) {
      for (const p of this.puffs) {
        p.s.visible = fancy;
        if (!fancy) continue;
        p.t = (p.t + dt * 0.5) % 1;
        p.s.position.set(Math.cos(p.a) * h * 0.25, h * (0.1 + p.t * 0.9), Math.sin(p.a) * h * 0.25);
        p.s.scale.setScalar(h * (0.25 + p.t * 0.35));
        p.s.material.opacity = Math.sin(p.t * Math.PI) * 0.45 * (1 - this.whirlK);
      }
    }
    if (this.bolts) {
      this.bolts.visible = fancy && this.whirlK < 0.5;
      if (!this.bolts.visible) return;
      this.boltT -= dt;
      if (this.boltT > 0) return;
      this.boltT = 0.08 + Math.random() * 0.1;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      let n = 0;
      for (let b = 0; b < 3; b++) {
        const on = Math.random() < 0.6;
        const a = new THREE.Vector3((Math.random() - 0.5) * h * 0.5, h * (0.3 + Math.random() * 0.5), (Math.random() - 0.5) * h * 0.5);
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
        for (let k = 0; k < 4; k++) {
          const next = a.clone().addScaledVector(dir, h * 0.1).add(new THREE.Vector3((Math.random() - 0.5) * h * 0.08, (Math.random() - 0.5) * h * 0.08, (Math.random() - 0.5) * h * 0.08));
          q.setFromUnitVectors(up, next.clone().sub(a).normalize());
          s.set(on ? h * 0.025 : 0, on ? a.distanceTo(next) : 0, on ? h * 0.025 : 0);
          this.bolts.setMatrixAt(n++, m.compose(a.clone().add(next).multiplyScalar(0.5), q, s));
          a.copy(next);
        }
      }
      this.bolts.instanceMatrix.needsUpdate = true;
    }
  }

  // Is it a whirlwind right now? Counts down to its next spin and through the spin.
  updateSpin(dt) {
    this.age += dt;
    // a whirlwind for SPIN_FOR seconds every SPIN_EVERY, its first one SPIN_FIRST seconds after it
    // hatched; not while it is in a fight
    const on = !this.fighting && this.age % SPIN_EVERY >= SPIN_FIRST;
    if (on && !this.tornado) {
      const c = this.c;
      this.tornado = new Tornado(this.height * 1.25, { colors: [c.gi, c.trim, '#ffffff', c.accent], glow: c.glow, sparks: false });
      this.root.add(this.tornado.root);
    }
    if (this.tornado) this.tornado.update(dt, on);
    this.whirlK = this.tornado?.k || 0;
    this.figure.visible = this.whirlK < 0.85;
    this.figure.scale.setScalar((this.height / MODEL_H) * Math.max(0.01, 1 - this.whirlK));
    return on;
  }

  // walk: 0 standing .. 1 walking; step: the stride's phase
  pose(walk, step) {
    const s = Math.sin(step) * 0.8 * walk;
    this.armL.rotation.z = this.armR.rotation.z = 0; // (a fight pose may have left them out)
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    this.armL.rotation.x = -s * 0.9;
    this.armR.rotation.x = s * 0.6 - 0.25; // the weapon hand a little forward
    this.figure.position.y = Math.abs(Math.sin(step)) * 0.12 * walk * (this.height / MODEL_H);
  }

  // A fighting move, t (0..1) through it: 'punch' (the weapon arm thrust forward), 'kick' (a leg up
  // high), 'jump' (a leap with a flying kick), 'block' (arms up).
  fightPose(kind, t) {
    const s = Math.sin(t * Math.PI);
    this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0); this.armR.rotation.set(0, 0, 0);
    this.figure.position.y = 0;
    if (kind === 'punch') {
      this.armR.rotation.x = -1.6 * s - 0.3;
      this.armL.rotation.x = -0.9;
      this.legL.rotation.x = -0.35; this.legR.rotation.x = 0.3;
    } else if (kind === 'kick') {
      this.legR.rotation.x = -1.7 * s;
      this.armL.rotation.x = -0.8; this.armR.rotation.x = -0.6;
      this.armL.rotation.z = 0.5 * s; this.armR.rotation.z = -0.5 * s;
    } else if (kind === 'jump') {
      this.figure.position.y = s * 2.4;
      this.legR.rotation.x = -1.4 * s; this.legL.rotation.x = 0.6 * s;
      this.armL.rotation.x = -2.4 * s; this.armR.rotation.x = -2.4 * s;
    } else {
      this.armL.rotation.x = -1.9; this.armR.rotation.x = -1.9;
      this.armL.rotation.z = -0.4; this.armR.rotation.z = 0.4;
      this.legL.rotation.x = -0.3; this.legR.rotation.x = 0.3;
    }
  }

  // a ninja just hatched starts its clock at 0; ones already in the pen when you come get a random
  // place in theirs, so they never all spin together
  setAge(a) { this.age = a; }

  update(dt) {
    this.t += dt;
    if (!this.powerBuilt) this.buildPower();
    const spinning = this.updateSpin(dt);
    this.updatePower(dt);
    return spinning;
  }
}

export function buildNinjaPet(id) {
  return new NinjaFigure(id).root;
}
