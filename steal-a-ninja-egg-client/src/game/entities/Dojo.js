// Brown Ninja's Dojo: the whole first stage is one long dojo hall (like the video). Two long white
// wings with dark timber frames and paper-screen windows run either side of the way in, brown tiled
// gable roofs on top, big beams across the open middle with paper lanterns hanging from them, a sandy
// studded floor, red star banners on the walls, and over the entrance the big wooden sign ("??? Night
// Event / Starts in: 4:12"). Just inside, the stage's name board hangs from a beam. The training gear
// inside (punching bags, wooden dummies, mats, bonsai trees) is the stage's decor in BiomeCorridor.js.
//
// buildDojo returns setClock(night, secondsLeft), which redraws the sign's countdown.

import * as THREE from 'three';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI } from '../util/canvasText.js';
import { BIOMES, WORLD } from '../../shared/gameData.js';

export const DOJO_FRONT_Z = WORLD.lineZ + 3;   // the front of the hall, just in front of the safe-zone line
export const DOJO_BACK_Z = BIOMES[1].maxZ;     // the back: where the second stage (the garden) starts
const FRONT_Z = DOJO_FRONT_Z;
const BACK_Z = DOJO_BACK_Z;
const DEPTH = FRONT_Z - BACK_Z;
const MID_Z = (FRONT_Z + BACK_Z) / 2;
const INNER_X = WORLD.corridorHalf - 2; // the wings' inner walls (just inside the corridor walls)
const OUTER_X = 150;
const WALL_H = 66;                  // the wings' walls; the roof (and its ridge) are above the corridor walls
const RIDGE_X = (INNER_X + OUTER_X) / 2;
const RIDGE_Y = 90;
const EAVE_IN = { x: INNER_X - 5, y: WALL_H };
const EAVE_OUT = { x: OUTER_X + 4, y: 70 };
const BEAM_Y = 60;
const BAY = 22;                     // timber posts along the walls this far apart
const TIMBER = '#3b2416';
const BEAM = '#4e2a18';
const PLASTER = '#f3efe6';

const repeat = (tex, u, v) => {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(u, v);
  t.needsUpdate = true;
  return t;
};

// White plaster with a dark timber frame and a grid of paper-screen windows (one bay).
function shojiTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = PLASTER;
  g.fillRect(0, 0, 256, 256);
  // the window: pale studded panels with a dark lattice
  g.fillStyle = '#e8ecf2';
  g.fillRect(14, 14, 228, 228);
  g.fillStyle = 'rgba(120,130,150,0.18)';
  for (let x = 22; x < 242; x += 14) for (let y = 22; y < 242; y += 14) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2b2a33';
  for (let i = 0; i <= 3; i++) g.fillRect(14 + i * 74, 14, 6, 228);
  for (let j = 0; j <= 3; j++) g.fillRect(14, 14 + j * 74, 228, 6);
  // the timber frame round the bay
  g.fillStyle = TIMBER;
  g.fillRect(0, 0, 256, 14);
  g.fillRect(0, 0, 14, 256);
  g.fillRect(242, 0, 14, 256);
  g.fillRect(0, 242, 256, 14);
  return canvasTexture(c);
}

// The front of each wing: plaster with a big timber grid.
function timberTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = PLASTER;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = TIMBER;
  g.fillRect(0, 0, 256, 16);
  g.fillRect(0, 120, 256, 12);
  g.fillRect(0, 0, 16, 256);
  g.fillRect(120, 0, 12, 256);
  return canvasTexture(c);
}

// Brown roof tiles in rows.
function roofTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#7d3a24';
  g.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 4; row++) {
    g.fillStyle = '#5e2a19';
    g.fillRect(0, row * 32 + 26, 128, 6);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(0, row * 32, 128, 6);
    g.fillStyle = '#6a3020';
    for (let i = 0; i < 4; i++) g.fillRect(i * 32 + (row % 2) * 16, row * 32, 3, 26);
  }
  return canvasTexture(c);
}

