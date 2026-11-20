// The whirlwind a player spins in while standing in their training arena (like the video): a funnel
// of white wind streaks, narrow at the feet and wide over the head, its layers turning at different
// speeds, with a few gold sparks flying round it. It grows in when the spin starts and shrinks away
// when it stops. One per character; the textures are shared.

import * as THREE from 'three';
import { canvasTexture } from '../util/canvasText.js';

const LAYERS = [
  // [bottom radius, top radius, height, y, turn speed, opacity]
  [0.9, 2.1, 3.2, 0.1, 9, 0.75],
  [1.8, 3.2, 3.0, 2.6, -7, 0.6],
  [2.8, 4.4, 3.0, 5.0, 6, 0.5],
];
const GROW_SPEED = 5;
const SPARKS = 10;

let streakMap = null;
function streaks() {
  if (streakMap) return streakMap;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 128);
  // slanted white wind streaks of different lengths, soft at the ends
  for (let i = 0; i < 14; i++) {
    const y = 8 + (i * 113) % 112, x = (i * 71) % 256, len = 60 + (i * 37) % 90, w = 3 + (i % 3) * 2;
    const grad = g.createLinearGradient(x, 0, x + len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grad;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y - len * 0.18);
    g.stroke();
    // wrap round the seam
    if (x + len > 256) { g.beginPath(); g.moveTo(x - 256, y); g.lineTo(x - 256 + len, y - len * 0.18); g.stroke(); }
  }
  streakMap = canvasTexture(c);
  streakMap.wrapS = THREE.RepeatWrapping;
  return streakMap;
}

let sparkMap = null;
function spark() {
  if (sparkMap) return sparkMap;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.35, 'rgba(255,220,90,0.9)');
  grad.addColorStop(1, 'rgba(255,200,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sparkMap = canvasTexture(c);
  return sparkMap;
}

export class Whirlwind {
  constructor() {
    this.root = new THREE.Group();
    this.root.visible = false;
    this.k = 0;
    this.on = false;
    this.layers = LAYERS.map(([r0, r1, h, y, speed, opacity]) => {
      const material = new THREE.MeshBasicMaterial({
        map: streaks(), color: '#ffffff', transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 28, 1, true), material);
      mesh.position.y = y + h / 2;
      mesh.renderOrder = 5;
      this.root.add(mesh);
      return { mesh, speed, opacity };
    });
    this.sparks = Array.from({ length: SPARKS }, (_, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.7);
      s.renderOrder = 6;
      this.root.add(s);
      return { s, a: (i / SPARKS) * Math.PI * 2, t: (i / SPARKS) * 1.6 };
    });
  }

  // tint: the arena's colour, mixed a little into the wind
  setTint(color) {
    const c = new THREE.Color('#ffffff').lerp(new THREE.Color(color), 0.25);
    for (const l of this.layers) l.mesh.material.color.copy(c);
  }

  update(dt, on) {
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * GROW_SPEED);
    this.root.visible = this.k > 0.02;
    if (!this.root.visible) return;
    this.root.scale.set(0.4 + this.k * 0.6, this.k, 0.4 + this.k * 0.6);
    for (const l of this.layers) {
      l.mesh.rotation.y += l.speed * dt;
      l.mesh.material.opacity = l.opacity * this.k;
    }
    for (const p of this.sparks) {
      p.t = (p.t + dt) % 1.6;
      p.a += dt * 7;
      const r = 1.2 + p.t * 2;
      p.s.position.set(Math.cos(p.a) * r, 0.5 + p.t * 5.2, Math.sin(p.a) * r);
      p.s.material.opacity = Math.sin((p.t / 1.6) * Math.PI) * this.k;
    }
  }
}
