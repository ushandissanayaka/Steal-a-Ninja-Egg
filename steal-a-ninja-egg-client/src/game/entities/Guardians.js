// The guardians: one per biome (a wolf in the first, ghosts, aliens and other entities after). Each one
// sleeps standing up beside its nest, head nodding, with "Z"s floating up.
// Steal an egg and it wakes ("!"), gets up and charges ("!!" and an angry face) until you are back
// over the red line. A bat hit dazes it for a moment (spinning stars).

import * as THREE from 'three';
import { BIOMES, GUARDIANS } from '../../shared/gameData.js';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI } from '../util/canvasText.js';
import { Voxels } from '../util/bake.js';
import { voxelMaterial } from '../util/materials.js';
import { CREATURE_BUILDERS } from './Creatures.js';
import { HORRORS, buildHorror } from './Horrors.js';

const _viewer = new THREE.Vector3();

const GUARDIAN_SIZE = 1.2;   // drawn this much bigger (taller) than their gameData scale
const EYE_SPEED = 16;        // how fast the eyes open and shut
const ROAR_SECONDS = 1.5;    // the roar after it wakes, before it charges (the server waits GUARD.alertMs)
const LUNGE_SECONDS = 0.42;  // a leap at the player (the server's lunge)
const LID = '#17181c';       // the line a shut eye leaves, unless the guardian gives its own colour

// A guardian's model with its eyes as separate pieces (see eyeOf in Creatures.js): the body in one
// geometry and, for each eye, its boxes around the eye's middle (so it can be squashed shut) and the
// line it shows while shut. Shared by every view of that guardian.
const guardianParts = new Map();
function guardianGeometry(type) {
  if (!guardianParts.has(type)) {
    const body = new Voxels();
    const eyes = [];
    body.eye = (opts = {}) => {
      const e = { opts, boxes: [], box(...args) { this.boxes.push(args); return this; } };
      eyes.push(e);
      return e;
    };
    CREATURE_BUILDERS[type](body);
    delete body.eye;
    const parts = eyes.map(({ opts, boxes }) => {
      const [x, y, z, w, h, d, , o = {}] = boxes[0];
      const cy = y + h / 2;
      const open = new Voxels();
      for (const [bx, by, bz, ...rest] of boxes) open.box(bx - x, by - cy, bz - z, ...rest);
      const lidH = Math.max(0.08, Math.min(w, h) * 0.16);
      const rz = Math.abs(o.rz || 0) < 0.6 ? o.rz || 0 : 0; // follows a tilted eye, not an X
      // a little deeper than the eye, so it shows whichever way the eye faces
      const shut = new Voxels().box(0, -lidH / 2, 0, opts.lid ?? w * 1.05, lidH, d + 0.06, opts.lidColor || LID, { rz });
      return { at: new THREE.Vector3(x, cy, z), open: open.geometry(), shut: shut.geometry() };
    });
    guardianParts.set(type, { body: body.geometry(), eyes: parts });
  }
  return guardianParts.get(type);
}

function voxelMesh(geometry) {
  const m = new THREE.Mesh(geometry, voxelMaterial());
  m.castShadow = true;
  m.userData.shared = true;
  return m;
}

const TITLE_OF = Object.fromEntries(BIOMES.map((b) => [b.guardian, `GUARDIAN OF THE ${b.name.toUpperCase()}`]));
const NAME_NEAR = 90;        // the name plate shows within this distance of the player
const NAME_HEIGHT = 3.6;     // world units
const MOOD_HEIGHT = 4.4;
const WAKE_SECONDS = 0.45;   // getting up from lying down

