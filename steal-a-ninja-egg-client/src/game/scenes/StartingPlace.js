// The whole map. South of the safe-zone line: the lobby, built like the video - a big bright
// lime-green studded field inside thick brown brick walls with grass on top, the player plots in
// two rows of three (gates facing north), and along the north wall either side of the dojo: the
// Trails (cosmetic) shop, Sell and the Invite Friend pad on the left; the Free Gift, three arched
// leaderboards and the events board on the right. The dojo hall (Dojo.js) stands over the mouth
// of the corridor, with "SAFE ZONE" on the floor in front of it. North of the line: the corridor
// through the stages (BiomeCorridor.js).

import * as THREE from 'three';
import { ChunkedVoxels } from '../util/bake.js';
import { canvasTexture, drawOutlinedText } from '../util/canvasText.js';
import { CYCLE, NESTS, PLOTS, SHOPS, WORLD } from '../../shared/gameData.js';
import { PlotView } from '../entities/PlayerBase.js';
import { addArchBoards, addEventsBoard, addGiftPad, addStall } from '../entities/Shops.js';
import { buildDojo } from '../entities/Dojo.js';
import { buildBiomeCorridor } from './BiomeCorridor.js';

const { halfX, southZ, lineZ, northZ, openingHalf, wallHeight, corridorHalf } = WORLD;
const GROUND_TILE = 24;
const WALL_T = 16;                            // the lobby walls are thick, with grass on top
const LIME = ['#86ee30', '#7de629'];          // the lobby floor, a big two-tone checker
const GRASS_TOP = ['#62d62a', '#58cc24'];
const CLIFF = '#7a4a28';
const NORTH_WALL_DEPTH = WALL_T;
const LEADERBOARDS = [
  { x: 186, title: 'Top Money/s', color: '#36e83a', dark: '#0f6a1a' },
  { x: 220, title: 'Top Speed', color: '#26a8ff', dark: '#0a3f8a' },
  { x: 254, title: 'Top Playtime', color: '#ff2fb4', dark: '#7a0a52' },
];

function addGround(v) {
  let i = 0;
  for (let x = -halfX; x < halfX; x += GROUND_TILE, i++) {
    let j = 0;
    for (let z = lineZ; z < southZ; z += GROUND_TILE, j++) {
      const w = Math.min(GROUND_TILE, halfX - x), d = Math.min(GROUND_TILE, southZ - z);
      v.box(x + w / 2, -2, z + d / 2, w, 2, d, LIME[(i + j) % 2]);
    }
  }
  // the island's cliff under the lobby (with its walls) and under the corridor, seen from far away
  const outer = halfX + WALL_T;
  v.box(0, -34, (lineZ - WALL_T + southZ + WALL_T) / 2, outer * 2, 32, southZ - lineZ + WALL_T * 2, CLIFF);
  v.box(0, -34, (northZ + lineZ) / 2, (corridorHalf + 52) * 2, 32, lineZ - northZ + 4, CLIFF);
}

// Brown bricks in rows (with mortar lines and a few darker bricks), for the lobby walls.
function brickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6e3c2c';
  g.fillRect(0, 0, 128, 128);
  const tones = ['#9a5c47', '#94573f', '#a0624c', '#8c5240'];
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? 16 : 0;
    for (let i = -1; i < 4; i++) {
      g.fillStyle = tones[(row * 3 + i + 4) % tones.length];
      g.fillRect(i * 32 + offset + 1, row * 16 + 1, 30, 14);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let row = 0; row < 8; row++) g.fillRect(0, row * 16 + 1, 128, 2);
  return canvasTexture(c);
}

// The lobby walls: thick brick boxes (16 thick), with a stud-covered grass slab on top that
// hangs a little over the inner face. The north wall is in two parts, either side of the dojo.
function addLobbyWalls(scene, v, physics) {
  const bricks = brickTexture();
  const BRICK_W = 16, BRICK_H = 16; // world size of one texture repeat
  const wall = (cx, cz, w, d) => {
    const along = Math.max(w, d);
    const tex = bricks.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(along / BRICK_W, wallHeight / BRICK_H);
    tex.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.position.set(cx, wallHeight / 2, cz);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    // the grass on top, and its lip over the edges
    v.box(cx, wallHeight, cz, w + 2.4, 2.4, d + 2.4, GRASS_TOP[0]);
    v.box(cx, wallHeight - 1.6, cz, w + 1.2, 1.6, d + 1.2, GRASS_TOP[1]);
  };
  const outer = halfX + WALL_T;
  const fullZ = southZ - lineZ + WALL_T * 2;
  wall(-halfX - WALL_T / 2, (lineZ + southZ) / 2, WALL_T, fullZ);   // west
  wall(halfX + WALL_T / 2, (lineZ + southZ) / 2, WALL_T, fullZ);    // east
  wall(0, southZ + WALL_T / 2, outer * 2, WALL_T);                  // south
  for (const s of [-1, 1]) {                                        // north, either side of the dojo
    const from = openingHalf, to = halfX;
    wall(s * (from + to) / 2, lineZ - WALL_T / 2, to - from, WALL_T);
  }
  physics.addBox(-halfX, -openingHalf, lineZ - NORTH_WALL_DEPTH, lineZ + 1);
  physics.addBox(openingHalf, halfX, lineZ - NORTH_WALL_DEPTH, lineZ + 1);
}

