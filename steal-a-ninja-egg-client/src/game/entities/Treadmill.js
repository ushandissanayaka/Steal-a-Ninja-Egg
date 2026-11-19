// The treadmill outside each pen (like the video): a white treadmill with a coloured trim stripe, a
// black belt with arrows running towards the console, dark handrails with wooden rails, and a gate
// frame over it with hazard tape and a hanging lantern. A gold display above the console shows the
// owner's speed, the treadmill's name, its speed per step and what the next upgrade costs.
//
// Each upgrade changes it: the starter (Abandoned) treadmill is white and yellow in a wooden frame;
// every upgrade after that stands in a frame of stone pillars topped with glowing crystals, in that
// treadmill's own colour. Upgrading sends up a cloud of coloured smoke and the treadmill changes
// inside it.

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI } from '../util/canvasText.js';
import { TREADMILLS, TREADMILL_BELT, formatNumber, nextTreadmill, treadmillById } from '../../shared/gameData.js';
import { glowMap } from './Effects.js';

const BELT_WIDTH = TREADMILL_BELT.halfX * 2;
const WIDTH = BELT_WIDTH + 1.4; // across the belt (local x)
const LENGTH = 13;              // along the belt (local z); the console is at -z
export const TREADMILL_HALF = { x: WIDTH / 2 + 0.2, z: 7 };
export { TREADMILL_BELT };
// the gate frame's posts (local x, either side) and where they stand along the belt
export const FRAME_POST_X = WIDTH / 2 + 2.6;
export const FRAME_Z = 1.5;
export const FRAME_HEIGHT = 15;
const DEFAULT_TRIM = '#ffd21f';
const WHITE = '#f4f3ee';
const METAL = '#3e4656';
const METAL_LIGHT = '#5a6478';
const WOOD = ['#7a3a1e', '#8c4626', '#6a321a'];
const STONE = ['#8d9196', '#7b7f85', '#9ea2a7', '#6f7378'];
const BELT_SPEED = 1.2;
const SMOKE_SECONDS = 2.8;
const SWAP_AT = 0.55;           // the treadmill changes this long into the smoke
const SMOKE_PUFFS = 44;
// the thick smoke that billows out of both sides of a working treadmill and rises: white mixed with
// the treadmill's own colour (yellow for the starter), so it changes colour with every upgrade.
// Kept to a few big puffs (sprites) rather than many small ones, so it looks full without costing much.
const AMBIENT_PUFFS = 32;
const AMBIENT_WHITE = new THREE.Color('#ffffff');
// the starter's yellow, then the trim colour, always made rich and bright: full of colour, and neither
// so dark (the Void's) nor so pale (the Bone's) that it reads as grey or white smoke
// where the trim colour would give the same smoke as another treadmill, its own smoke colour, so every
// upgrade visibly changes it (Bone would be the starter's yellow, Void the Nightmare's purple)
const SMOKE_COLOR = { bone: '#7dff6a', void: '#e02cff' };
const _hsl = {};
const smokeTint = (id) => {
  const c = new THREE.Color(tierOf(id) <= 1 ? '#ffd21f' : SMOKE_COLOR[treadmillById(id).id] || trimOf(id));
  c.getHSL(_hsl);
  c.setHSL(_hsl.h, Math.max(_hsl.s, 0.9), Math.min(0.6, Math.max(0.5, _hsl.l)));
  return c;
};

const tierOf = (id) => Math.max(0, TREADMILLS.indexOf(treadmillById(id)));
// the colour of a treadmill's trim, belt arrows and lantern
const trimOf = (id) => (tierOf(id) <= 1 ? DEFAULT_TRIM : treadmillById(id).color || DEFAULT_TRIM);
const mix = (a, b, k) => `#${new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()}`;

