// The wall across the start of the track (the red line), like the video. For the last few seconds
// before day turns to night (or night to day) a huge ash-grey wall of studded blocks rises out of the
// ground and shuts the whole way into the stages. It shows what is coming (a moon or a sun) and the
// seconds left, ticking. When the change comes everyone is sent back to the start and it stays shut,
// counting down CYCLE.gateS seconds; then it cracks and breaks into its blocks, which fall and tumble
// to the ground and sink away.
//
// It is one-way: it stops players walking from the lobby into the corridor, but anyone coming home
// (maybe carrying an egg) walks straight through it (see Game.blockAtGlass).
//
// Driven only by the server's clock (state.clock = seconds left in this day / night, state.gate,
// state.night), so every player sees it close and break at the same moment.

import * as THREE from 'three';
import { CYCLE, WORLD } from '../../shared/gameData.js';
import { studTexture } from '../util/textures.js';
import { canvasTexture, drawOutlinedText, FONT_TITLE } from '../util/canvasText.js';

export const GATE_SECONDS = 5;
// The wall stands just SOUTH of the red line, in front of the dojo, so nothing hides the sun / moon
// and the countdown from the lobby.
export const GATE_Z = WORLD.lineZ + 6;
const WIDTH = WORLD.openingHalf * 2 + 10; // a little wider than the opening: no gap at the wall ends
const HEIGHT = WORLD.corridorWallHeight;
const DEPTH = 4;
const COLS = 16, ROWS = 6;                // the blocks it is built of (and breaks into)
const BW = WIDTH / COLS, BH = HEIGHT / ROWS;
const STUD = 2.6;                         // world units per stud on the blocks
const RISE = 2.2;                         // how fast it rises (1 / seconds)
const GRAVITY = 95;
const FALL_SECONDS = 2.4;                 // the pieces lie on the ground this long...
const SINK_SECONDS = 0.8;                 // ...then sink away
const CANVAS_W = 1024, CANVAS_H = 400;
const ASH = ['#b4b1ab', '#aaa7a1', '#bdbab4', '#a3a09a', '#b8b5ae'];

// a crescent moon with a little cloud, or a sun with rays, centred on (cx, cy)
function drawIcon(g, cx, cy, r, night) {
  g.save();
  g.lineJoin = 'round';
  if (night) {
    const s = Math.ceil(r * 2.6);
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const m = c.getContext('2d');
    m.fillStyle = '#ffd84a';
    m.beginPath(); m.arc(s / 2, s / 2, r, 0, Math.PI * 2); m.fill();
    m.globalCompositeOperation = 'destination-out';
    m.beginPath(); m.arc(s / 2 + r * 0.55, s / 2 - r * 0.35, r * 0.85, 0, Math.PI * 2); m.fill();
    const x = cx - s / 2, y = cy - s / 2;
    g.filter = 'brightness(0)';
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) g.drawImage(c, x + Math.cos(a) * 7, y + Math.sin(a) * 7);
    g.filter = 'none';
    g.drawImage(c, x, y);
    // two little sparkles beside it
    g.fillStyle = '#ffd84a';
    for (const [sx, sy, sr] of [[0.85, -0.55, 0.16], [1.05, -0.05, 0.1]]) {
      const px = cx + sx * r, py = cy + sy * r, q = sr * r;
      g.beginPath();
      g.moveTo(px, py - q * 2); g.lineTo(px + q * 0.5, py - q * 0.5); g.lineTo(px + q * 2, py); g.lineTo(px + q * 0.5, py + q * 0.5);
      g.lineTo(px, py + q * 2); g.lineTo(px - q * 0.5, py + q * 0.5); g.lineTo(px - q * 2, py); g.lineTo(px - q * 0.5, py - q * 0.5);
      g.closePath(); g.fill();
    }
  } else {
    g.fillStyle = '#ffb21f';
    g.strokeStyle = '#3a2000';
    g.lineWidth = 9;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.14) * r * 0.95, cy + Math.sin(a - 0.14) * r * 0.95);
      g.lineTo(cx + Math.cos(a) * r * 1.45, cy + Math.sin(a) * r * 1.45);
      g.lineTo(cx + Math.cos(a + 0.14) * r * 0.95, cy + Math.sin(a + 0.14) * r * 0.95);
      g.closePath();
      g.stroke(); g.fill();
    }
    const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#fff6b0');
    grad.addColorStop(1, '#ffd21f');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); g.fill();
  }
  g.restore();
}