function drawFace(g, cx, cy, r, color, kind) {
  g.fillStyle = color;
  g.strokeStyle = '#2a1608';
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#2a1608';
  const eyeY = cy - r * 0.18;
  g.lineCap = 'round';
  if (kind === 'dizzy') {
    g.lineWidth = r * 0.1;
    g.beginPath();
    for (const side of [-1, 1]) {
      const ex = cx + side * r * 0.36, k = r * 0.14;
      g.moveTo(ex - k, eyeY - k); g.lineTo(ex + k, eyeY + k);
      g.moveTo(ex + k, eyeY - k); g.lineTo(ex - k, eyeY + k);
    }
    g.stroke();
  } else {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + side * r * 0.36, eyeY, r * 0.11, r * 0.17, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.lineWidth = r * 0.1;
  g.beginPath();
  if (kind === 'angry') {
    for (const side of [-1, 1]) {
      g.moveTo(cx + side * r * 0.6, eyeY - r * 0.42);
      g.lineTo(cx + side * r * 0.15, eyeY - r * 0.2);
    }
    g.moveTo(cx - r * 0.38, cy + r * 0.52);
    g.quadraticCurveTo(cx, cy + r * 0.2, cx + r * 0.38, cy + r * 0.52);
  } else {
    g.moveTo(cx - r * 0.3, cy + r * 0.45);
    g.quadraticCurveTo(cx, cy + r * 0.25, cx + r * 0.3, cy + r * 0.45);
  }
  g.stroke();
}

function sprite(canvas, height) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(canvas), transparent: true, depthWrite: false }));
  s.scale.set(height * (canvas.width / canvas.height), height, 1);
  s.renderOrder = 6;
  return s;
}

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// "GRINHOUND" over "GUARDIAN OF THE PUMPKIN PATCH", like the video.
const nameTextures = new Map();
function namePlate(type) {
  if (!nameTextures.has(type)) {
    const c = canvasOf(1024, 260);
    const g = c.getContext('2d');
    drawOutlinedText(g, GUARDIANS[type].name.toUpperCase(), 512, 100, { size: 118, fill: '#ffffff', stroke: '#14141a', strokeWidth: 18, font: FONT_TITLE, weight: 400 });
    drawOutlinedText(g, TITLE_OF[type] || '', 512, 210, { size: 46, fill: '#7dff3f', stroke: '#14141a', strokeWidth: 10, font: FONT_UI, weight: 800 });
    nameTextures.set(type, c);
  }
  const s = sprite(nameTextures.get(type), NAME_HEIGHT);
  s.userData.shared = true;
  return s;
}

let zCanvas = null;
function zSprite() {
  if (!zCanvas) {
    zCanvas = canvasOf(256, 256); // sharp even when drawn big
    drawOutlinedText(zCanvas.getContext('2d'), 'Z', 128, 140, { size: 220, fill: '#3fe0e8', stroke: '#14141a', strokeWidth: 22, font: FONT_TITLE, weight: 400 });
  }
  const s = sprite(zCanvas, 1.8);
  s.userData.shared = true;
  return s;
}

