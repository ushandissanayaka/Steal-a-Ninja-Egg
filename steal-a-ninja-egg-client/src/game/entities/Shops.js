// Market stalls, the fusion machine and the three leaderboards.

import * as THREE from 'three';
import { canvasTexture, drawOutlinedText, makeBillboard, FONT_UI } from '../util/canvasText.js';
import { glowMap } from './Effects.js';
import { Voxels } from '../util/bake.js';

const WOOD = '#e0a94a';
const SHOP_SCALE = 2.4;
const BULBS_PER_EDGE = 11;
const BULB_SIZE = 3.4;
const BOARD_WIDTH = 26;
const BOARD_HEIGHT = 50;
const BOARD_GLOW_MARGIN = 6;
const S = SHOP_SCALE;

// A glowing ring around a floor disc, with highlights circling it.
const ringVertex = 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vP;

  void main() {
    float k = (length(vP) - uInner) / (uOuter - uInner); // 0 at the disc edge
    float edge = smoothstep(-0.06, 0.03, k) * exp(-max(k, 0.0) * 4.5);
    float sweep = pow(0.5 + 0.5 * sin(atan(vP.y, vP.x) * 3.0 - uTime * 2.4), 10.0);
    float pulse = 0.82 + 0.18 * sin(uTime * 3.0);
    float shine = edge * (pulse + sweep * 1.4);
    gl_FragColor = vec4(mix(uColor, vec3(1.0), clamp(sweep * 0.7, 0.0, 1.0)) * shine, clamp(shine, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

export function addGlowRing(scene, x, z, radius, color) {
  const inner = radius - 0.4, outer = radius + 3.5 * S;
  const uniforms = {
    uColor: { value: new THREE.Color(color) }, uTime: { value: 0 },
    uInner: { value: radius }, uOuter: { value: outer },
  };
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 64, 1),
    new THREE.ShaderMaterial({
      uniforms, vertexShader: ringVertex, fragmentShader: ringFragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.18, z);
  ring.renderOrder = 2;
  scene.add(ring);
  return (time) => { uniforms.uTime.value = time; };
}

// A string of light bulbs that chase along the given points.
function addBulbs(scene, points, colors) {
  const tints = points.map((_, i) => new THREE.Color(colors[i % colors.length]));
  const positions = new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]));
  const lit = new Float32Array(points.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(lit, 3));
  const bulbs = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: glowMap(), size: BULB_SIZE, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(bulbs);
  return (time) => {
    tints.forEach((tint, i) => {
      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(i * 1.3 - time * 5)) ** 3;
      lit[i * 3] = tint.r * glow;
      lit[i * 3 + 1] = tint.g * glow;
      lit[i * 3 + 2] = tint.b * glow;
    });
    geometry.attributes.color.needsUpdate = true;
  };
}

// Every shop returns an update(time) that animates its shine.
export function addStall(scene, v, physics, { x, z, name, color, fill }) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9.5 * S, 40), new THREE.MeshLambertMaterial({ color }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0.12, z);
  scene.add(floor);

  const postX = 5.4 * S, postZ = 3.6 * S;
  for (const sx of [-postX, postX]) for (const sz of [-postZ, postZ]) v.box(x + sx, 0, z + sz, 0.9 * S, 8 * S, 0.9 * S, WOOD);
  v.box(x, 3 * S, z - postZ, 11 * S, 0.7 * S, 0.7 * S, WOOD);
  v.box(x, 3 * S, z + postZ, 11 * S, 0.7 * S, 0.7 * S, WOOD);

  const stripes = 7;
  const width = 12.6 * S;
  for (let i = 0; i < stripes; i++) {
    const sx = x - width / 2 + ((i + 0.5) / stripes) * width;
    v.box(sx, 8 * S, z, width / stripes, 0.9 * S, 10 * S, i % 2 ? '#ffffff' : color, { rx: 0.1 });
  }

  const label = makeBillboard([{ text: name, size: 78, fill }], 3.5 * S);
  label.position.set(x, 12.6 * S, z);
  scene.add(label);
  const half = 0.6 * S;
  for (const sx of [-postX, postX]) for (const sz of [-postZ, postZ]) physics.addBox(x + sx - half, x + sx + half, z + sz - half, z + sz + half);

  const bulbPoints = [];
  for (const edge of [-1, 1]) {
    for (let i = 0; i < BULBS_PER_EDGE; i++) {
      const bx = x - width / 2 + (i / (BULBS_PER_EDGE - 1)) * width;
      bulbPoints.push(new THREE.Vector3(bx, 7.8 * S + edge * 0.5 * S * 0.1, z + edge * 5.15 * S));
    }
  }
  const ring = addGlowRing(scene, x, z, 9.5 * S, fill);
  const bulbs = addBulbs(scene, bulbPoints, ['#fff4b8', fill]);
  return (time) => { ring(time); bulbs(time); };
}