// The sandy studded floor (the video's tan bricks), in big tiles with a faint seam.
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d8b884';
  g.fillRect(0, 0, 128, 128);
  for (let x = 8; x < 128; x += 16) {
    for (let y = 8; y < 128; y += 16) {
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath(); g.arc(x - 1, y - 1, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(110,70,30,0.22)';
      g.beginPath(); g.arc(x + 1, y + 1.5, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8b884';
      g.beginPath(); g.arc(x, y, 4.4, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = 'rgba(90,60,30,0.12)';
  g.fillRect(0, 0, 128, 2);
  g.fillRect(0, 0, 2, 128);
  return canvasTexture(c);
}

// A dark red banner with a gold star, and a lighter tail.
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#5a1c14';
  g.fillRect(0, 0, 128, 320);
  g.fillStyle = '#8a2e1e';
  g.fillRect(10, 10, 108, 180);
  g.fillRect(10, 200, 108, 100);
  g.fillStyle = '#ffcc33';
  g.fillRect(0, 0, 128, 12);
  g.fillRect(0, 192, 128, 6);
  g.strokeStyle = '#6a4200';
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 18 : 42;
    g[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 100 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
  // the tail: a notch cut out of the bottom
  g.clearRect(40, 290, 48, 30);
  g.fillStyle = '#5a1c14';
  g.beginPath(); g.moveTo(40, 290); g.lineTo(64, 318); g.lineTo(88, 290); g.fill();
  return canvasTexture(c);
}

let bannerMaterial = null;
function banner(width, height) {
  if (!bannerMaterial) bannerMaterial = new THREE.MeshLambertMaterial({ map: bannerTexture(), transparent: true, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), bannerMaterial);
}

function addWing(scene, v, side) {
  const width = OUTER_X - INNER_X;
  const shoji = shojiTexture(), timber = timberTexture();
  const plain = new THREE.MeshLambertMaterial({ color: PLASTER });
  const inner = new THREE.MeshLambertMaterial({ map: repeat(shoji, DEPTH / BAY, WALL_H / 22) });
  const front = new THREE.MeshLambertMaterial({ map: repeat(timber, width / 22, WALL_H / 22) });
  // BoxGeometry faces: +x -x +y -y +z -z
  const materials = [plain, plain, plain, plain, front, front];
  if (side > 0) materials[1] = inner; else materials[0] = inner;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_H, DEPTH), materials);
  wing.position.set(side * (INNER_X + width / 2), WALL_H / 2, MID_Z);
  wing.castShadow = wing.receiveShadow = true;
  scene.add(wing);

  // a dark red-brown brick base along the inner wall with a gold line on top (like the video), and
  // timber posts between the bays (merged into the voxels)
  v.box(side * (INNER_X - 0.6), 0, MID_Z, 1.4, 9, DEPTH, '#5a2a1c');
  v.box(side * (INNER_X - 0.7), 9, MID_Z, 1.6, 0.7, DEPTH, '#ffcc33');
  for (let z = FRONT_Z; z >= BACK_Z - 0.1; z -= BAY) v.box(side * (INNER_X - 0.6), 0, z, 2, WALL_H, 2, TIMBER);

  // the roof: two sloped halves meeting at a ridge along the wing, hanging over the ends
  const roofMap = roofTexture();
  const slope = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const mat = new THREE.MeshLambertMaterial({ map: repeat(roofMap, len / 10, (DEPTH + 10) / 10) });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 2, DEPTH + 10), mat);
    slab.position.set(side * (a.x + b.x) / 2, (a.y + b.y) / 2 + 1, MID_Z);
    slab.rotation.z = side * Math.atan2(b.y - a.y, b.x - a.x);
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
  };
  slope(EAVE_IN, { x: RIDGE_X, y: RIDGE_Y });
  slope({ x: RIDGE_X, y: RIDGE_Y }, EAVE_OUT);
  v.box(side * RIDGE_X, RIDGE_Y, MID_Z, 4, 3, DEPTH + 12, '#4a2016');
  // the white gable under the roof at both ends
  const gable = new THREE.Shape();
  gable.moveTo(side * INNER_X, WALL_H);
  gable.lineTo(side * RIDGE_X, RIDGE_Y - 1);
  gable.lineTo(side * OUTER_X, 72);
  gable.lineTo(side * OUTER_X, WALL_H);
  gable.closePath();
  const gableMesh = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshLambertMaterial({ color: PLASTER, side: THREE.DoubleSide }));
  for (const z of [FRONT_Z + 0.05, BACK_Z - 0.05]) {
    const m = gableMesh.clone();
    m.position.z = z;
    scene.add(m);
  }

  // a star banner on the front, and red star banners on the inner wall every other bay
  const front1 = banner(10, 25);
  front1.position.set(side * (INNER_X + width * 0.62), 30, FRONT_Z + 0.2);
  scene.add(front1);
  let k = 0;
  for (let z = FRONT_Z - BAY * 1.5; z > BACK_Z + BAY; z -= BAY * 2, k++) {
    const b = banner(8, 20);
    b.position.set(side * (INNER_X - 1.3), 30 + (k % 2) * 4, z);
    b.rotation.y = -side * Math.PI / 2; // facing into the hall
    scene.add(b);
  }
}

