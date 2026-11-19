// The dojo hall over the mouth of the corridor (like the video): two long white wings with dark
// timber frames and paper-screen windows either side of the way in, brown tiled gable roofs on
// top, big beams across the open middle with paper lanterns hanging from them, a wooden plank
// floor, barrels and wooden training dummies along the sides, star banners on the front, and the
// big wooden sign hanging over the entrance ("??? Night Event / Starts in: 4:12").
//
// buildDojo returns setClock(night, secondsLeft), which redraws the sign's countdown.

import * as THREE from 'three';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI } from '../util/canvasText.js';
import { WORLD } from '../../shared/gameData.js';

const FRONT_Z = WORLD.lineZ + 3;    // the front of the hall, just in front of the safe-zone line
const DEPTH = 130;                  // how far the hall runs up the corridor
const BACK_Z = FRONT_Z - DEPTH;
const INNER_X = WORLD.corridorHalf - 2; // the wings' inner walls (just inside the corridor walls)
const OUTER_X = 150;
const WALL_H = 66;                  // the wings' walls; the roof (and its ridge) are above the corridor walls
const RIDGE_X = (INNER_X + OUTER_X) / 2;
const RIDGE_Y = 90;
const EAVE_IN = { x: INNER_X - 5, y: WALL_H };
const EAVE_OUT = { x: OUTER_X + 4, y: 70 };
const BEAM_Y = 60;
const TIMBER = '#3b2416';
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
  // the window: a pale panel with a fine dark lattice
  g.fillStyle = '#e4e8ee';
  g.fillRect(28, 40, 200, 150);
  g.fillStyle = '#2b2a33';
  for (let i = 0; i <= 5; i++) g.fillRect(28 + i * 39, 40, 5, 150);
  for (let j = 0; j <= 4; j++) g.fillRect(28, 40 + j * 36.5, 200, 5);
  // the timber frame round the bay and a rail under the window
  g.fillStyle = TIMBER;
  g.fillRect(0, 0, 256, 14);
  g.fillRect(0, 242, 256, 14);
  g.fillRect(0, 0, 14, 256);
  g.fillRect(242, 0, 14, 256);
  g.fillRect(0, 204, 256, 10);
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

// Light wooden planks in a checker (the hall's floor).
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const tones = ['#dcbc8c', '#ccaa78'];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = tones[(i + j) % 2];
    g.fillRect(i * 64, j * 64, 64, 64);
  }
  g.fillStyle = 'rgba(90,60,30,0.18)';
  for (let k = 0; k < 8; k++) g.fillRect(0, k * 16, 128, 2);
  return canvasTexture(c);
}

// A dark brown banner with a gold star.
function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#4a2416';
  g.fillRect(0, 0, 128, 320);
  g.fillStyle = '#7a3a22';
  g.fillRect(10, 10, 108, 300);
  g.fillStyle = '#ffcc33';
  g.strokeStyle = '#6a4200';
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 18 : 42;
    g[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 120 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.stroke();
  return canvasTexture(c);
}

function addWing(scene, side) {
  const width = OUTER_X - INNER_X;
  const shoji = shojiTexture(), timber = timberTexture();
  const plain = new THREE.MeshLambertMaterial({ color: PLASTER });
  const inner = new THREE.MeshLambertMaterial({ map: repeat(shoji, DEPTH / 22, 2) });
  const front = new THREE.MeshLambertMaterial({ map: repeat(timber, width / 22, WALL_H / 22) });
  // BoxGeometry faces: +x -x +y -y +z -z
  const materials = [plain, plain, plain, plain, front, front];
  if (side > 0) materials[1] = inner; else materials[0] = inner;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_H, DEPTH), materials);
  wing.position.set(side * (INNER_X + width / 2), WALL_H / 2, (FRONT_Z + BACK_Z) / 2);
  wing.castShadow = wing.receiveShadow = true;
  scene.add(wing);

  // a dark base along the inner wall and timber posts between the bays
  const postMaterial = new THREE.MeshLambertMaterial({ color: TIMBER });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, DEPTH), postMaterial);
  base.position.set(side * (INNER_X - 0.5), 2, (FRONT_Z + BACK_Z) / 2);
  scene.add(base);
  const postGeometry = new THREE.BoxGeometry(2, WALL_H, 2);
  for (let z = FRONT_Z; z >= BACK_Z; z -= 22) {
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.set(side * (INNER_X - 0.6), WALL_H / 2, z);
    post.castShadow = true;
    scene.add(post);
  }

  // the roof: two sloped halves meeting at a ridge along the wing, hanging over the ends
  const roofMap = roofTexture();
  const slope = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const mat = new THREE.MeshLambertMaterial({ map: repeat(roofMap, len / 10, (DEPTH + 10) / 10) });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 2, DEPTH + 10), mat);
    slab.position.set(side * (a.x + b.x) / 2, (a.y + b.y) / 2 + 1, (FRONT_Z + BACK_Z) / 2);
    slab.rotation.z = side * Math.atan2(b.y - a.y, b.x - a.x);
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
  };
  slope(EAVE_IN, { x: RIDGE_X, y: RIDGE_Y });
  slope({ x: RIDGE_X, y: RIDGE_Y }, EAVE_OUT);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(4, 3, DEPTH + 12), new THREE.MeshLambertMaterial({ color: '#4a2016' }));
  ridge.position.set(side * RIDGE_X, RIDGE_Y + 1.5, (FRONT_Z + BACK_Z) / 2);
  scene.add(ridge);
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

  // a star banner on the front
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(10, 25), new THREE.MeshLambertMaterial({ map: bannerTexture() }));
  banner.position.set(side * (INNER_X + width * 0.62), 30, FRONT_Z + 0.2);
  scene.add(banner);
}

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
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