function beltTexture(color) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#26282e';
  g.fillRect(0, 0, 64, 128);
  g.strokeStyle = color;
  g.lineWidth = 10;
  g.lineJoin = 'miter';
  for (const y of [32, 96]) {
    g.beginPath();
    g.moveTo(10, y + 15);
    g.lineTo(32, y - 15);
    g.lineTo(54, y + 15);
    g.stroke();
  }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  return t;
}

// ------------------------------------------------------------------ the body

function addBody(v, id) {
  const tier = tierOf(id);
  const trim = trimOf(id);
  const base = tier <= 1 ? WHITE : mix(WHITE, trim, 0.18);
  // the deck: white, with a trim stripe all round and dark vents along the sides
  v.box(0, 0, 0, WIDTH, 0.7, LENGTH, '#2c2f36');
  v.box(0, 0.35, 0, WIDTH + 0.4, 0.75, LENGTH - 0.6, base);
  for (const s of [-1, 1]) {
    v.box(s * (WIDTH / 2 + 0.22), 0.55, 0, 0.1, 0.32, LENGTH - 0.8, trim);
    for (let k = -2; k <= 2; k++) v.box(s * (WIDTH / 2 + 0.23), 0.5, k * 2.2, 0.08, 0.18, 1.2, '#2c2f36');
  }
  v.box(0, 0.55, LENGTH / 2 - 0.25, WIDTH + 0.42, 0.32, 0.1, trim);
  v.box(0, 1.1, 0, BELT_WIDTH, 0.12, LENGTH - 1, '#26282e');
  // the console end: a raised white block with the belt's motor cover
  v.box(0, 1.1, -LENGTH / 2 + 0.9, WIDTH, 1.2, 1.8, base);
  v.box(0, 2.3, -LENGTH / 2 + 0.9, WIDTH - 1, 0.25, 1.4, trim);
  // the uprights and the console bar
  for (const s of [-1, 1]) {
    v.box(s * (WIDTH / 2 - 0.4), 1.1, -LENGTH / 2 + 1.4, 0.7, 6.4, 0.7, METAL, { rx: 0.18 });
    // the handrails along the sides: dark metal posts, a wooden rail on top
    for (const z of [-3.2, 0.4, 4]) v.box(s * (WIDTH / 2 - 0.15), 1.1, z, 0.55, 3.6, 0.55, METAL);
    v.box(s * (WIDTH / 2 - 0.15), 4.7, 0.4, 0.5, 0.35, 9, METAL_LIGHT);
    v.box(s * (WIDTH / 2 + 0.2), 3.2, 0.4, 0.5, 0.55, 9.6, WOOD[1]);
  }
  v.box(0, 7.1, -LENGTH / 2 + 2.3, WIDTH, 0.7, 0.8, METAL_LIGHT);
  v.box(0, 6.7, -LENGTH / 2 + 2.0, WIDTH - 2, 1.4, 0.6, '#2c2f36', { rx: 0.4 });
  // the console's little lights, in the trim colour and white
  for (let k = 0; k < 5; k++) v.box(-3.2 + k * 1.6, 7.25, -LENGTH / 2 + 2.62, 0.7, 0.3, 0.12, k % 2 ? '#ffffff' : trim);
}

