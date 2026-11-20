// The spawn pad in the middle of the lobby, where everyone appears: a round red and white pad with
// a gold dragon logo on it under a see-through red bubble, a ring of light turning on its top, and magic
// dust in many colours swirling round inside the bubble. Everything glows (unlit), so it shows by
// day and night; on a weak device / connection there is less dust.

import * as THREE from 'three';
import { glowTexture } from '../util/textures.js';
import { FX } from './Tornado.js';
import { dragonTexture } from './NinjaGuardians.js';

export const PAD_TOP = 0.7;
const DUST = 180;
const DUST_LOW = 60;
const DUST_COLORS = ['#ff3a3a', '#ffd21f', '#3aff8a', '#3ab8ff', '#c84aff', '#ff7ab8', '#ffffff', '#ff8a1a'];

// the pad's top: a red disc with white rings and the gold dragon logo in the middle
function topTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#ff6a4a');
  grad.addColorStop(0.55, '#e01e2e');
  grad.addColorStop(1, '#8a0a16');
  g.fillStyle = grad;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 14;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 40, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 62, 0, Math.PI * 2); g.stroke();
  // a ring of little white dots round a gold-ringed medallion with a gold dragon coiled in it
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = S / 2 - 92;
    g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 7, 0, Math.PI * 2); g.fill();
  }
  const R = S / 2 - 112;
  const med = g.createRadialGradient(S / 2, S / 2 - 30, 10, S / 2, S / 2, R);
  med.addColorStop(0, '#b0101e');
  med.addColorStop(1, '#5a0610');
  g.fillStyle = med;
  g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.fill();
  g.lineWidth = 12; g.strokeStyle = '#ffcc33';
  g.beginPath(); g.arc(S / 2, S / 2, R, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#fff2a0';
  g.beginPath(); g.arc(S / 2, S / 2, R - 12, 0, Math.PI * 2); g.stroke();
  // the dragon (the same logo the guardians wear), in gold with a soft gold glow round it
  const dragon = dragonTexture({ color: '#ffcc33', dark: '#5a2a00', light: '#fff2a0' }).image;
  const h = R * 1.62, w = h * (dragon.width / dragon.height);
  g.save();
  g.shadowColor = 'rgba(255, 210, 80, 0.9)';
  g.shadowBlur = 22;
  g.drawImage(dragon, S / 2 - w / 2, S / 2 - h / 2, w, h);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class SpawnPad {
  constructor(scene, physics, { x, z, radius }) {
    this.x = x; this.z = z; this.r = radius;
    this.t = 0;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    scene.add(group);
    this.group = group;
    const basic = (color) => new THREE.MeshBasicMaterial({ color });
    const disc = (r, h, y, color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), basic(color));
      m.position.y = y + h / 2;
      group.add(m);
      return m;
    };
    disc(radius + 1.4, 0.3, 0, '#5a0610');      // a dark step round it
    disc(radius, 0.5, 0, '#f4f2ea');            // the white rim
    disc(radius - 1, 0.66, 0, '#b0101e');       // the red pad
    const top = new THREE.Mesh(new THREE.CircleGeometry(radius - 1.05, 64), new THREE.MeshBasicMaterial({ map: topTexture() }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = PAD_TOP + 0.02;
    group.add(top);
    physics?.addRoundSurface(x, z, radius, PAD_TOP, { floor: true });

    // a ring of light turning round the top, and a soft red glow on the ground round the pad
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.6, radius + 0.4, 48, 1, 0, Math.PI * 1.4), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = PAD_TOP + 0.08;
    group.add(this.ring);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(radius * 4, radius * 4), new THREE.MeshBasicMaterial({
      map: glowTexture(), color: '#ff2a2a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.1;
    group.add(this.glow);

    // the see-through bubble over the pad: clear in the middle, red and shiny at its edge
    this.R = radius + 1.2;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(this.R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ff3a3a') } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform vec3 uColor; void main() { float rim = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(mix(uColor, vec3(1.0), rim * 0.35), 0.06 + rim * 0.45); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    bubble.renderOrder = 4;
    group.add(bubble);

    // magic dust in many colours swirling round inside the bubble
    const pos = new Float32Array(DUST * 3), col = new Float32Array(DUST * 3);
    const tints = DUST_COLORS.map((c) => new THREE.Color(c));
    this.specks = Array.from({ length: DUST }, (_, i) => ({
      a: Math.random() * Math.PI * 2, t: Math.random(), c: tints[i % tints.length],
      r: 0.2 + Math.random() * 0.72, v: 0.12 + Math.random() * 0.16, spin: 0.8 + Math.random() * 1.2,
      tw: Math.random() * 10,
    }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dustGeo = geo;
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), size: 2.4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 8;
    group.add(this.dust);
  }

  // night: 0 day .. 1 night; near: is the player close enough for the dust to be worth moving
  update(dt, night = 0, near = true) {
    this.t += dt;
    const t = this.t;
    const fancy = FX.fancy;
    this.ring.rotation.z = -t * 1.6;
    this.glow.material.opacity = (0.4 + 0.35 * night) * (0.85 + Math.sin(t * 3) * 0.15);
    if (!near) return;
    const n = FX.level >= 2 ? DUST : fancy ? Math.round((DUST + DUST_LOW) / 2) : DUST_LOW;
    this.dustGeo.setDrawRange(0, n);
    const pos = this.dustGeo.attributes.position.array, col = this.dustGeo.attributes.color.array;
    for (let i = 0; i < n; i++) {
      const p = this.specks[i];
      p.t += dt * p.v;
      if (p.t > 1) { p.t -= 1; p.a = Math.random() * Math.PI * 2; }
      p.a += dt * p.spin * (1.2 - p.t * 0.5);
      // it swirls up round the pad and stays inside the bubble (narrower as the dome closes in)
      const y = PAD_TOP + 0.5 + p.t * (this.R * 0.82);
      const r = p.r * Math.sqrt(Math.max(0, this.R * this.R - y * y));
      pos[i * 3] = Math.cos(p.a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(p.a) * r;
      const f = Math.sin(p.t * Math.PI) * (0.65 + 0.35 * Math.sin(t * 8 + p.tw));
      col[i * 3] = p.c.r * f; col[i * 3 + 1] = p.c.g * f; col[i * 3 + 2] = p.c.b * f;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
    this.dustGeo.attributes.color.needsUpdate = true;
  }

  // is a point on the pad
  on(x, z) {
    return Math.hypot(x - this.x, z - this.z) <= this.r;
  }
}