function signTexture(w = 1024, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { canvas: c, texture: canvasTexture(c) };
}

function drawSign(sign, title, line) {
  const g = sign.canvas.getContext('2d');
  const { width: w, height: h } = sign.canvas;
  g.fillStyle = '#7a4326';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#5e311a';
  g.fillRect(14, 14, w - 28, h - 28);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 30; y < h - 20; y += 26) g.fillRect(14, y, w - 28, 3);
  drawOutlinedText(g, title.text, w / 2, 92, { size: 84, fill: title.fill, stroke: '#1a0c04', strokeWidth: 12, font: FONT_TITLE, weight: 400 });
  drawOutlinedText(g, line, w / 2, 190, { size: 56, fill: '#ffffff', stroke: '#1a0c04', strokeWidth: 9, font: FONT_UI });
  sign.texture.needsUpdate = true;
}

const signBoard = (W, H, texture) => new THREE.Mesh(new THREE.BoxGeometry(W, H, 1.6), [
  ...Array(4).fill(new THREE.MeshLambertMaterial({ color: '#5e311a' })),
  new THREE.MeshBasicMaterial({ map: texture }),
  new THREE.MeshLambertMaterial({ color: '#5e311a' }),
]);

// The big sign over the entrance on two ropes from the front beam.
function addSign(scene, v) {
  const W = 72, H = 18, Y = 50;
  const sign = signTexture();
  const board = signBoard(W, H, sign.texture);
  board.position.set(0, Y, FRONT_Z + 3);
  board.castShadow = true;
  scene.add(board);
  for (const s of [-1, 1]) v.box(s * W * 0.38, Y + H / 2, FRONT_Z + 3, 0.6, BEAM_Y + 8 - (Y + H / 2), 0.6, '#2a1a10');
  return sign;
}

// The stage's name board, hanging from the second beam inside: "Brown Ninja's Dojo" with a gold
// ninja-star badge, and "Recommended: 0 Speed" under it.
function addNameBoard(scene, v, z) {
  const W = 46, H = 9, Y = BEAM_Y - 13;
  const sign = signTexture(1024, 200);
  const g = sign.canvas.getContext('2d');
  g.fillStyle = '#4a2416';
  g.fillRect(0, 0, 1024, 200);
  g.fillStyle = '#6e3a20';
  g.fillRect(10, 10, 1004, 180);
  g.strokeStyle = '#ffcc33';
  g.lineWidth = 6;
  g.strokeRect(22, 22, 980, 156);
  drawOutlinedText(g, BIOMES[0].name, 470, 92, { size: 96, fill: '#ffd36a', stroke: '#1a0c04', strokeWidth: 14, font: FONT_TITLE, weight: 400 });
  drawOutlinedText(g, 'Recommended: ⚡0 Speed · EASY', 470, 160, { size: 40, fill: '#7dff3f', stroke: '#1a0c04', strokeWidth: 8, font: FONT_UI, weight: 800 });
  // the badge: a four-pointed throwing star in a gold ring
  g.save();
  g.translate(912, 100);
  g.fillStyle = '#ffcc33';
  g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7a3a1e';
  g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e8f0';
  g.strokeStyle = '#1a0c04';
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 4, r = i % 2 ? 14 : 48;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#1a0c04';
  g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill();
  g.restore();
  sign.texture.needsUpdate = true;
  const board = signBoard(W, H, sign.texture);
  board.position.set(0, Y, z + 1.2);
  scene.add(board);
  for (const s of [-1, 1]) v.box(s * W * 0.4, Y + H / 2, z + 1.2, 0.5, BEAM_Y - (Y + H / 2), 0.5, '#2a1a10');
}