// The gate frame: wood for the starter (and a locked) treadmill, stone pillars for every upgrade.
function addFrame(v, glow, id) {
  const tier = tierOf(id);
  const trim = trimOf(id);
  const px = FRAME_POST_X, z = FRAME_Z, h = FRAME_HEIGHT;
  if (tier <= 1) {
    for (const s of [-1, 1]) {
      v.box(s * px, 0, z, 2.1, h, 2.1, WOOD[0]);
      v.box(s * px + s * 0.1, 0, z, 2.6, 0.8, 2.6, WOOD[2]);
      // a diagonal brace
      v.box(s * (px - 1.6), h - 4.2, z, 0.7, 4, 0.7, WOOD[2], { rz: s * 0.7 });
      // traffic cones by the posts
      v.box(s * (px + 2.4), 0, z + 2.5, 1.6, 0.25, 1.6, '#e8641a');
      v.box(s * (px + 2.4), 0.25, z + 2.5, 1, 1.6, 1, '#ff7a1a');
      v.box(s * (px + 2.4), 1.0, z + 2.5, 1.05, 0.35, 1.05, '#ffffff');
    }
    v.box(0, h, z, px * 2 + 3, 2.2, 2.4, WOOD[1]);
    v.box(0, h + 2.2, z, px * 2 + 4, 0.5, 2.8, WOOD[2]);
    // hazard tape swinging under the beam (two crossed strips)
    for (const s of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const t = (k + 0.5) / 8;
        v.box(-px + 1 + t * (px * 2 - 2), h - 1.4 - s * (t - 0.5) * 3.2, z + s * 0.3, (px * 2 - 2) / 8 + 0.05, 0.6, 0.12,
          k % 2 ? '#14141a' : '#ffd21f', { rz: s * 0.2 });
      }
    }
    // a few planks lying about
    v.box(px + 5, 0, z - 4, 1.2, 0.3, 5, WOOD[1], { ry: 0.4 });
    v.box(px + 6.4, 0, z - 3, 1.2, 0.3, 4.4, WOOD[2], { ry: 0.25 });
  } else {
    for (const s of [-1, 1]) {
      // a pillar of stone blocks with a stepped plinth and a capital
      v.box(s * px, 0, z, 3.6, 1.4, 3.6, STONE[3]);
      for (let y = 1.4, row = 0; y < h; y += 2.4, row++) v.box(s * px, y, z, 2.8 + (row % 2) * 0.3, Math.min(2.3, h - y), 2.8 + ((row + 1) % 2) * 0.3, STONE[row % STONE.length]);
      v.box(s * px, h, z, 3.8, 1, 3.8, STONE[2]);
      // the glowing crystal on top, in the treadmill's colour
      glow.box(s * px, h + 1, z, 1.6, 2.6, 1.6, trim, { ry: 0.785 });
      glow.box(s * px, h + 3.4, z, 0.9, 1.4, 0.9, mix(trim, '#ffffff', 0.5), { ry: 0.785 });
    }
    v.box(0, h - 0.6, z, px * 2 - 1, 1.6, 1.8, STONE[1]);
    // a band of the treadmill's colour across the lintel
    glow.box(0, h - 0.3, z + 0.92, px * 2 - 3, 0.5, 0.06, trim);
  }
  // the chain and the lantern, hanging to one side so the display stays in view
  const lx = px * 0.62;
  v.box(lx, h - 3.2, z, 0.3, 3.2, 0.3, '#9aa1a8');
  v.box(lx, h - 5.4, z, 1.6, 0.4, 1.6, '#2a2a30');
  glow.box(lx, h - 5, z, 1.1, 1.4, 1.1, tier <= 1 ? '#ffe9a0' : mix(trim, '#ffffff', 0.4));
  v.box(lx, h - 3.6, z, 1.7, 0.4, 1.7, '#2a2a30');
  // locked: tape strung across the belt as well
  if (tier === 0) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const t = (k + 0.5) / 7;
        v.box(-WIDTH / 2 + t * WIDTH, 2.6 + s * (t - 0.5) * 2.4, z + 0.4, WIDTH / 7 + 0.05, 0.6, 0.12, k % 2 ? '#14141a' : '#ffd21f', { rz: -s * 0.3 });
      }
    }
  }
}

// ------------------------------------------------------------------ the display

