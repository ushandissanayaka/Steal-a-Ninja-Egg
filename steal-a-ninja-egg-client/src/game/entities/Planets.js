// Giant planets far out in the sky, rising over the walls: three round the lobby (west, east and
// south) and more along the track on either side, so a part of a planet always shows over the
// corridor walls. Each is a banded gas giant with a Saturn-like ring, lit from one side with a soft
// glowing rim. Cheap: one sphere + one ring each, textures painted once on a canvas, no fog (they
// are part of the sky), and they only turn slowly.

import * as THREE from 'three';
import { WORLD } from '../../shared/gameData.js';

const TRACK = WORLD.lineZ - WORLD.northZ; // the corridor's length
const along = (k) => WORLD.lineZ - TRACK * k;

// [x, y, z, radius, band colours, ring colour (null = no ring), ring tilt x, ring tilt z]
const PLANETS = [
  // round the lobby
  [-1500, 360, 220, 430, ['#e8c27a', '#c98f4a', '#f3dca6', '#b0703a', '#e2b36a'], '#e9d3a0', 0.42, 0.18],
  [1400, 470, 420, 300, ['#7fd8e8', '#4aa6c9', '#b8f0ff', '#3a86b0'], '#bfefff', 0.3, -0.35],
  [260, 340, 2150, 540, ['#b36ad8', '#7a3aa8', '#e0a8ff', '#5a2a86', '#c98ae8'], '#f0c8ff', 0.5, 0.1],
  // along the track, alternating sides
  [-760, 1050, along(0.22), 480, ['#e8643a', '#a83a22', '#ffb27a', '#7a2214'], '#ffcfa0', 0.36, 0.3],
  [820, 1200, along(0.48), 560, ['#6ad87a', '#2e8a4a', '#c8ffb0', '#1e5a32'], '#d8ffd0', 0.45, -0.2],
  [-800, 1100, along(0.72), 500, ['#ff7ab8', '#c23a7a', '#ffd0e8', '#8a1e52'], '#ffd8ee', 0.28, 0.4],
  [780, 1250, along(0.98), 580, ['#d8eeff', '#8ab4e0', '#ffffff', '#5a7ab0'], '#e8f4ff', 0.5, -0.12],
];

function bandTexture(colors, seed) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // wavy horizontal bands of the planet's colours
  for (let y = 0; y < c.height; y += 2) {
    const k = y / c.height;
    const i = Math.floor((Math.sin(k * 19 + seed) * 0.5 + 0.5 + k * 2.3) * colors.length) % colors.length;
    g.fillStyle = colors[i];
    g.fillRect(0, y, c.width, 2);
  }
  // soft streaks and a big storm spot
  g.globalAlpha = 0.18;
  for (let i = 0; i < 40; i++) {
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    g.fillRect(rnd() * 256, rnd() * 128, 40 + rnd() * 120, 1 + rnd() * 3);
  }
  g.globalAlpha = 0.55;
  g.fillStyle = colors[3] || colors[1];
  g.beginPath();
  g.ellipse(80 + rnd() * 100, 70 + rnd() * 20, 18, 8, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// the ring: bright and dark stripes from the inside out, with gaps
function ringTexture(color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4;
  const g = c.getContext('2d');
  const col = new THREE.Color(color);
  for (let x = 0; x < 256; x++) {
    const k = x / 256;
    const gap = Math.abs(k - 0.62) < 0.025 ? 0.08 : 1; // a dark gap, like Saturn's
    const a = (0.35 + 0.45 * Math.abs(Math.sin(k * 41)) * (0.6 + 0.4 * Math.sin(k * 7))) * gap * Math.min(1, k * 8, (1 - k) * 6);
    const b = 0.75 + 0.25 * Math.sin(k * 23);
    g.fillStyle = `rgba(${(col.r * 255 * b) | 0},${(col.g * 255 * b) | 0},${(col.b * 255 * b) | 0},${a.toFixed(3)})`;
    g.fillRect(x, 0, 1, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// lit from a fixed side, a little light on the dark side, a glowing rim (the atmosphere)
const planetVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const planetFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  uniform vec3 uRim;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float lit = 0.22 + 0.95 * smoothstep(-0.15, 0.6, dot(n, uLight));
    float rim = pow(1.0 - max(0.0, dot(n, normalize(vView))), 3.0);
    vec3 col = texture2D(uMap, vUv).rgb * lit + uRim * rim * 0.9;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const sphere = new THREE.SphereGeometry(1, 48, 32);
const LIGHT = new THREE.Vector3(0.6, 0.45, 0.65).normalize();

function ringGeometry(inner, outer) {
  const g = new THREE.RingGeometry(inner, outer, 96, 1);
  // u from the inside out, so the stripe texture runs round the ring
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - inner) / (outer - inner), 0.5);
  }
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Planets {
  constructor(scene) {
    this.group = new THREE.Group();
    this.planets = PLANETS.map(([x, y, z, r, colors, ringColor, tx, tz], i) => {
      const holder = new THREE.Group();
      holder.position.set(x, y, z);
      holder.rotation.set(tx, i * 0.7, tz);
      const body = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
        uniforms: { uMap: { value: bandTexture(colors, 97 + i * 31) }, uLight: { value: LIGHT }, uRim: { value: new THREE.Color(colors[2]) } },
        vertexShader: planetVertex, fragmentShader: planetFragment, fog: false,
      }));
      body.scale.setScalar(r);
      body.renderOrder = -5;
      body.frustumCulled = false;
      holder.add(body);
      if (ringColor) {
        const ring = new THREE.Mesh(ringGeometry(r * 1.35, r * 2.25), new THREE.MeshBasicMaterial({
          map: ringTexture(ringColor), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
        }));
        ring.renderOrder = -4;
        ring.frustumCulled = false;
        holder.add(ring);
      }
      this.group.add(holder);
      return { holder, body, spin: 0.01 + (i % 3) * 0.006 };
    });
    scene.add(this.group);
  }

  update(dt) {
    for (const p of this.planets) p.body.rotation.y += dt * p.spin;
  }
}