// Beams across the middle of the hall, the big front beam, and paper lanterns hanging under them.
function addBeams(v, lamps) {
  v.box(0, WALL_H, FRONT_Z + 2, OUTER_X * 2 + 8, 6, 5, BEAM);
  v.box(0, BEAM_Y + 6.5, FRONT_Z + 3, INNER_X * 2, 3, 3, BEAM);
  let i = 0;
  const beams = [];
  for (let z = FRONT_Z - 14; z > BACK_Z + 4; z -= 20, i++) {
    beams.push(z);
    v.box(0, BEAM_Y - 2, z, INNER_X * 2, 4, 3, BEAM);
    v.box(0, BEAM_Y + 2, z, INNER_X * 2, 0.5, 3.2, '#c8901e'); // a thin gold edge on top (the video's yellow beams)
    for (const x of i % 2 ? [-30, 30] : [-56, 0, 56]) {
      if (i === 1 && Math.abs(x) < 40) continue; // the name board hangs here
      v.box(x, BEAM_Y - 5, z, 0.3, 3, 0.3, '#2a1a10');
      v.box(x, BEAM_Y - 5.4, z, 2.8, 0.5, 2.8, '#3a2414');
      lamps.box(x, BEAM_Y - 9.2, z, 2.4, 3.8, 2.4, '#fff3c4'); // lit at night
      lamps.halo(x, BEAM_Y - 7.3, z, 14, '#ffe0a0');
      v.box(x, BEAM_Y - 9.6, z, 2.8, 0.5, 2.8, '#3a2414');
    }
  }
  // two long beams along the hall, holding the cross beams
  for (const s of [-1, 1]) v.box(s * 44, BEAM_Y + 2, MID_Z, 3, 3, DEPTH, BEAM);
  return beams;
}

function addFloor(scene) {
  const tex = repeat(floorTexture(), (INNER_X * 2) / 8, DEPTH / 8);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(INNER_X * 2, DEPTH), new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.06, MID_Z);
  floor.receiveShadow = true;
  scene.add(floor);
}

// A see-through glass roof over the open middle of the hall, resting on the beams.
function addGlassRoof(scene) {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(INNER_X * 2, DEPTH), new THREE.MeshLambertMaterial({
    color: '#cfe8ff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide,
  }));
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, BEAM_Y + 5.6, MID_Z);
  glass.renderOrder = 3;
  scene.add(glass);
}

export function buildDojo(scene, v, physics, lamps) {
  for (const side of [-1, 1]) {
    addWing(scene, v, side);
    physics.addBox(side * INNER_X, side * OUTER_X, WORLD.lineZ - 1, FRONT_Z); // the part standing out into the lobby
  }
  const beams = addBeams(v, lamps);
  addGlassRoof(scene);
  addFloor(scene);
  addNameBoard(scene, v, beams[1]);
  const sign = addSign(scene, v);
  let shown = '';
  const setClock = (night, left) => {
    const s = Math.max(0, Math.ceil(left || 0));
    const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const key = `${night}|${time}`;
    if (key === shown) return;
    shown = key;
    if (night) drawSign(sign, { text: 'NIGHT EVENT!', fill: '#c89bff' }, `Ends in: ${time}`);
    else drawSign(sign, { text: '??? Night Event', fill: '#ffb21f' }, `Starts in: ${time}`);
  };
  setClock(false, 0);
  return setClock;
}