const DISPLAY_W = 512, DISPLAY_H = 256;
function drawDisplay(g, { id, speed, owned }) {
  const mill = treadmillById(id);
  const next = nextTreadmill(id);
  const trim = trimOf(id);
  // a gold screen with a dark bevel
  const grad = g.createLinearGradient(0, 0, 0, DISPLAY_H);
  grad.addColorStop(0, '#ffe07a');
  grad.addColorStop(1, '#d99a1a');
  g.fillStyle = '#2a1c06';
  g.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
  g.fillStyle = grad;
  g.fillRect(8, 8, DISPLAY_W - 16, DISPLAY_H - 16);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(8, 8, DISPLAY_W - 16, 26);
  if (!owned) {
    drawOutlinedText(g, 'EMPTY BASE', DISPLAY_W / 2, DISPLAY_H / 2, { size: 70, fill: '#ffffff', stroke: '#3a2400', strokeWidth: 10, font: FONT_TITLE, weight: 400, glow: false });
    return;
  }
  drawOutlinedText(g, `⚡ ${formatNumber(speed)}`, DISPLAY_W / 2, 72, { size: 86, fill: '#ffffff', stroke: '#3a2400', strokeWidth: 12, font: FONT_TITLE, weight: 400, glow: false });
  const line = mill.gain ? `${mill.name}  +${formatNumber(mill.gain)}/step` : 'LOCKED';
  drawOutlinedText(g, line, DISPLAY_W / 2, 140, { size: 34, fill: mill.gain ? '#3a2400' : '#c81e2a', stroke: null, font: FONT_UI, weight: 700, glow: false });
  // the bottom strip: what the next upgrade costs
  g.fillStyle = next ? '#c81e2a' : '#2fa83a';
  g.fillRect(22, 172, DISPLAY_W - 44, 64);
  const text = next ? `${mill.gain ? 'UPGRADE' : 'UNLOCK'}: $${formatNumber(next.price)}` : 'MAX LEVEL!';
  drawOutlinedText(g, text, DISPLAY_W / 2, 205, { size: 46, fill: '#ffffff', stroke: '#3a0a0a', strokeWidth: 8, font: FONT_TITLE, weight: 400, glow: false });
  // little arrows in the trim colour, like the video's display
  g.fillStyle = trim;
  for (let k = 0; k < 6; k++) {
    const x = 40 + k * 14;
    g.beginPath();
    g.moveTo(x, 150); g.lineTo(x + 9, 157); g.lineTo(x, 164);
    g.fill();
  }
}

// ------------------------------------------------------------------ the view

export class TreadmillView {
  static fancy = false; // a smooth frame rate and a good connection: the smoke spirals, with magic dust
  constructor(parent, x, z) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    parent.add(this.group);
    this.model = null;
    this.id = null;