// The corridor's walls stop the player (they are drawn by BiomeCorridor).
function addCorridorColliders(physics) {
  physics.addBox(-corridorHalf - 40, -corridorHalf, northZ - 10, lineZ);
  physics.addBox(corridorHalf, corridorHalf + 40, northZ - 10, lineZ);
  physics.addBox(-corridorHalf - 40, corridorHalf + 40, northZ - 20, northZ + 1);
}

// "SAFE ZONE" written big on the floor in front of the dojo between two blue shields (like the
// video), and a glowing light-blue strip along the dojo's front edge: the line itself.
function safeZoneTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d');
  const shield = (cx) => {
    g.save();
    g.translate(cx, 96);
    g.beginPath();
    g.moveTo(0, -70);
    g.lineTo(58, -50);
    g.lineTo(52, 10);
    g.quadraticCurveTo(32, 54, 0, 74);
    g.quadraticCurveTo(-32, 54, -52, 10);
    g.lineTo(-58, -50);
    g.closePath();
    g.fillStyle = '#2f7dff';
    g.strokeStyle = '#0c2f7a';
    g.lineWidth = 10;
    g.fill();
    g.stroke();
    g.scale(0.55, 0.55);
    g.beginPath();
    g.moveTo(0, -70);
    g.lineTo(58, -50);
    g.lineTo(52, 10);
    g.quadraticCurveTo(32, 54, 0, 74);
    g.quadraticCurveTo(-32, 54, -52, 10);
    g.lineTo(-58, -50);
    g.closePath();
    g.fillStyle = '#8fd2ff';
    g.fill();
    g.restore();
  };
  shield(80);
  shield(944);
  drawOutlinedText(g, 'SAFE ZONE', 512, 100, {
    size: 130, fill: '#ffffff', stroke: '#1b4fd0', strokeWidth: 20, font: '"Luckiest Guy", sans-serif', weight: 400, skewX: -0.18, glow: false,
  });
  return canvasTexture(c);
}

function addSafeZone(scene, glow) {
  glow.box(0, -0.02, lineZ + 3.6, openingHalf * 2, 0.16, 2.4, '#7fe8ff');
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(64, 12), new THREE.MeshLambertMaterial({
    map: safeZoneTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }));
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(0, 0.12, lineZ + 14);
  decal.renderOrder = 1;
  scene.add(decal);
}

export function buildStartingPlace(scene, physics, effects) {
  const v = new ChunkedVoxels();
  const glow = new ChunkedVoxels(); // unlit, so the safe-zone strip, lava and crystals seem to glow
  addGround(v);
  addLobbyWalls(scene, v, physics);
  addCorridorColliders(physics);
  addSafeZone(scene, glow);
  const setDojoClock = buildDojo(scene, v, physics);
  const { colliders = [] } = buildBiomeCorridor(scene, v, glow) || {};
  for (const c of colliders) {
    if (c.kind === 'circle') physics.addCircle(c.x, c.z, c.r);
    else physics.addBox(c.minX, c.maxX, c.minZ, c.maxZ);
  }

  const shine = [
    addStall(scene, v, physics, {
      ...SHOPS.trails, name: 'TRAILS', color: '#9a6232', stripe: '#fff6e8', fill: '#ffd06a', floor: '#e8c27a', bulbs: false,
      lines: [{ text: 'NEW!', size: 60, fill: '#ff2a2a' }, { text: 'TRAILS SHOP', size: 70, fill: '#ffffff' }],
    }),
    addStall(scene, v, physics, { ...SHOPS.sell, name: 'SELL', color: '#e3162a', fill: '#ffd21f', floor: '#ff3a3a', bulbs: false }),
    addGiftPad(scene, SHOPS.free.x, SHOPS.free.z),
  ];
  addArchBoards(scene, physics, LEADERBOARDS, lineZ);
  addEventsBoard(scene, physics, {
    x: SHOPS.events.x, z: SHOPS.events.z, ry: -Math.PI / 4,
    lines: [
      { text: 'NIGHT EVENT', size: 120, fill: '#ffe14a', font: '"Luckiest Guy", sans-serif', weight: 400 },
      { text: `Eggs grow ${CYCLE.nightGrowth}x faster at night!`, size: 54, fill: '#ffffff' },
      { text: 'Morning: ALL EGGS RESET!', size: 54, fill: '#ffffff' },
      { text: 'Free gift every 15 minutes!', size: 54, fill: '#7dff3f' },
    ],
  });

  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const chunks = glow.meshes((c) => new THREE.Mesh(c.geometry(), glowMaterial));
  chunks.push(...v.meshes());
  scene.add(...chunks);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshBasicMaterial({ color: '#3f8fdc' }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -32;
  scene.add(sea);

  const plots = PLOTS.map((plot, i) => new PlotView(i, plot, scene, physics, effects));
  // no wall dancers in this lobby (the video has none): a stand-in so the game loop stays the same
  const dancers = { setQuality() {}, update() {} };
  return { plots, boardGlows: [], shine, chunks, nests: NESTS, dancers, setDojoClock };
}