function moodSprite(mood) {
  const c = canvasOf(256, 256);
  const g = c.getContext('2d');
  if (mood === 'alert') {
    drawOutlinedText(g, '!', 128, 120, { size: 200, fill: '#ffd21f', stroke: '#2a1608', strokeWidth: 16, font: FONT_UI });
  } else if (mood === 'chase') {
    drawFace(g, 128, 96, 70, '#ff3b3b', 'angry');
    drawOutlinedText(g, '!!', 128, 210, { size: 76, fill: '#ff3b3b', stroke: '#2a1608', strokeWidth: 8, font: FONT_UI });
  } else {
    drawFace(g, 128, 96, 70, '#ffd21f', 'dizzy');
    drawOutlinedText(g, 'BONK!', 128, 212, { size: 54, fill: '#ffffff', stroke: '#2a1608', strokeWidth: 7, font: FONT_UI });
  }
  return sprite(c, MOOD_HEIGHT);
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class GuardianView {
  static smoothing = 10;
  static viewer = null; // the local player's position (set by Game), for showing the name plate

  constructor(state, scene) {
    const def = GUARDIANS[state.type];
    this.type = state.type;
    this.float = !!def.float; // ghosts and glitches hover instead of running
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    if (HORRORS.has(state.type)) {
      // from the second biome on: a realistic horror (its own eyes, jaw and limbs, see Horrors.js)
      this.model = buildHorror(state.type);
      this.mesh = this.model.root;
      this.eyes = [];
    } else {
      const parts = guardianGeometry(state.type);
      this.mesh = voxelMesh(parts.body);
      this.eyes = parts.eyes.map((p) => {
        const open = voxelMesh(p.open);
        const shut = voxelMesh(p.shut);
        open.position.copy(p.at);
        shut.position.copy(p.at);
        this.mesh.add(open, shut);
        return { open, shut };
      });
    }
    this.mesh.scale.setScalar(def.scale * GUARDIAN_SIZE);
    this.body.add(this.mesh);
    this.root.add(this.body);
    const box = new THREE.Box3().setFromObject(this.mesh);
    this.height = box.max.y;
    this.root.position.set(state.x, 0, state.z);
    this.root.rotation.y = state.ry;
    this.target = new THREE.Vector3(state.x, 0, state.z);
    this.targetRy = state.ry;
    this.t = Math.random() * 10;
    this.speed = 0;
    this.lie = state.mood === 'sleep' ? 1 : 0; // 1 = asleep (standing, head nodding), 0 = awake
    this.eyeOpen = 1 - this.lie;
    this.mood = state.mood;
    this.roarT = ROAR_SECONDS; // how far into its roar it is (ROAR_SECONDS = not roaring)
    this.lungeT = LUNGE_SECONDS;

    this.name = namePlate(state.type);
    this.root.add(this.name);
    this.nameK = 0;
    this.zs = [0, 1, 2].map((i) => {
      const z = zSprite();
      z.userData.phase = i / 3;
      this.root.add(z);
      return z;
    });
    this.moodKey = '';
    scene.add(this.root);
  }

  setState(s) {
    this.target.set(s.x, 0, s.z);
    this.targetRy = s.ry;
    if (s.mood === 'alert' && this.mood !== 'alert') this.roarT = 0; // it has just woken: the roar starts
    this.mood = s.mood;
    const shown = s.mood === 'alert' || s.mood === 'chase' || s.mood === 'stun' ? s.mood : '';
    if (shown !== this.moodKey) {
      this.moodKey = shown;
      if (this.moodLabel) {
        this.root.remove(this.moodLabel);
        this.moodLabel.material.map.dispose();
        this.moodLabel.material.dispose();
        this.moodLabel = null;
      }
      if (shown) {
        this.moodLabel = moodSprite(shown);
        this.root.add(this.moodLabel);
      }
    }
  }

  lungeNow() { this.lungeT = 0; }

  update(dt) {
    const before = this.root.position.clone();
    if (this.root.position.distanceTo(this.target) > 40) this.root.position.copy(this.target);
    else this.root.position.lerp(this.target, 1 - Math.exp(-dt * GuardianView.smoothing));
    this.root.rotation.y = lerpAngle(this.root.rotation.y, this.targetRy, 1 - Math.exp(-dt * GuardianView.smoothing));
    this.speed = dt > 0 ? before.distanceTo(this.root.position) / dt : 0;
    this.t += dt;

    // asleep standing up: slumped a little forward, nodding slowly and breathing; it straightens up when it wakes
    const asleep = this.mood === 'sleep';
    this.lie += ((asleep ? 1 : 0) - this.lie) * Math.min(1, dt / WAKE_SECONDS * 3);
    const breathe = asleep ? Math.sin(this.t * 1.6) * 0.03 : 0;
    // the roar: it rears back, swells up, jaw wide, shaking; then it drops forward into the charge
    this.roarT = Math.min(ROAR_SECONDS, this.roarT + dt);
    const roar = this.mood === 'alert' ? Math.sin((this.roarT / ROAR_SECONDS) * Math.PI) : 0;
    this.lungeT = Math.min(LUNGE_SECONDS, this.lungeT + dt);
    const lunge = Math.sin((this.lungeT / LUNGE_SECONDS) * Math.PI);
    const swell = roar * 0.12;
    this.body.scale.set(1 + swell, 1 + breathe + swell, 1 + breathe + swell);

    // eyes shut while it sleeps; they snap open the moment an egg is stolen (and blink now and then
    // while it is awake)
    const blink = !asleep && this.t % 3.7 < 0.13;
    const eyeTarget = asleep || blink ? 0 : 1;
    this.eyeOpen += (eyeTarget - this.eyeOpen) * Math.min(1, dt * EYE_SPEED);
    for (const e of this.eyes) {
      e.open.visible = this.eyeOpen > 0.04;
      e.open.scale.y = Math.max(0.04, this.eyeOpen);
      e.shut.visible = this.eyeOpen < 0.5;
    }

    // a heavy galloping run while it chases, a wobble while dazed
    const run = !asleep && this.speed > 0.5;
    const hop = this.float
      ? 0.35 + (1 - this.lie) * 0.55 + Math.sin(this.t * (asleep ? 1.1 : 2.2)) * (0.15 + (1 - this.lie) * 0.2) // hovering (lower and slower asleep)
      : run ? Math.abs(Math.sin(this.t * (2 + this.speed * 0.3))) * Math.min(2, 0.3 + this.speed * 0.03) : 0;
    this.body.position.y = hop;
    const nod = this.lie * (0.1 + Math.sin(this.t * 0.8) * 0.05);
    const quake = roar * Math.sin(this.t * 38) * 0.05;
    this.body.rotation.x = (this.mood === 'chase' ? 0.14 : 0) + nod - roar * 0.38 + lunge * 0.32 + quake;
    this.body.rotation.y = this.mood === 'stun' ? Math.sin(this.t * 9) * 0.25 : 0;

    if (this.model) {
      const v = GuardianView.viewer;
      const near = v && Math.hypot(v.x - this.root.position.x, v.z - this.root.position.z) < NAME_NEAR;
      if (near) _viewer.set(v.x, (v.y || 0) + 3, v.z);
      this.model.update({ t: this.t, open: this.eyeOpen, awake: 1 - this.lie, run: run ? 1 : 0, roar: Math.max(roar, lunge), viewer: near ? _viewer : null });
    }

    const top = this.height + hop;
    // the Zs drift up and out to the side and fade while it sleeps: big, so they are seen from far
    for (const z of this.zs) {
      const k = (this.t * 0.3 + z.userData.phase) % 1;
      z.visible = this.lie > 0.6;
      z.position.set(3 + k * 7, top + 2 + k * 13, Math.sin(k * 6) * 1.5);
      z.material.opacity = Math.min(1, Math.sin(k * Math.PI) * 1.4);
      z.scale.setScalar(3.6 + k * 3.6);
    }
    if (this.moodLabel) {
      this.moodLabel.position.y = top + MOOD_HEIGHT * 0.7 + (this.mood === 'alert' ? Math.abs(Math.sin(this.t * 6)) * 0.8 : 0);
    }
    // the name plate: shown near the player, and while it is awake
    const v = GuardianView.viewer;
    const near = v ? Math.hypot(v.x - this.root.position.x, v.z - this.root.position.z) < NAME_NEAR : false;
    this.nameK += ((near && !this.moodLabel ? 1 : 0) - this.nameK) * Math.min(1, dt * 6);
    this.name.visible = this.nameK > 0.02;
    this.name.material.opacity = this.nameK;
    this.name.position.y = top + NAME_HEIGHT * 0.8 + (this.lie > 0.6 ? 2.5 : 0);
  }
}