    // the display above the console, one face each way
    this.canvas = document.createElement('canvas');
    this.canvas.width = DISPLAY_W;
    this.canvas.height = DISPLAY_H;
    this.texture = canvasTexture(this.canvas);
    const material = new THREE.MeshBasicMaterial({ map: this.texture });
    const frame = new Voxels();
    frame.box(0, -0.3, 0, 8.4, 4.8, 0.5, '#3a2a10');
    frame.box(0, -1.3, -0.4, 0.6, 1.4, 0.6, METAL);
    this.display = new THREE.Group();
    this.display.add(frame.mesh({ castShadow: false }));
    for (const s of [1, -1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), material);
      face.position.set(0, 2.1, s * 0.27);
      face.rotation.y = s > 0 ? 0 : Math.PI;
      this.display.add(face);
    }
    this.display.position.set(0, 8.4, -LENGTH / 2 + 2.3);
    this.group.add(this.display);
    this.displayKey = '';
    this.displayAt = -1;

    this.smoke = [];
    this.time = 0;

    this.ambient = new THREE.Group();
    this.group.add(this.ambient);
    this.ambientPuffs = [];
    this.smokeColor = smokeTint('none');
    for (let i = 0; i < AMBIENT_PUFFS; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), transparent: true, depthWrite: false, opacity: 0 }));
      sprite.renderOrder = 5;
      const p = { sprite, vel: new THREE.Vector3(), side: i % 2 ? 1 : -1 };
      this.respawnAmbient(p);
      p.age = Math.random() * p.life; // staggered so it doesn't all puff at once
      this.ambient.add(sprite);
      this.ambientPuffs.push(p);
    }
    this.ambient.visible = false;
  }

  // Puts an ambient smoke puff back at a random spot along one of the treadmill's two long sides.
  // Puffs alternate sides (by index) so both sides always have the same amount of smoke.
  respawnAmbient(p) {
    const side = p.side;
    const x = side * (WIDTH / 2 + 0.4);
    const z = (Math.random() - 0.5) * (LENGTH - 1);
    p.sprite.position.set(x, 0.8 + Math.random() * 0.8, z);
    // out of the side and up into a big rising cloud
    const out = 1.6 + Math.random() * 1.6;
    p.vel.set(side * out, 2 + Math.random() * 2, (Math.random() - 0.5) * 0.8);
    p.tint = 0.7 + Math.random() * 0.3; // how much of the treadmill's colour (the rest is white): mostly colour
    this.tintPuff(p);
    p.size = 7 + Math.random() * 5;
    p.spin = (Math.random() - 0.5) * 0.8;
    p.life = 3.2 + Math.random() * 1.8;
    p.age = 0;
    // for the spiral: where round the treadmill it starts
    p.angle = side > 0 ? 0 : Math.PI;
    p.angle += (Math.random() - 0.5) * 1.2;
    p.rise = 3 + Math.random() * 2;
  }

  tintPuff(p) {
    p.sprite.material.color.copy(AMBIENT_WHITE).lerp(this.smokeColor, p.tint);
  }

  // Magic dust spiralling up round the treadmill with the smoke (fancy only): one Points per treadmill.
  updateDust(dt) {
    const on = this.running && TreadmillView.fancy && this.ambient.visible !== false;
    if (!on) { if (this.dust) this.dust.visible = false; return; }
    const N = 70;
    if (!this.dust) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: glowMap(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
      this.dust.frustumCulled = false;
      this.group.add(this.dust);
      this.grains = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2, t: Math.random() * 3 }));
    }
    this.dust.visible = true;
    this.dust.material.color.copy(this.smokeColor).lerp(AMBIENT_WHITE, 0.1);
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      const g = this.grains[i];
      g.t = (g.t + dt) % 3;
      const a = g.a + g.t * 2.4;
      const r = WIDTH / 2 + 0.6 + g.t * 0.9;
      pos.setXYZ(i, Math.cos(a) * r, 0.6 + g.t * 4.5, Math.sin(a) * r * 1.35);
    }
    pos.needsUpdate = true;
  }

  updateAmbient(dt) {
    this.ambient.visible = !!this.running;
    this.updateDust(dt);
    if (!this.running) return;
    const spiral = TreadmillView.fancy;
    for (const p of this.ambientPuffs) {
      p.age += dt;
      if (p.age >= p.life) this.respawnAmbient(p);
      const k = p.age / p.life;
      if (spiral) {
        // round and round the treadmill as it rises, widening: a whirl of smoke
        p.angle += dt * (1.6 - k * 0.6);
        const r = WIDTH / 2 + 1 + k * 4;
        p.sprite.position.set(Math.cos(p.angle) * r, 0.8 + p.rise * p.age, Math.sin(p.angle) * r * 1.35);
      } else p.sprite.position.addScaledVector(p.vel, dt * (1 - k * 0.7)); // slows as it spreads
      p.sprite.scale.setScalar(p.size * (0.6 + k * 1.6));
      p.sprite.material.rotation += p.spin * dt;
      p.sprite.material.opacity = Math.min(1, k / 0.2) * Math.min(1, (1 - k) / 0.4) * 0.92; // quick fade-in, slow fade-out
    }
  }

  // Builds the model for this treadmill (and drops the old one).
  build(id) {
    if (this.model) {
      this.group.remove(this.model);
      this.model.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    const v = new Voxels();
    const glow = new Voxels();
    addBody(v, id);
    addFrame(v, glow, id);
    this.model = new THREE.Group();
    this.model.add(v.mesh());
    this.model.add(new THREE.Mesh(glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })));
    this.beltTexture?.dispose();
    this.beltTexture = beltTexture(trimOf(id));
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(BELT_WIDTH - 0.2, LENGTH - 1.4), new THREE.MeshLambertMaterial({ map: this.beltTexture }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.y = TREADMILL_BELT.height;
    belt.receiveShadow = true;
    this.model.add(belt);
    this.group.add(this.model);
    this.running = treadmillById(id).gain > 0;
    // the side smoke takes the new treadmill's colour at once (this happens inside the upgrade cloud)
    this.smokeColor.copy(smokeTint(id));
    for (const p of this.ambientPuffs) this.tintPuff(p);
  }

  // state: the owner's player state (null for a free pen)
  sync(state) {
    const id = state?.treadmill || 'none';
    if (id !== this.id) {
      const upgraded = this.id !== null && state && tierOf(id) > tierOf(this.id);
      this.id = id;
      if (upgraded) this.puff(smokeTint(id)); // the model is swapped inside the smoke (see update)
      else this.build(id);
    }
    // the display: redrawn when what it shows changes, at most 4 times a second
    const key = `${id}|${state ? formatNumber(state.speed) : '-'}`;
    if (key !== this.displayKey && (this.displayKey === '' || this.time - this.displayAt > 0.25)) {
      this.displayKey = key;
      this.displayAt = this.time;
      drawDisplay(this.canvas.getContext('2d'), { id, speed: state?.speed || 0, owned: !!state });
      this.texture.needsUpdate = true;
    }
  }

  // A cloud of coloured smoke rising off the treadmill.
  puff(color) {
    this.smokeT = 0;
    this.pendingBuild = true;
    for (const s of this.smoke) this.group.remove(s.sprite);
    this.smoke = [];
    const tint = new THREE.Color(color);
    for (let i = 0; i < SMOKE_PUFFS; i++) {
      const c = tint.clone().lerp(AMBIENT_WHITE, Math.random() * 0.12);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: c, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.renderOrder = 6;
      const a = Math.random() * Math.PI * 2, r = Math.random() * 4.5;
      sprite.position.set(Math.cos(a) * r, 1 + Math.random() * 2, Math.sin(a) * r * 1.3);
      this.group.add(sprite);
      this.smoke.push({
        sprite, delay: Math.random() * 0.5,
        vel: new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2), 5 + Math.random() * 6, Math.sin(a) * (1 + Math.random() * 2)),
        size: 6 + Math.random() * 6, spin: (Math.random() - 0.5) * 2,
      });
    }
  }

  update(dt) {
    this.time += dt;
    if (this.running && this.beltTexture) this.beltTexture.offset.y -= dt * BELT_SPEED;
    this.updateAmbient(dt);
    if (this.smokeT === undefined) return;
    this.smokeT += dt;
    if (this.pendingBuild && this.smokeT >= SWAP_AT) {
      this.pendingBuild = false;
      this.build(this.id);
    }
    for (const s of this.smoke) {
      const t = this.smokeT - s.delay;
      if (t < 0) continue;
      const k = Math.min(1, t / (SMOKE_SECONDS - s.delay));
      s.sprite.position.addScaledVector(s.vel, dt * (1 - k * 0.6));
      s.sprite.scale.setScalar(s.size * (0.6 + k * 1.8));
      s.sprite.material.rotation += s.spin * dt;
      s.sprite.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (1 - k * 0.3);
    }
    if (this.smokeT >= SMOKE_SECONDS) {
      for (const s of this.smoke) {
        this.group.remove(s.sprite);
        s.sprite.material.dispose();
      }
      this.smoke = [];
      this.smokeT = undefined;
    }
  }
}