// The big sign over the entrance on two ropes from the front beam.
function addSign(scene) {
  const W = 72, H = 18, Y = 50;
  const sign = signTexture();
  const board = new THREE.Mesh(new THREE.BoxGeometry(W, H, 1.6), [
    ...Array(4).fill(new THREE.MeshLambertMaterial({ color: '#5e311a' })),
    new THREE.MeshBasicMaterial({ map: sign.texture }),
    new THREE.MeshLambertMaterial({ color: '#5e311a' }),
  ]);
  board.position.set(0, Y, FRONT_Z + 3);
  board.castShadow = true;
  scene.add(board);
  const ropeMaterial = new THREE.MeshLambertMaterial({ color: '#2a1a10' });
  for (const s of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.6, BEAM_Y + 8 - (Y + H / 2), 0.6), ropeMaterial);
    rope.position.set(s * W * 0.38, (BEAM_Y + 8 + Y + H / 2) / 2, FRONT_Z + 3);
    scene.add(rope);
  }
  return sign;
}

// Beams across the middle of the hall, the big front beam, and paper lanterns hanging under them.
function addBeams(scene) {
  const beamMaterial = new THREE.MeshLambertMaterial({ color: '#4e2a18' });
  const front = new THREE.Mesh(new THREE.BoxGeometry(OUTER_X * 2 + 8, 6, 5), beamMaterial);
  front.position.set(0, WALL_H + 3, FRONT_Z + 2);
  front.castShadow = true;
  scene.add(front);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(INNER_X * 2, 3, 3), beamMaterial);
  lower.position.set(0, BEAM_Y + 8, FRONT_Z + 3);
  scene.add(lower);
  const beamGeometry = new THREE.BoxGeometry(INNER_X * 2, 4, 3);
  const lanternGeometry = new THREE.BoxGeometry(2.4, 3.2, 2.4);
  const lanternMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
  const cordGeometry = new THREE.BoxGeometry(0.3, 6, 0.3);
  const cordMaterial = new THREE.MeshLambertMaterial({ color: '#2a1a10' });
  let i = 0;
  for (let z = FRONT_Z - 14; z > BACK_Z; z -= 20, i++) {
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, BEAM_Y, z);
    beam.castShadow = true;
    scene.add(beam);
    for (const x of i % 2 ? [-30, 30] : [-56, 0, 56]) {
      const cord = new THREE.Mesh(cordGeometry, cordMaterial);
      cord.position.set(x, BEAM_Y - 3, z);
      const lantern = new THREE.Mesh(lanternGeometry, lanternMaterial);
      lantern.position.set(x, BEAM_Y - 7.6, z);
      scene.add(cord, lantern);
    }
  }
  // two long beams along the hall, holding the cross beams
  for (const s of [-1, 1]) {
    const long = new THREE.Mesh(new THREE.BoxGeometry(3, 3, DEPTH), beamMaterial);
    long.position.set(s * 44, BEAM_Y + 3.5, (FRONT_Z + BACK_Z) / 2);
    scene.add(long);
  }
}

function addFloor(scene) {
  const tex = repeat(floorTexture(), (INNER_X * 2) / 16, DEPTH / 16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(INNER_X * 2, DEPTH), new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.06, (FRONT_Z + BACK_Z) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
}

// Barrels and wooden training dummies along both sides of the hall (they stop the player).
function addProps(v, physics) {
  const WOOD = '#8a5230', BAND = '#3a2a20', DUMMY = '#a8683a';
  for (const side of [-1, 1]) {
    const x = side * (INNER_X - 10);
    for (let z = FRONT_Z - 12, i = 0; z > BACK_Z + 8; z -= 18, i++) {
      if (i % 2 === 0) {
        // a barrel
        v.box(x, 0, z, 4.4, 6, 4.4, WOOD);
        v.box(x, 1, z, 4.7, 0.6, 4.7, BAND);
        v.box(x, 4.4, z, 4.7, 0.6, 4.7, BAND);
        physics.addCircle(x, z, 2.6);
      } else {
        // a training dummy: a post on a square foot with three arms
        v.box(x, 0, z, 4.6, 0.8, 4.6, '#6e3e22');
        v.box(x, 0.8, z, 1.8, 10, 1.8, DUMMY);
        v.box(x - side * 1.6, 6.5, z, 3.4, 0.7, 0.7, DUMMY, { rz: side * 0.2 });
        v.box(x - side * 1.6, 8.3, z + 0.9, 3.4, 0.7, 0.7, DUMMY, { rz: side * 0.2 });
        v.box(x - side * 1.6, 4, z, 3.6, 0.7, 0.7, DUMMY, { rz: -side * 0.3 });
        physics.addCircle(x, z, 2.2);
      }
    }
  }
}

export function buildDojo(scene, v, physics) {
  for (const side of [-1, 1]) {
    addWing(scene, side);
    physics.addBox(side * INNER_X, side * OUTER_X, WORLD.lineZ - 1, FRONT_Z); // the part standing out into the lobby
  }
  addBeams(scene);
  addFloor(scene);
  addProps(v, physics);
  const sign = addSign(scene);
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