// One block: a box with its UVs scaled so the studs are the same size on every face.
function blockGeometry() {
  const geo = new THREE.BoxGeometry(BW * 0.985, BH * 0.985, DEPTH);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = i >> 2; // +x -x +y -y +z -z
    const [su, sv] = face < 2 ? [DEPTH, BH] : face < 4 ? [BW, DEPTH] : [BW, BH];
    uv.setXY(i, (uv.getX(i) * su) / STUD, (uv.getY(i) * sv) / STUD);
  }
  return geo;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

export class GlassGate {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, GATE_Z);
    this.group.visible = false;
    scene.add(this.group);

    // the wall: COLS x ROWS ash-grey studded blocks, one draw call
    const tex = studTexture();
    this.blocks = new THREE.InstancedMesh(blockGeometry(), new THREE.MeshLambertMaterial({ map: tex }), COLS * ROWS);
    this.blocks.castShadow = true;
    this.blocks.receiveShadow = true;
    this.blocks.frustumCulled = false;
    this.pieces = [];
    const c = new THREE.Color();
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const i = r * COLS + col;
        const home = new THREE.Vector3(-WIDTH / 2 + (col + 0.5) * BW, (r + 0.5) * BH, 0);
        this.pieces.push({ home, pos: home.clone(), vel: new THREE.Vector3(), rot: new THREE.Vector3(), spin: new THREE.Vector3() });
        this.blocks.setColorAt(i, c.set(ASH[(r * 7 + col * 3) % ASH.length]));
      }
    }
    this.blocks.instanceColor.needsUpdate = true;
    this.placeBlocks(true);
    this.group.add(this.blocks);

    // the moon / sun and the countdown, one face each way so it reads the right way round from both sides
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = canvasTexture(this.canvas);
    this.signMaterial = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, opacity: 0 });
    const signW = 110, signH = signW * (CANVAS_H / CANVAS_W);
    this.signs = [1, -1].map((s) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), this.signMaterial);
      sign.position.set(0, HEIGHT * 0.62, s * (DEPTH / 2 + 0.15));
      sign.rotation.y = s > 0 ? 0 : Math.PI;
      sign.renderOrder = 9;
      this.group.add(sign);
      return sign;
    });

    this.show = 0;      // 0 = down in the ground, 1 = fully up
    this.closed = false;
    this.breakT = -1;   // seconds since it broke (-1 = not breaking)
    this.drawn = '';
    this.justBroke = false;
  }

  // Puts every block where it is: in the wall (home) or wherever it has fallen.
  placeBlocks(home = false) {
    this.pieces.forEach((p, i) => {
      if (home) {
        _m.makeTranslation(p.home.x, p.home.y, p.home.z);
      } else {
        _q.setFromEuler(_e.set(p.rot.x, p.rot.y, p.rot.z));
        _m.compose(p.pos, _q, _s.setScalar(p.scale ?? 1));
      }
      this.blocks.setMatrixAt(i, _m);
    });
    this.blocks.instanceMatrix.needsUpdate = true;
  }

  // gate: true = the countdown after the change (the new day / night is here), false = the last
  // seconds before it (what is coming)
  draw(seconds, night, gate) {
    const key = `${seconds}|${night}|${gate}`;
    if (key === this.drawn) return false;
    this.drawn = key;
    const g = this.canvas.getContext('2d');
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const showNight = gate ? night : !night;
    drawIcon(g, 360, 175, 105, showNight);
    drawOutlinedText(g, `${seconds}s`, 680, 180, { size: 190, fill: '#1c1c22', stroke: '#ffffff', strokeWidth: 10, font: FONT_TITLE, weight: 400, glow: false });
    const text = gate ? (night ? 'NIGHT! THE WALL BREAKS IN' : 'MORNING! THE WALL BREAKS IN') : (night ? 'MORNING IS COMING!' : 'NIGHT IS COMING!');
    drawOutlinedText(g, text, CANVAS_W / 2, 350, {
      size: 54, fill: showNight ? '#6a3ad6' : '#e08a00', stroke: '#ffffff', strokeWidth: 10, font: FONT_TITLE, weight: 400, glow: false,
    });
    this.texture.needsUpdate = true;
    return true;
  }

  // The wall cracks apart: every block flies a little forward or back, out from the middle and up,
  // spinning, then falls, bounces and lies on the ground before sinking away.
  shatter() {
    this.breakT = 0;
    this.justBroke = true;
    for (const p of this.pieces) {
      p.pos.copy(p.home);
      p.rot.set(0, 0, 0);
      p.scale = 1;
      const out = p.home.x / (WIDTH / 2);
      p.vel.set(out * (6 + Math.random() * 10), 4 + Math.random() * 14 + p.home.y * 0.15, (Math.random() - 0.5) * 36);
      p.spin.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 6);
      p.rest = false;
    }
    for (const s of this.signs) s.visible = false;
  }

  updateShatter(dt) {
    this.breakT += dt;
    const sink = Math.max(0, this.breakT - FALL_SECONDS) / SINK_SECONDS;
    for (const p of this.pieces) {
      if (!p.rest) {
        p.vel.y -= GRAVITY * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.addScaledVector(p.spin, dt);
        const floor = BH * 0.35;
        if (p.pos.y < floor) {
          p.pos.y = floor;
          if (Math.abs(p.vel.y) > 12) {
            p.vel.y *= -0.3; // a bounce
            p.vel.x *= 0.6; p.vel.z *= 0.6;
            p.spin.multiplyScalar(0.5);
          } else {
            p.rest = true;   // it settles
            p.rot.x = Math.round(p.rot.x / (Math.PI / 2)) * (Math.PI / 2);
            p.rot.z = Math.round(p.rot.z / (Math.PI / 2)) * (Math.PI / 2);
          }
        }
      }
      p.scale = 1;
      if (sink > 0) p.pos.y -= dt * BH * 1.4; // sinking into the ground
    }
    this.placeBlocks();
    if (sink >= 1) {
      this.breakT = -1;
      this.show = 0;
      this.group.visible = false;
      this.placeBlocks(true);
      for (const s of this.signs) s.visible = true;
    }
  }

  // Shut for the last CYCLE.freezeS seconds of a day / night (it rises while everyone stands still) and
  // the CYCLE.gateS seconds after it, counting down. Then it breaks. Returns true when the number
  // changed (a tick sound); justBroke is true for the frame it breaks (a crash sound).
  update(dt, state) {
    this.justBroke = false;
    const clock = Math.max(0, state.clock | 0), gate = state.gate | 0;
    const wasClosed = this.closed;
    this.closed = gate > 0 || clock <= CYCLE.freezeS;
    if (this.breakT >= 0) {
      this.updateShatter(dt);
      if (!this.closed) return false;
      // closing again before the pieces were gone (a very short test cycle): back to a whole wall
      this.breakT = -1;
      this.placeBlocks(true);
      for (const s of this.signs) s.visible = true;
    }
    if (wasClosed && !this.closed && this.show > 0.5) {
      this.group.scale.y = 1;
      this.shatter();
      return false;
    }
    const goal = this.closed ? 1 : 0;
    this.show = goal > this.show ? Math.min(1, this.show + dt * RISE) : Math.max(0, this.show - dt * RISE);
    this.group.visible = this.show > 0.001;
    if (!this.group.visible) {
      this.drawn = '';
      return false;
    }
    const k = this.show;
    // rises out of the ground with a little overshoot
    this.group.scale.y = Math.max(0.001, 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
    this.signMaterial.opacity = Math.min(1, k * 1.5);
    if (!this.closed) return false;
    return gate > 0 ? this.draw(gate, state.night, true) : this.draw(Math.max(1, clock), state.night, false);
  }
}