export function addFreePad(scene, x, z) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5.6 * S, 32), new THREE.MeshLambertMaterial({ color: '#ffd21f' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, 0.12, z);
  scene.add(floor);
  const label = makeBillboard([{ text: 'FREE!', size: 70, fill: '#ffe33a' }], 2.4 * S);
  label.position.set(x, 7.2 * S, z);
  scene.add(label);
  const chest = buildFreeChest();
  chest.position.set(x, 0.4, z);
  scene.add(chest);
  const ring = addGlowRing(scene, x, z, 5.6 * S, '#ffe33a');
  // the chest turns slowly and hops a little; stepping on the pad claims the free gift
  return (time) => {
    ring(time);
    chest.rotation.y = time * 0.6;
    chest.position.y = 0.4 + Math.abs(Math.sin(time * 2.2)) * 0.8;
  };
}

// A golden chest with blue glass panels (the free gift).
function buildFreeChest() {
  const v = new Voxels();
  const GOLD = '#ffcf33', GOLD_DARK = '#e0a21a', BLUE = '#4ac8ff';
  const w = 6.4, d = 4.6, h = 3.6;
  v.box(0, 0, 0, w, h, d, BLUE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) v.box(sx * (w / 2 - 0.35), 0, sz * (d / 2 - 0.35), 0.9, h + 0.1, 0.9, GOLD); // corner posts
  for (const y of [0, h - 0.7]) v.box(0, y, 0, w + 0.2, 0.8, d + 0.2, GOLD_DARK); // bottom and top rims
  v.box(0, 0, 0, 0.9, h + 0.1, d + 0.25, GOLD);  // the middle band
  // the lid: two sloped halves and a ridge
  for (const sz of [-1, 1]) v.box(0, h + 0.55, sz * d * 0.24, w + 0.2, 0.9, d * 0.56, BLUE, { rx: sz * 0.42 });
  v.box(0, h + 1.5, 0, w + 0.3, 0.8, 0.9, GOLD);
  for (const sx of [-1, 0, 1]) v.box(sx * (w / 2 - 0.4), h + 0.1, 0, 0.9, 1.4, d * 0.95, GOLD);
  v.box(0, h * 0.4, d / 2 + 0.2, 1.4, 1.6, 0.5, GOLD_DARK); // the lock
  const mesh = v.mesh();
  const group = new THREE.Group();
  mesh.scale.setScalar(S * 0.95);
  group.add(mesh);
  return group;
}

export function addFusionMachine(scene, v, physics, x, z) {
  const purple = '#7b2fd6';
  v.box(x, 0, z, 14 * S, 1 * S, 12 * S, '#5a20a8');
  v.box(x, 1 * S, z, 10 * S, 8 * S, 8 * S, purple);
  v.box(x, 9 * S, z, 7 * S, 5 * S, 6 * S, '#d9f3ff');
  v.box(x, 14 * S, z, 8.4 * S, 1.4 * S, 7.4 * S, '#ff66d0');
  v.box(x, 3.4 * S, z + 4.05 * S, 3.4 * S, 4 * S, 0.2 * S, '#fff27a');
  const label = makeBillboard([{ text: 'Fusion Machine', size: 64, fill: '#c98bff' }], 2.8 * S);
  label.position.set(x, 18.6 * S, z);
  scene.add(label);
  physics.addBox(x - 7 * S, x + 7 * S, z - 6 * S, z + 6 * S);

  const ring = addGlowRing(scene, x, z, 9.4 * S, '#c98bff');
  const corners = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let y = 1.5; y < 14; y += 2.1) corners.push(new THREE.Vector3(x + sx * 5.15 * S, y * S, z + sz * 4.15 * S));
  }
  const bulbs = addBulbs(scene, corners, ['#ff8ff0', '#9fe8ff', '#fff4b8']);
  return (time) => { ring(time); bulbs(time); };
}

function boardTexture(title, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * BOARD_HEIGHT) / BOARD_WIDTH);
  const g = c.getContext('2d');
  g.fillStyle = '#030305';
  g.fillRect(0, 0, c.width, c.height);
  drawOutlinedText(g, title, c.width / 2, 74, { size: 56, fill: color, font: FONT_UI, stroke: '#000000', strokeWidth: 3 });
  g.fillStyle = color;
  g.fillRect(36, 128, c.width - 72, 4);

  const rows = 10;
  const top = 150;
  const rowH = (c.height - top - 24) / rows;
  const medals = ['#ffd24a', '#dfe5ec', '#f09a55'];
  for (let i = 0; i < rows; i++) {
    const y = top + i * rowH;
    g.fillStyle = '#0d0f15';
    g.fillRect(24, y, c.width - 48, rowH - 10);
    g.strokeStyle = 'rgba(255,255,255,0.09)';
    g.lineWidth = 2;
    g.strokeRect(24, y, c.width - 48, rowH - 10);
    drawOutlinedText(g, `${i + 1}`, 72, y + (rowH - 10) / 2, { size: 40, fill: medals[i] || '#8e95a3', stroke: '#000000', strokeWidth: 2, font: FONT_UI });
  }
  return canvasTexture(c);
}

// The shining edge: a solid bright border, a soft halo on the wall around it, and
// highlights that travel around the frame. The middle of the plane is left empty.
const glowVertex = 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec2 uHalf;
  uniform float uTime;
  varying vec2 vP;

  void main() {
    vec2 q = abs(vP) - uHalf;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); // < 0 inside the board
    float border = smoothstep(-1.15, -0.95, d) * (1.0 - smoothstep(0.0, 0.12, d));
    float halo = d > 0.0 ? exp(-d * 0.75) : 0.0;
    float sweep = pow(0.5 + 0.5 * sin(atan(vP.y, vP.x) * 2.0 - uTime * 2.1), 14.0);
    float pulse = 0.88 + 0.12 * sin(uTime * 2.6);
    float shine = (border + halo * 0.75) * pulse + (border + halo * 0.4) * sweep * 1.5;
    vec3 color = mix(uColor, vec3(1.0), clamp(sweep * 0.85 + border * 0.18, 0.0, 1.0)) * shine;
    gl_FragColor = vec4(color, clamp(shine, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

// Leaderboard posters on the north wall (the wall you see from the start), side by side: each one
// a poster pinned onto a wooden frame of planks, with nails in the corners. boards: [{ x, title, color }].
// wallZ = the wall's inner face; they face +Z (into the lobby).
const FRAME = { plank: '#a8692f', plankDark: '#8a5424', back: '#6a3c1c', nail: '#c8ccd2' };
export function addWallPosters(scene, v, boards, wallZ, baseY = 10) {
  const W = BOARD_WIDTH, H = BOARD_HEIGHT;
  const fw = W + 6, fh = H + 6, rail = 2.4;
  const z0 = wallZ;
  for (const { x, title, color } of boards) {
    const cy = baseY + H / 2;
    // the backing boards: vertical planks in two tones
    const planks = 6;
    for (let i = 0; i < planks; i++) {
      const px = x - fw / 2 + (fw / planks) * (i + 0.5);
      v.box(px, cy - fh / 2, z0 + 0.5, fw / planks - 0.25, fh, 1, i % 2 ? FRAME.back : '#734222');
    }
    // the frame around it: thick rails, standing a little proud of the backing
    v.box(x, cy + fh / 2 - rail, z0 + 1.3, fw + 1, rail, 1.4, FRAME.plank);
    v.box(x, cy - fh / 2, z0 + 1.3, fw + 1, rail, 1.4, FRAME.plank);
    for (const side of [-1, 1]) v.box(x + side * (fw / 2 - rail / 2 + 0.5), cy - fh / 2, z0 + 1.3, rail, fh, 1.4, FRAME.plankDark);
    // a little shelf ledge under it and two support beams into the wall
    v.box(x, cy - fh / 2 - 1.2, z0 + 1.6, fw + 3, 1.2, 2.6, FRAME.plankDark);
    for (const side of [-1, 1]) v.box(x + side * (fw / 2 - 3), cy - fh / 2 - 4.2, z0 + 1, 1.4, 3, 1.4, FRAME.back, { rx: -0.5 });
    // nails in the four corners of the poster
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) v.box(x + sx * (W / 2 - 1), cy + sy * (H / 2 - 1) - 0.4, z0 + 2.15, 0.8, 0.8, 0.5, FRAME.nail);
    // the poster itself, pinned on the frame
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: boardTexture(title, color) }));
    face.position.set(x, cy, z0 + 2.05);
    scene.add(face);
    // a strip of the board's colour across the top of the frame, like a painted sign
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(fw - 2, 1.2), new THREE.MeshBasicMaterial({ color }));
    strip.position.set(x, cy + fh / 2 - rail / 2, z0 + 2.02);
    scene.add(strip);
  }
  return []; // no animated glow (the old neon boards had one)
}

// Boards hang on the east wall (the right side, seen from spawn) and face west.
// Returns the glow uniforms, which the game animates through uTime.
export function addLeaderboards(scene, v, boards, wallX) {
  const baseY = 3;
  const centerY = baseY + BOARD_HEIGHT / 2;
  return boards.map(({ z, title, color }) => {
    v.box(wallX - 0.5, baseY - 0.6, z, 1, BOARD_HEIGHT + 1.2, BOARD_WIDTH + 1.2, '#050507');
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT),
      new THREE.MeshBasicMaterial({ map: boardTexture(title, color) }),
    );
    face.rotation.y = -Math.PI / 2;
    face.position.set(wallX - 1.06, centerY, z);
    scene.add(face);

    const uniforms = {
      uColor: { value: new THREE.Color(color) },
      uHalf: { value: new THREE.Vector2(BOARD_WIDTH / 2, BOARD_HEIGHT / 2) },
      uTime: { value: 0 },
    };
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD_WIDTH + BOARD_GLOW_MARGIN * 2, BOARD_HEIGHT + BOARD_GLOW_MARGIN * 2),
      new THREE.ShaderMaterial({
        uniforms, vertexShader: glowVertex, fragmentShader: glowFragment,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    glow.rotation.y = -Math.PI / 2;
    glow.position.set(wallX - 1.5, centerY, z);
    glow.renderOrder = 2;
    scene.add(glow);
    return uniforms;
  });
}
