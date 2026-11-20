// The biome corridor north of the safe zone: ten walled stages one after another, each with its
// own checkered ground, tall checker-block walls with a plateau on top, an entrance arch with a
// sign, the dirt nest the guardian sleeps on, and themed decor along the sides.
//
// Everything static goes into the ChunkedVoxels `v` (lit) and `glow` (unlit: lava, neon, crystals).
// Only the arch signs (canvas text planes) go into the scene directly.

import * as THREE from 'three';
import { makeTextPlane } from '../util/canvasText.js';
import { glowTexture } from '../util/textures.js';
import { FX } from '../entities/Tornado.js';
import { BIOMES, BIOME_DEPTH, DIFFICULTY_COLOR, GUARDIANS, NESTS, NEST_RADIUS, WORLD, formatNumber, NEST_RISE, NEST_STAGE_R } from '../../shared/gameData.js';

const H = WORLD.corridorHalf;          // 90
const WALL_H = WORLD.corridorWallHeight; // 70
const WALL_X = H + 1;                  // the walls' middle line
const GROUND_TILE = 12;
const WALL_BLOCK_W = 24;
const WALL_BLOCK_H = 14;
const WALL_BLOCK_D = 2.6;
const WALL_GAP = 0.5;
const PLATEAU_W = 50;
const LANE = 14;                       // |x| < LANE stays clear the whole way
// the stages were 320 long when the decor counts were set: longer stages get proportionally more of it
const LENGTH_K = BIOME_DEPTH / 320;
const more = (n) => Math.round(n * LENGTH_K);
const ARCH_CLEAR = 12;                 // decor keeps this far (in z) from every arch
const NEST_CLEAR = NEST_RADIUS + 6;
const PILLAR_X = H - 6;                // 84
const BEAM_Y = 35;                     // beam spans y 35..40 (capital 34..35)
const SIGN_FONT = '"Luckiest Guy", "Fredoka", sans-serif';

// ------------------------------------------------------------------ styles

export const BIOME_STYLE = {
  // the dojo is mostly hidden under the dojo hall (Dojo.js): sandy floor, dark red-brown walls
  dojo: { ground: ['#d8b884', '#cfae78'], wall: ['#6a3420', '#5a2a1c'], wallTop: '#ffcc33' },
  // the garden: lime grass, big grey stone walls (light at the top) with a gold line and moss
  garden: { ground: ['#62d64c', '#58c944'], wall: ['#b4b9c1', '#a3a8b1'], wallTop: '#d8dce2' },
  // the fire temple: a dark navy floor, red walls (painted over in DECOR.fire) with an orange top
  fire: { ground: ['#2c2e44', '#272940'], wall: ['#c8162a', '#b01222'], wallTop: '#ff7a1a' },
  // the lightning ruins: a deep blue checker floor, blue walls with a yellow top line
  storm: { ground: ['#1f3fa8', '#1a369a'], wall: ['#2a56d0', '#2048b8'], wallTop: '#ffd84a' },
  // the earth caves: a slate checker floor, dark navy walls with an orange-gold top line
  earth: { ground: ['#3a4058', '#343a50'], wall: ['#262b48', '#20243e'], wallTop: '#e09a2a' },
  // the energy temple: a bright green checker floor, green walls with a gold top line
  energy: { ground: ['#2ec84a', '#28b842'], wall: ['#24a83a', '#1e9432'], wallTop: '#e8d23a' },
  // the ice temple: white snow, pale walls with a light blue top
  ice: { ground: ['#f6f9fc', '#eaf0f7'], wall: ['#dae6f6', '#cddcf0'], wallTop: '#bfe4ff' },
  // the sea kingdom: a bright aqua floor under the water, blue walls
  water: { ground: ['#3ac2ee', '#34b6e6'], wall: ['#52bcea', '#46aee0'], wallTop: '#bff4ff' },
  // the haunted district: a dark green checker floor, black walls (black houses line them)
  ghost: { ground: ['#1c3a2c', '#173224'], wall: ['#0b0d0c', '#0f1311'], wallTop: '#2adc6a' },
  // the fortress: a near-black floor, black walls with neon pink
  fortress: { ground: ['#100d18', '#0c0a13'], wall: ['#0c0a12', '#100e18'], wallTop: '#ff2ad4' },
  pumpkin: { ground: ['#86d43c', '#78c832'], wall: ['#d2541f', '#b8441a'], wallTop: '#5fbf2a' },
  candy: { ground: ['#ffbfe0', '#ffa6d2'], wall: ['#a63be0', '#8d2cc6'], wallTop: '#ff6fbf', fog: '#ffd6ee' },
  haunted: { ground: ['#3f5c2f', '#344f27'], wall: ['#40344f', '#342a42'], wallTop: '#2c4a24', fog: '#4c5a6c' },
  graveyard: { ground: ['#5c6352', '#4f5547'], wall: ['#6e6e78', '#5b5b65'], wallTop: '#3f5a36', fog: '#6a707c' },
  carnival: { ground: ['#cfa86c', '#bd965a'], wall: ['#d6283a', '#f2eeea'], wallTop: '#ffd21f', fog: '#e8c89a' },
  bog: { ground: ['#4f7a3a', '#446c31'], wall: ['#4a7a5a', '#3d6a4c'], wallTop: '#9be05a', fog: '#6a8a70' },
  frost: { ground: ['#eef6ff', '#d9e9f7'], wall: ['#9fd4f0', '#82bfe4'], wallTop: '#ffffff', fog: '#d4e8f6' },
  manor: { ground: ['#4b3b5c', '#3f314e'], wall: ['#5c4b70', '#4b3d5e'], wallTop: '#2c2338', fog: '#5a4a72' },
  inferno: { ground: ['#4a0c10', '#3a080c'], wall: ['#6a0e12', '#52080c'], wallTop: '#ff2a2a', fog: '#3a0408' },
  nightmare: { ground: ['#bfa47c', '#ad926a'], wall: ['#c9b48c', '#b39e76'], wallTop: '#8a6a44', fog: '#5a4a3a' },
  backrooms: { ground: ['#9a7a3a', '#8e6f34'], wall: ['#d8c06a', '#cdb460'], wallTop: '#e8dca0', fog: '#c8b070' },
  glitch: { ground: ['#15151b', '#20202a'], wall: ['#25e890', '#16161f'], wallTop: '#ff2ad4', fog: '#101018' },
  void: { ground: ['#14104a', '#1a145c'], wall: ['#1c1240', '#140c32'], wallTop: '#ff3af0', fog: '#0a0620' },
};

// The nest's dirt per biome: [outer, inner, patch, twig]. Rocks: [rock, dark rock].
const NEST_STYLE = {
  // woven baskets (see addBasketNest): [basket, darker weave, inside]
  dojo: { basket: ['#a8683a', '#7a4524', '#e8cf9c'], mat: '#efe2bf', rock: ['#9a9aa2', '#7c7c84'] },
  garden: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#a8adb5', '#8a8f98'] },
  fire: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#3a3c50', '#2a2c3e'] },
  storm: { basket: ['#c8946a', '#9a6a44', '#efe0c4'], mat: null, rock: ['#3a4a8a', '#2a3a7a'] },
  earth: { basket: ['#c8a050', '#8a6a2a', '#ead39f'], mat: null, rock: ['#4a5068', '#3a4058'] },
  energy: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#2a8a3a', '#1e6a2a'] },
  ice: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#c8d8ec', '#a8bcd8'] },
  water: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#1a4ab0', '#0e2a6a'] },
  ghost: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#1e2a24', '#141c18'] },
  fortress: { basket: ['#b8743e', '#8a5028', '#ead39f'], mat: null, rock: ['#2a2234', '#1a1424'] },
  pumpkin: { dirt: ['#8a4a26', '#9a5832', '#74391c'], twig: '#5c1a12', rock: ['#9a9aa2', '#7c7c84'] },
  candy: { dirt: ['#8a4a2e', '#a25e3c', '#6e3420'], twig: '#ff5fa8', rock: ['#ffe1f0', '#d6b6f2'] },
  haunted: { dirt: ['#4a3622', '#5a4128', '#382818'], twig: '#2a1a10', rock: ['#6c7078', '#555960'] },
  graveyard: { dirt: ['#5a4a3a', '#6a5644', '#463a2e'], twig: '#3a2c20', rock: ['#9a9aa2', '#7a7a84'] },
  carnival: { dirt: ['#9a6a3a', '#ae7c48', '#7e5430'], twig: '#c8282e', rock: ['#a8a8b0', '#8a8a92'] },
  bog: { dirt: ['#4a3a24', '#5a4a2c', '#3a2e1a'], twig: '#2e4a1e', rock: ['#6e7a6a', '#56625a'] },
  frost: { dirt: ['#8a96a6', '#a6b4c4', '#768292'], twig: '#5a6a80', rock: ['#d8ecff', '#b0cce6'] },
  manor: { dirt: ['#4a3a40', '#5a4650', '#3a2c32'], twig: '#2c1a2a', rock: ['#8a8496', '#6e687a'] },
  inferno: { dirt: ['#2e1a16', '#3e221c', '#22120e'], twig: '#8a1a0e', rock: ['#3a3640', '#2a2630'] },
  nightmare: { dirt: ['#7a5a3a', '#8a6a48', '#6a4a2e'], twig: '#f2e6c8', rock: ['#e8dcc0', '#c8b898'] },
  backrooms: { dirt: ['#6a4a22', '#7a5a2c', '#5a3c1a'], twig: '#3a2810', rock: ['#d8c06a', '#b8a050'] },
  glitch: { dirt: ['#2a2a34', '#383846', '#1e1e26'], twig: '#25e890', rock: ['#4a4a5a', '#3a3a48'] },
  void: { dirt: ['#1a1428', '#241c36', '#110c1c'], twig: '#6a3aff', rock: ['#2c2440', '#1e1830'] },
};

// Arch colours per biome: two pillar colours (stacked checker), the beam, the trim.
const ARCH_STYLE = {
  dojo: { pillar: ['#6a3420', '#5a2a1c'], beam: '#3b2416', trim: '#ffcc33' },
  // a shrine gate: red pillars, a black top beam, gold trim
  garden: { pillar: ['#d6283a', '#c21f30'], beam: '#1c1a20', trim: '#ffcc33' },
  // black and red pillars with gold trim, like the temple's torches
  fire: { pillar: ['#16182a', '#c8162a'], beam: '#16182a', trim: '#ffcc33' },
  storm: { pillar: ['#10183a', '#2a56d0'], beam: '#10183a', trim: '#ffd84a' },
  earth: { pillar: ['#20243e', '#2c3150'], beam: '#16182a', trim: '#e09a2a' },
  energy: { pillar: ['#1e7a28', '#2fae3a'], beam: '#145a1e', trim: '#e8d23a' },
  ice: { pillar: ['#e8f2fc', '#7fb4e8'], beam: '#1a3a8a', trim: '#bfe4ff' },
  water: { pillar: ['#0e2a6a', '#3ab0e0'], beam: '#0a2a6a', trim: '#7fe0ff' },
  ghost: { pillar: ['#0b0d0c', '#14261a'], beam: '#0b0d0c', trim: '#3aff8a' },
  fortress: { pillar: ['#0e0b14', '#2a1a3a'], beam: '#0e0b14', trim: '#ff2ad4' },
  pumpkin: { pillar: ['#ff7a1a', '#e8641a'], beam: '#6a3a1e', trim: '#3a2010' },
  candy: { pillar: ['#ff2a3c', '#ffffff'], beam: '#ff6fbf', trim: '#a63be0' },
  haunted: { pillar: ['#4a3624', '#3a2a1c'], beam: '#2e221a', trim: '#1c1410' },
  graveyard: { pillar: ['#8a8a94', '#74747e'], beam: '#5c5c66', trim: '#3a3a42' },
  carnival: { pillar: ['#d6283a', '#f4f0ea'], beam: '#2a62d6', trim: '#ffd21f' },
  bog: { pillar: ['#5a4a2c', '#4a3c22'], beam: '#3d6a4c', trim: '#9be05a' },
  frost: { pillar: ['#bfe6ff', '#9fd4f0'], beam: '#e8f6ff', trim: '#6ab4e0' },
  manor: { pillar: ['#6a5a7e', '#584a6a'], beam: '#3c2f4c', trim: '#c8a24a' },
  inferno: { pillar: ['#2a2228', '#3a2c30'], beam: '#5f1810', trim: '#ff5a1a' },
  nightmare: { pillar: ['#e8dcc0', '#cfc0a0'], beam: '#6a4a2e', trim: '#3a2614' },
  backrooms: { pillar: ['#d8c06a', '#c4ac58'], beam: '#6a5020', trim: '#3a2a10' },
  glitch: { pillar: ['#16161f', '#25e890'], beam: '#16161f', trim: '#ff2ad4' },
  void: { pillar: ['#120e20', '#1c1630'], beam: '#0b0914', trim: '#6a3aff' },
};

// ------------------------------------------------------------------ helpers

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return `#${c.getHexString()}`;
}

function makeCtx(v, glow, biome, index, colliders) {
  const rnd = seededRandom(1009 + index * 7919);
  const nest = NESTS[index];
  const ctx = {
    v, glow, rnd, biome, nest, index, colliders,
    style: BIOME_STYLE[biome.id] || BIOME_STYLE.dojo, // a stage with no look of its own: the dojo's
    r: (a, b) => a + rnd() * (b - a),
    pick: (list) => list[Math.floor(rnd() * list.length)],
    mid: (biome.minZ + biome.maxZ) / 2,
    // is a thing of radius rad at x, z out of the lane, the nest, the arches and the walls?
    ok(x, z, rad = 0) {
      if (Math.abs(x) - rad < LANE) return false;
      if (Math.abs(x) + rad > H - 1.5) return false;
      if (biome.id === 'pumpkin' && Math.abs(x) + rad > 59) return false; // the big crop rows run along the walls there
      if (Math.hypot(x - nest.x, z - nest.z) < NEST_CLEAR + rad) return false;
      if (z + rad > biome.maxZ - ARCH_CLEAR || z - rad < biome.minZ + ARCH_CLEAR) return false;
      return true;
    },
    // a random free spot; nearWall = within ~20 units of a wall, else anywhere between lane and walls
    spot(radius = 1, nearWall = rnd() < 0.72, side = null) {
      const rad = radius * (ctx.decorK || 1); // grown decor needs more room
      for (let t = 0; t < 16; t++) {
        const s = side ?? (rnd() < 0.5 ? -1 : 1);
        const ax = nearWall ? ctx.r(H - 21, Math.max(H - 21, H - 2 - rad)) : ctx.r(LANE + 2 + rad, Math.max(LANE + 2 + rad, H - 22));
        const x = s * ax;
        const z = ctx.r(biome.minZ + ARCH_CLEAR + rad, biome.maxZ - ARCH_CLEAR - rad);
        if (ctx.ok(x, z, rad)) {
          ctx.anchor = { x, z }; // what is drawn round here next grows with decorK (see addDecor)
          return { x, z, side: s };
        }
      }
      return null;
    },
    // grown decor: a point near the last spot moves out from it by decorK
    grow(x, z) {
      const a = ctx.anchor, k = ctx.decorK || 1;
      if (k === 1 || !a || Math.hypot(x - a.x, z - a.z) > GROW_NEAR) return null;
      return { x: a.x + (x - a.x) * k, z: a.z + (z - a.z) * k, k };
    },
    circle(x, z, r) {
      const g = ctx.grow(x, z);
      if (g) { x = g.x; z = g.z; r *= g.k; }
      colliders.push({ kind: 'circle', biome: biome.id, x: round(x), z: round(z), r: round(r) });
    },
    rect(minX, maxX, minZ, maxZ) {
      const g0 = ctx.grow(minX, minZ), g1 = ctx.grow(maxX, maxZ);
      if (g0 && g1) { minX = g0.x; minZ = g0.z; maxX = g1.x; maxZ = g1.z; }
      colliders.push({ kind: 'box', biome: biome.id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ) });
    },
  };
  return ctx;
}

const round = (n) => Math.round(n * 100) / 100;

// ------------------------------------------------------------------ ground

function addGround(ctx) {
  const { v, biome, style } = ctx;
  const zc = (biome.minZ + biome.maxZ) / 2;
  // one slab in the first colour, the second colour's tiles laid on top (a hair higher)
  v.box(0, -2, zc, H * 2, 2, BIOME_DEPTH, style.ground[0]);
  let i = 0;
  for (let x = -H; x < H - 0.01; x += GROUND_TILE, i++) {
    let j = 0;
    for (let z = biome.minZ; z < biome.maxZ - 0.01; z += GROUND_TILE, j++) {
      if ((i + j) % 2 === 0) continue;
      const w = Math.min(GROUND_TILE, H - x), d = Math.min(GROUND_TILE, biome.maxZ - z);
      v.box(x + w / 2, -1.9, z + d / 2, w, 1.94, d, style.ground[1]);
    }
  }
}

// ------------------------------------------------------------------ walls

// A run of big checker blocks over a darker backing, the top edge in wallTop with drips hanging
// down the inner face. axis 'z' = a side wall at x = fixed; 'x' = an end wall at z = fixed.
function addWallRun(ctx, axis, fixed, from, to, inner, style) {
  const { v, rnd } = ctx;
  const place = (along, y, length, h, depth, color, off = 0) => {
    if (axis === 'z') v.box(fixed + off, y, along, depth, h, length, color);
    else v.box(along, y, fixed + off, length, h, depth, color);
  };
  place((from + to) / 2, 0, to - from, WALL_H, 1.4, shade(style.wall[1], 0.55), -inner * 0.4);
  const rows = Math.round(WALL_H / WALL_BLOCK_H);
  for (let row = 0; row < rows; row++) {
    let i = 0;
    for (let a = from; a < to - 0.01; a += WALL_BLOCK_W, i++) {
      const length = Math.min(WALL_BLOCK_W, to - a) - WALL_GAP;
      if (length < 2) continue;
      place(a + WALL_GAP / 2 + length / 2, row * WALL_BLOCK_H + WALL_GAP / 2, length, WALL_BLOCK_H - WALL_GAP, WALL_BLOCK_D,
        style.wall[(row + i) % 2]);
    }
  }
  // the top lip, and drips / hanging grass of the top colour down the inner face
  place((from + to) / 2, WALL_H - 2.2, to - from, 2.8, WALL_BLOCK_D + 1.2, style.wallTop);
  const face = inner * (WALL_BLOCK_D / 2 + 0.35);
  let a = from + rnd() * 6;
  while (a < to - 4) {
    const w = 2.5 + rnd() * 4;
    const drop = 2 + rnd() * rnd() * 14;
    place(a + w / 2, WALL_H - 2 - drop, w, drop + 0.2, 0.7, style.wallTop, face);
    a += w + 3 + rnd() * 16;
  }
}

function addSideWalls(ctx) {
  const { v, biome, style } = ctx;
  const zc = (biome.minZ + biome.maxZ) / 2;
  for (const side of [-1, 1]) {
    addWallRun(ctx, 'z', side * WALL_X, biome.minZ, biome.maxZ, -side, style);
    // the plateau on top, reaching out so the void never shows
    const px = side * (WALL_X + PLATEAU_W / 2);
    v.box(px, -2, zc, PLATEAU_W, WALL_H, BIOME_DEPTH, shade(style.wall[1], 0.7));
    v.box(side * (WALL_X - 1.8 + (PLATEAU_W + 1.8) / 2), WALL_H - 2, zc, PLATEAU_W + 1.8, 2.6, BIOME_DEPTH, style.wallTop);
  }
}

function addEndWall(ctx) {
  const { v, style } = ctx;
  const z = WORLD.northZ;
  addWallRun(ctx, 'x', z - 1, -WALL_X - 1.3, WALL_X + 1.3, 1, style);
  const w = (WALL_X + PLATEAU_W) * 2;
  v.box(0, -2, z - 1 - PLATEAU_W / 2, w, WALL_H, PLATEAU_W, shade(style.wall[1], 0.7));
  v.box(0, WALL_H - 2, z - 0.2 - (PLATEAU_W + 1.6) / 2 + 0.8, w, 2.6, PLATEAU_W + 1.6, style.wallTop);
}

// ------------------------------------------------------------------ escape board

// A board at the lobby edge of every nest: the least speed you need to steal there (biome.speed),
// bigger at every nest further along. It faces south, so it reads as you walk up to the eggs.
const BOARD_W = 22, BOARD_H = 11, BOARD_Y = 5.5;
function addEscapeBoard(scene, ctx) {
  const { v, nest, biome } = ctx;
  const a = ARCH_STYLE[biome.id] || ARCH_STYLE.dojo;
  const x = nest.x - nest.side * 6, z = nest.z + NEST_RADIUS + 3;
  for (const s of [-1, 1]) {
    v.box(x + s * (BOARD_W / 2 - 1.5), 0, z - 0.6, 1.3, BOARD_Y + BOARD_H + 0.6, 1.3, '#3a2414');
    ctx.rect(x + s * (BOARD_W / 2 - 1.5) - 0.8, x + s * (BOARD_W / 2 - 1.5) + 0.8, z - 1.4, z + 0.2);
  }
  v.box(x, BOARD_Y - 0.5, z, BOARD_W + 1, BOARD_H + 1, 0.7, a.trim);
  v.box(x, BOARD_Y - 0.6, z - 0.45, BOARD_W + 1.3, BOARD_H + 1.2, 0.3, '#3a2414'); // a wooden back
  v.box(x, BOARD_Y, z + 0.1, BOARD_W, BOARD_H, 0.7, '#1c1712');
  if (typeof document === 'undefined') return; // no canvas (e.g. a Node check)
  const need = biome.speed; // the least speed to steal here (see pick on the server)
  const color = DIFFICULTY_COLOR[biome.difficulty] || '#ffffff';
  const text = makeTextPlane([
    { text: 'SPEED NEEDED TO STEAL', size: 46, fill: '#ffffff' },
    { text: `⚡ ${formatNumber(need)}`, size: 118, fill: '#35d0ff', font: SIGN_FONT, weight: 400 },
    { text: GUARDIANS[biome.guardian].name.toUpperCase(), size: 50, fill: color },
  ], BOARD_H - 1.2);
  const width = text.geometry.parameters.width;
  if (width > BOARD_W - 1.2) text.scale.setScalar((BOARD_W - 1.2) / width); // long names: shrink to fit
  text.position.set(x, BOARD_Y + BOARD_H / 2, z + 0.5);
  scene.add(text);
}

// ------------------------------------------------------------------ arch + sign

function addSign(scene, biome, index, z) {
  if (typeof document === 'undefined') return null; // no canvas (e.g. a Node check)
  const speedText = index === 0 ? 'Recommended: ⚡0' : `⚡ ${formatNumber(biome.speed)} Speed`;
  const sign = makeTextPlane([
    { text: biome.name, size: 96, fill: '#ffffff', font: SIGN_FONT, weight: 400 },
    { text: speedText, size: 54, fill: DIFFICULTY_COLOR[biome.difficulty] || '#ffffff' },
  ], 11);
  sign.position.set(0, BEAM_Y + 12, z + 1.45);
  scene.add(sign);
  return sign;
}

function addArch(scene, ctx) {
  const { v, biome, index } = ctx;
  const a = ARCH_STYLE[biome.id] || ARCH_STYLE.dojo;
  const z = biome.maxZ;
  for (const side of [-1, 1]) {
    const x = side * PILLAR_X;
    v.box(x, 0, z, 8, 2, 8, a.trim);
    for (let k = 0; k < 5; k++) v.box(x, 2 + k * 6.4, z, 6, 6.4, 6, a.pillar[k % 2]);
    v.box(x, BEAM_Y - 1, z, 8, 1, 8, a.trim);
    ctx.rect(x - 4, x + 4, z - 4, z + 4);
  }
  v.box(0, BEAM_Y, z, H * 2 + 2, 5, 4, a.beam);
  v.box(0, BEAM_Y - 0.4, z, H * 2 + 2, 0.8, 4.6, a.trim);
  v.box(0, BEAM_Y + 4.6, z, H * 2 + 2, 0.8, 4.6, a.trim);
  // the sign board sitting on the beam
  v.box(0, BEAM_Y + 4.8, z - 0.2, 66, 15, 2, a.trim);
  v.box(0, BEAM_Y + 5.4, z, 63, 13.8, 2.4, a.beam);
  ARCH_TOP[biome.id]?.(ctx, z, a);
  addSign(scene, biome, index, z);
}

// Little themed things on top of / hanging from each arch.
const TOP_Y = BEAM_Y + 5.4; // top of the beam
const ARCH_TOP = {
  // the shrine gate's top: a black beam reaching past the pillars with its ends swept up, gold
  // caps on the pillars and two paper lanterns hanging under the beam
  garden({ v, glow, lamps }, z) {
    const top = TOP_Y + 15.6; // over the sign board
    v.box(0, top, z, (PILLAR_X + 16) * 2, 3, 6, '#1c1a20');
    v.box(0, top - 1.4, z, (PILLAR_X + 10) * 2, 1.4, 5, '#d6283a');
    for (const s of [-1, 1]) {
      v.box(s * (PILLAR_X + 18), top + 0.6, z, 8, 2.4, 6, '#1c1a20', { rz: s * 0.32 });
      v.box(s * (PILLAR_X + 21.5), top + 2.2, z, 3, 1.6, 6.2, '#ffcc33', { rz: s * 0.32 });
      // the pillars carry on up to the top beam
      v.box(s * PILLAR_X, TOP_Y, z, 5.4, 15.6, 5.4, '#d6283a');
      v.box(s * PILLAR_X, TOP_Y + 14.6, z, 6.4, 1, 6.4, '#ffcc33');
      for (const x of [s * 40, s * 62]) {
        v.box(x, BEAM_Y - 3, z + 2.4, 0.3, 3, 0.3, '#1c1a20');
        (lamps || glow).box(x, BEAM_Y - 8.2, z + 2.4, 3, 5.2, 3, '#ffd88a');
        lamps?.halo(x, BEAM_Y - 5.6, z + 2.4, 16, '#ffd88a');
        v.box(x, BEAM_Y - 8.6, z + 2.4, 3.4, 0.6, 3.4, '#1c1a20');
        v.box(x, BEAM_Y - 3.4, z + 2.4, 3.4, 0.6, 3.4, '#1c1a20');
      }
    }
  },
  pumpkin({ v, glow }, z) {
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 7, 6, 7, '#ff7a1a');
      v.box(x, TOP_Y + 6, z, 0.9, 1.6, 0.9, '#3a6a1e');
      glow.box(x - 1.4, TOP_Y + 3.2, z + 3.45, 1.2, 1.2, 0.2, '#ffd84a');
      glow.box(x + 1.4, TOP_Y + 3.2, z + 3.45, 1.2, 1.2, 0.2, '#ffd84a');
      glow.box(x, TOP_Y + 1.2, z + 3.45, 3.4, 0.8, 0.2, '#ffd84a');
    }
    for (const x of [-56, -44, 44, 56]) { v.box(x, BEAM_Y + 5.4, z, 3, 2.4, 3, '#ff8a1a'); v.box(x, BEAM_Y + 7.8, z, 0.4, 0.8, 0.4, '#3a6a1e'); }
  },
  candy({ v }, z) {
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 0.8, 7, 0.8, '#ffffff');
      v.box(x, TOP_Y + 7, z, 8, 8, 1.2, '#ff5fa8');
      v.box(x, TOP_Y + 9, z + 0.1, 5, 4, 1.3, '#ffffff');
      v.box(x, TOP_Y + 10.2, z + 0.15, 2.4, 1.6, 1.4, '#5fd0ff');
    }
    for (const x of [-60, -50, 50, 60]) v.box(x, BEAM_Y + 5.4, z, 3.2, 2.2, 3.2, x < 0 ? '#5fd0ff' : '#ffe14a');
  },
  haunted({ v, glow }, z) {
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 1.6, 8, 1.6, '#2e221a', { rz: s * 0.2 });
      v.box(x + s * 2, TOP_Y + 5, z, 0.8, 5, 0.8, '#2e221a', { rz: -s * 0.9 });
      v.box(x - s * 1.5, TOP_Y + 4, z, 0.7, 4, 0.7, '#2e221a', { rz: s * 0.8 });
      v.box(x - s * 8, BEAM_Y - 4, z + 1.5, 0.2, 4, 0.2, '#1c1410');
      glow.box(x - s * 8, BEAM_Y - 6, z + 1.5, 1.4, 2, 1.4, '#9effc8');
    }
  },
  graveyard({ v }, z) {
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 4.6, 4.2, 4.2, '#efe9da');
      v.box(x, TOP_Y - 0.6, z + 0.6, 3.2, 1, 3.2, '#efe9da');
      v.box(x - 1, TOP_Y + 1.8, z + 2.05, 1.1, 1.1, 0.2, '#1a1a1e');
      v.box(x + 1, TOP_Y + 1.8, z + 2.05, 1.1, 1.1, 0.2, '#1a1a1e');
    }
    for (const x of [-52, 52]) { v.box(x, BEAM_Y + 5.4, z, 0.9, 6, 0.9, '#5c5c66'); v.box(x, BEAM_Y + 9, z, 3.6, 0.9, 0.9, '#5c5c66'); }
  },
  carnival({ v, glow }, z) {
    for (let x = -84; x <= 84; x += 12) glow.box(x, BEAM_Y + 2, z + 2.3, 1, 1, 0.5, (x / 12) % 2 ? '#ffe14a' : '#ff4a4a');
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 5, 3, 5, '#d6283a');
      v.box(x, TOP_Y + 3, z, 3.4, 2.6, 3.4, '#f4f0ea');
      v.box(x, TOP_Y + 5.6, z, 1.8, 2.2, 1.8, '#d6283a');
      v.box(x, TOP_Y + 7.8, z, 0.3, 3, 0.3, '#3a3a3a');
      v.box(x + 1.1, TOP_Y + 9.4, z, 2, 1.3, 0.2, '#ffd21f');
    }
  },
  bog({ v }, z) {
    for (let x = -80; x <= 80; x += 9) {
      const drop = 2 + Math.abs(Math.sin(x)) * 5;
      v.box(x, BEAM_Y - drop, z + 2.1, 1.4, drop, 0.4, x % 2 ? '#6aa83a' : '#4a8a2e');
    }
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 7, 1.4, 7, '#3d6a4c');
      v.box(x, TOP_Y + 1.4, z, 2, 1.4, 2, '#ff8fc4');
      v.box(x, TOP_Y + 2.8, z, 1, 0.6, 1, '#ffe14a');
    }
  },
  frost({ v }, z) {
    for (const s of [-1, 1]) v.box(s * 62.5, TOP_Y, z, 57, 1.6, 5, '#ffffff'); // snow on the beam, beside the board
    for (let x = -82; x <= 82; x += 8) {
      const len = 2 + Math.abs(Math.sin(x * 1.7)) * 4;
      v.box(x, BEAM_Y - 0.4 - len, z + 1.6, 0.9, len, 0.9, '#bfe9ff');
    }
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y + 1.6, z, 3, 8, 3, '#9be8ff', { ry: 0.6 });
      v.box(x, TOP_Y + 9.6, z, 1.6, 3, 1.6, '#e8f8ff', { ry: 0.6 });
    }
  },
  manor({ v, glow }, z) {
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 5, 1, 5, '#c8a24a');
      for (const dx of [-1.6, 0, 1.6]) {
        const h = dx === 0 ? 4.2 : 3;
        v.box(x + dx, TOP_Y + 1, z, 1, h, 1, '#f4ecd8');
        glow.box(x + dx, TOP_Y + 1 + h, z, 0.6, 1.1, 0.6, '#ffc24a');
      }
    }
    for (const x of [-40, 40]) { v.box(x, BEAM_Y - 3, z + 2.1, 0.3, 3, 0.3, '#c8a24a'); glow.box(x, BEAM_Y - 4.4, z + 2.1, 1.2, 1.4, 1.2, '#ffc24a'); }
  },
  inferno({ v, glow }, z) {
    glow.box(0, BEAM_Y + 1.8, z + 2.05, H * 2 - 6, 1.2, 0.2, '#ff6a1a');
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 6, 2, 6, '#2a2228');
      v.box(x - s * 1.5, TOP_Y + 2, z, 1.8, 6, 1.8, '#e8e0d0', { rz: s * 0.35 });
      v.box(x + s * 1.5, TOP_Y + 2, z, 1.8, 6, 1.8, '#e8e0d0', { rz: -s * 0.35 });
      glow.box(x, TOP_Y + 2, z, 2, 1.6, 2, '#ff8a1a');
    }
  },
  // a skull on each pillar with burning eyes, teeth hanging under the beam
  nightmare({ v, glow }, z) {
    for (let x = -80; x <= 80; x += 6) v.box(x, BEAM_Y - 2.2, z + 1.4, 1.4, 2.2, 1.2, '#f4ecd6');
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      v.box(x, TOP_Y, z, 6, 5.4, 6, '#ece0c4');
      v.box(x, TOP_Y - 0.8, z + 1, 4.2, 1.4, 4.2, '#ece0c4');
      for (const dx of [-1.3, 1.3]) {
        v.box(x + dx, TOP_Y + 2.4, z + 3.01, 1.6, 1.6, 0.2, '#1a120a');
        glow.box(x + dx, TOP_Y + 2.8, z + 3.12, 0.6, 0.6, 0.1, '#ff3a1a');
      }
      v.box(x, TOP_Y + 1.2, z + 3.05, 0.8, 0.9, 0.2, '#1a120a');
    }
  },
  // fluorescent tubes along the beam
  backrooms({ v, glow }, z) {
    for (let x = -72; x <= 72; x += 24) {
      v.box(x, BEAM_Y - 0.5, z + 2.2, 10, 0.4, 1.2, '#cfc8b0');
      glow.box(x, BEAM_Y - 0.8, z + 2.2, 9, 0.35, 0.8, '#fffbe0');
    }
    for (const s of [-1, 1]) v.box(s * PILLAR_X, TOP_Y, z, 6, 1.2, 6, '#6a5020');
  },
  glitch({ glow }, z) {
    const r = seededRandom(4242);
    for (let i = 0; i < 14; i++) {
      const x = (r() - 0.5) * H * 2;
      glow.box(x, BEAM_Y - 3 + r() * 14, z + (r() - 0.5) * 6, 1 + r() * 2.5, 1 + r() * 2.5, 1 + r() * 2.5,
        r() < 0.5 ? '#25e890' : r() < 0.5 ? '#ff2ad4' : '#2ad4ff', { rx: r() * 0.4, ry: r() * 0.4 });
    }
  },
  void({ glow }, z) {
    glow.box(0, BEAM_Y + 0.6, z + 2.05, H * 2 - 4, 0.4, 0.2, '#6a3aff');
    glow.box(0, BEAM_Y + 4, z + 2.05, H * 2 - 4, 0.4, 0.2, '#6a3aff');
    for (const s of [-1, 1]) {
      const x = s * PILLAR_X;
      glow.box(x, TOP_Y + 3, z, 2, 6, 2, '#9a6aff', { rx: 0.4, rz: 0.5 });
      glow.box(x + s * 3, TOP_Y + 9, z, 1.2, 3.5, 1.2, '#c8a8ff', { rx: -0.3, rz: 0.8 });
    }
  },
};

// ------------------------------------------------------------------ nest

function strips(v, cx, cz, radius, step, y, h, color) {
  // a blocky disc: rows along x and along z (same colour + height, so their overlap is invisible)
  for (let a = -radius; a < radius - 0.01; a += step) {
    const c = a + step / 2;
    const half = Math.sqrt(Math.max(0, radius * radius - c * c));
    if (half < 0.5) continue;
    v.box(cx, y, cz + c, half * 2, h, step, color);
    v.box(cx + c, y, cz, step, h, half * 2, color);
  }
}

// A woven basket (like the video's egg baskets): a ring of slanted weave blocks round a sandy
// inside, the rim in two tones. r = its radius.
function basket(v, x, z, r, [weave, dark, inside], rnd) {
  const n = Math.max(10, Math.round(r * 5));
  v.box(x, 0, z, r * 1.7, 0.5, r * 1.7, dark, { ry: rnd() });
  v.box(x, 0.5, z, r * 1.5, 0.25, r * 1.5, inside, { ry: rnd() });
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    v.box(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, 0.7, r * 0.55 + 0.4, (Math.PI * 2 * r) / n + 0.25, k % 2 ? weave : dark,
      { ry: -a, rz: 0.28 });
  }
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2;
    v.box(x + Math.cos(a) * (r + 0.2), r * 0.55 + 0.2, z + Math.sin(a) * (r + 0.2), 0.6, 0.45, (Math.PI * 2 * r) / n + 0.3, k % 2 ? dark : weave, { ry: -a });
  }
}

// The first two stages: the eggs sit in woven baskets (and a few spare baskets lie about), the
// dojo's on a big cream training mat.
function addBasketNest(ctx) {
  const { v, rnd, nest, biome } = ctx;
  const ns = NEST_STYLE[biome.id] || NEST_STYLE.dojo;
  if (ns.mat) {
    v.box(nest.x, 0.05, nest.z, NEST_RADIUS * 1.7, 0.18, NEST_RADIUS * 1.7, ns.mat);
    v.box(nest.x, 0.04, nest.z, NEST_RADIUS * 1.7 + 1.2, 0.16, NEST_RADIUS * 1.7 + 1.2, '#8a5a2e');
  }
  for (const s of nest.slots) basket(v, s.x, s.z, 3.5, ns.basket, rnd);
  // spare baskets round the edge, away from the eggs and the guardian
  const avoid = [...nest.slots, nest.guardian];
  let placed = 0;
  for (let t = 0; t < 40 && placed < 4; t++) {
    const a = rnd() * Math.PI * 2, d = 11 + rnd() * 7;
    const x = nest.x + Math.cos(a) * d, z = nest.z + Math.sin(a) * d;
    if (Math.abs(x) < LANE || avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
    basket(v, x, z, 1.8 + rnd() * 1.4, ns.basket, rnd);
    placed++;
  }
}

// The raised round stage every nest stands on: a dark foot, the stage in the stage's wall colour
// with a gold-ish trim round its edge, magic dust rising round its rim and a soft light going up.
function addNestStage(ctx) {
  const { v, nest, biome, scene, lamps } = ctx;
  const a = ARCH_STYLE[biome.id] || ARCH_STYLE.dojo;
  const st = BIOME_STYLE[biome.id] || BIOME_STYLE.dojo;
  const R = NEST_STAGE_R;
  strips(v, nest.x, nest.z, R + 1.6, 2.5, 0, NEST_RISE * 0.5, shade(a.beam, 0.8));   // the step
  strips(v, nest.x, nest.z, R, 2.5, 0, NEST_RISE, st.wall[0]);                        // the stage
  strips(v, nest.x, nest.z, R - 1.2, 2.5, NEST_RISE - 0.02, 0.06, st.ground[0]);      // its top
  for (let i = 0; i < 48; i++) {                                                       // the trim round the edge
    const t = (i / 48) * Math.PI * 2;
    v.box(nest.x + Math.cos(t) * (R - 0.4), NEST_RISE - 0.2, nest.z + Math.sin(t) * (R - 0.4), 1.2, 0.45, 3.2, a.trim, { ry: -t });
  }
  ctx.floors.push({ x: nest.x, z: nest.z, r: R + 1.6, h: NEST_RISE });
  // a soft column of light going up from it, in the stage's colour (brighter at night)
  lamps?.beam(nest.x, nest.z, R - 1, 30, a.trim);
  if (!scene || typeof document === 'undefined') return;
  // magic dust rising round its rim
  const N = 46;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const tints = [new THREE.Color(a.trim), new THREE.Color('#ffffff'), new THREE.Color('#ffe8a0')];
  const specks = Array.from({ length: N }, (_, i) => ({ a: Math.random() * Math.PI * 2, t: Math.random(), r: R * (0.75 + Math.random() * 0.3), c: tints[i % 3], v: 0.18 + Math.random() * 0.18 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), size: 2.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  scene.add(dust);
  animateNear(nest.z, (dt, time) => {
    // only near the player's part of the track is it worth moving (others are far off in the mist)
    for (let i = 0; i < N; i++) {
      const p = specks[i];
      p.t += dt * p.v;
      if (p.t > 1) { p.t -= 1; p.a = Math.random() * Math.PI * 2; }
      p.a += dt * 0.4;
      pos[i * 3] = nest.x + Math.cos(p.a) * p.r;
      pos[i * 3 + 1] = NEST_RISE + p.t * 22;
      pos[i * 3 + 2] = nest.z + Math.sin(p.a) * p.r;
      const f = Math.sin(p.t * Math.PI) * (0.6 + 0.4 * Math.sin(time * 9 + i));
      col[i * 3] = p.c.r * f; col[i * 3 + 1] = p.c.g * f; col[i * 3 + 2] = p.c.b * f;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });
}

function addNest(ctx) {
  // the stage first, then the nest drawn on top of it
  addNestStage(ctx);
  const ground = ctx.v;
  ctx.v = { box: (x, y, z, ...rest) => ground.box(x, y + NEST_RISE, z, ...rest) };
  addNestOnStage(ctx);
  ctx.v = ground;
}

function addNestOnStage(ctx) {
  const { v, rnd, nest, biome } = ctx;
  const ns = NEST_STYLE[biome.id] || NEST_STYLE.dojo;
  if (ns.basket) return addBasketNest(ctx);
  strips(v, nest.x, nest.z, NEST_RADIUS, 2.5, -0.2, 0.32, ns.dirt[0]);       // top 0.12
  strips(v, nest.x, nest.z, NEST_RADIUS * 0.66, 2.6, -0.2, 0.37, ns.dirt[1]); // top 0.17
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2, d = 3 + rnd() * (NEST_RADIUS - 6);
    v.box(nest.x + Math.cos(a) * d, -0.2, nest.z + Math.sin(a) * d, 2 + rnd() * 3, 0.42, 1.5 + rnd() * 2.5, ns.dirt[2], { ry: rnd() * 3 });
  }
  // a little twig nest under each egg
  for (const s of nest.slots) {
    v.box(s.x, -0.1, s.z, 2.6, 0.38, 2.6, shade(ns.twig, 0.7), { ry: rnd() });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + rnd() * 0.2;
      v.box(s.x + Math.cos(a) * 1.5, 0.1, s.z + Math.sin(a) * 1.5, 1.45, 0.45 + rnd() * 0.15, 0.35, k % 2 ? ns.twig : shade(ns.twig, 0.8),
        { ry: -a - Math.PI / 2, rz: (rnd() - 0.5) * 0.25 });
    }
  }
  // rocks around the edge, away from the eggs and the guardian
  const avoid = [...nest.slots, nest.guardian];
  let placed = 0;
  for (let t = 0; t < 30 && placed < 4; t++) {
    const a = rnd() * Math.PI * 2, d = 12 + rnd() * 6;
    const x = nest.x + Math.cos(a) * d, z = nest.z + Math.sin(a) * d;
    if (Math.abs(x) < LANE || avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) continue;
    const s = 1 + rnd() * 1.2;
    v.box(x, 0, z, s * 1.4, 0.5 + rnd() * 0.5, s, ns.rock[0], { ry: rnd() * 3 });
    v.box(x + 0.3, 0.4, z - 0.2, s * 0.8, 0.4, s * 0.7, ns.rock[1], { ry: rnd() * 3 });
    placed++;
  }
  // the burrow mound beside the guardian, just at the circle's edge, its hole facing the eggs
  const bx = nest.x + nest.side * 18.5, bz = nest.guardian.z - 8;
  v.box(bx, 0, bz, 5.6, 0.5, 5, ns.dirt[2]);
  v.box(bx, 0.5, bz, 4.2, 0.4, 3.8, ns.dirt[0]);
  v.box(bx, 0.9, bz, 2.8, 0.3, 2.6, ns.dirt[1]);
  v.box(bx - nest.side * 2.2, 0.05, bz, 0.3, 0.9, 2, '#140c08');
}

// ------------------------------------------------------------------ decor pieces

// A pumpkin with darker ribs, a stalk and (big ones) a leaf. y = what it sits on.
function pumpkin(v, x, z, s, color = '#ff7a1a', y = 0) {
  v.box(x, y, z, s * 1.3, s, s * 1.3, color);
  if (s >= 1.6) {
    const rib = '#e0601a';
    v.box(x, y + 0.02, z, s * 0.28, s * 1.01, s * 1.33, rib);
    v.box(x, y + 0.02, z, s * 1.33, s * 1.01, s * 0.28, rib);
    v.box(x + s * 0.3, y + s, z + s * 0.15, s * 0.6, s * 0.08, s * 0.4, '#3a8a2a', { ry: 0.6 });
  }
  v.box(x, y + s, z, s * 0.22, s * 0.35, s * 0.22, '#3a6a1e', { rz: 0.15 });
}

function spikeCluster(target, ctx, x, z, h, w, colors, n = 3) {
  const { rnd, pick } = ctx;
  for (let i = 0; i < n; i++) {
    const s = i === 0 ? 1 : 0.5 + rnd() * 0.4;
    target.box(x + (i ? (rnd() - 0.5) * w * 1.6 : 0), 0, z + (i ? (rnd() - 0.5) * w * 1.6 : 0), w * s, h * s, w * s, pick(colors),
      { rx: (rnd() - 0.5) * (i ? 0.6 : 0.2), ry: rnd() * 3, rz: (rnd() - 0.5) * (i ? 0.6 : 0.2) });
  }
}

function deadTree(ctx, x, z, h, color) {
  const { v, rnd } = ctx;
  const w = h * 0.12;
  v.box(x, 0, z, w * 1.6, 0.6, w * 1.6, color);
  v.box(x, 0, z, w, h, w, color, { rz: (rnd() - 0.5) * 0.12 });
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const len = h * (0.25 + rnd() * 0.2);
    v.box(x + Math.cos(a) * len * 0.3, h * (0.45 + i * 0.13), z + Math.sin(a) * len * 0.3, w * 0.55, len, w * 0.55, color,
      { ry: a, rz: 0.7 + rnd() * 0.4 });
  }
}

function mushroom(v, x, z, s, cap, capTarget = v) {
  v.box(x, 0, z, 0.5 * s, 1 * s, 0.5 * s, '#f4ead8');
  capTarget.box(x, s, z, 1.5 * s, 0.6 * s, 1.5 * s, cap);
}

function lantern(ctx, x, z, light) {
  const { v, glow } = ctx;
  v.box(x, 0, z, 0.4, 4.2, 0.4, '#2a2a30');
  v.box(x, 4.2, z, 1.6, 0.3, 1.6, '#2a2a30');
  glow.box(x, 4.5, z, 1.1, 1.3, 1.1, light);
  v.box(x, 5.8, z, 1.6, 0.4, 1.6, '#2a2a30');
}

// ------------------------------------------------------------------ biome decor

// ------------------------------------------------------------------ dojo + garden pieces

const GOLD = '#ffcc33';
// a round-ish thing from two boxes, the second turned 45 degrees
function octo(v, x, y, z, w, h, color) {
  v.box(x, y, z, w, h, w * 0.83, color);
  v.box(x, y, z, w, h, w * 0.83, color, { ry: Math.PI / 2 });
  v.box(x, y, z, w * 0.9, h, w * 0.9, color, { ry: Math.PI / 4 });
}

// A big leather punching bag with gold bands on a thin pole up to the roof beams (like the video).
function punchingBag(ctx, x, z) {
  const { v } = ctx;
  v.box(x, 0, z, 0.5, 58, 0.5, '#8d939c');
  octo(v, x, 4.5, z, 5.8, 11, '#7a3a1e');
  for (const y of [5.6, 13.4]) octo(v, x, y, z, 6.2, 1.3, GOLD);
  octo(v, x, 15.5, z, 4.2, 0.8, '#4a2414');
  ctx.circle(x, z, 3.4);
}

// A wooden wing-chun dummy: a dark post on a round foot with gold-tipped arms sticking out.
function wingChun(ctx, x, z) {
  const { v, rnd } = ctx;
  octo(v, x, 0, z, 5, 0.7, '#3a2414');
  octo(v, x, 0.7, z, 1.9, 11, '#5a2a14');
  const ry = rnd() * Math.PI;
  for (const [y, a] of [[8.4, 0], [8.4, Math.PI / 2], [6.6, Math.PI / 4], [4.6, -Math.PI / 4], [10.2, Math.PI]]) {
    const dir = ry + a;
    const dx = Math.sin(dir), dz = Math.cos(dir);
    v.box(x + dx * 1.8, y, z + dz * 1.8, 0.7, 0.7, 3, '#7a3a1e', { ry: dir });
    v.box(x + dx * 3.4, y - 0.15, z + dz * 3.4, 1, 1, 1, GOLD, { ry: dir });
  }
  v.box(x, 11.7, z, 2.3, 0.6, 2.3, GOLD);
  ctx.circle(x, z, 2.4);
}

// A wooden training dummy on a blue foot, standing on a cream mat, with a white headband.
function trainingDummy(ctx, x, z) {
  const { v, rnd } = ctx;
  const ry = (rnd() - 0.5) * 0.6;
  v.box(x, 0.02, z, 10, 0.2, 10, '#efe2bf', { ry });
  v.box(x, 0.01, z, 10.8, 0.18, 10.8, '#c8a36a', { ry });
  v.box(x, 0.2, z, 3.2, 0.7, 3.2, '#3a5aa8', { ry });
  v.box(x, 0.9, z, 1, 4.4, 1, '#8a5530', { ry });
  v.box(x, 5.3, z, 2.8, 3.4, 1.5, '#a8683a', { ry });
  v.box(x, 7.4, z, 6.4, 0.9, 0.9, '#a8683a', { ry });
  v.box(x, 8.7, z, 1.9, 1.9, 1.9, '#c8874a', { ry });
  v.box(x, 9.5, z, 2.05, 0.5, 2.05, '#f4f2ea', { ry });
  v.box(x, 9.6, z, 2.1, 0.25, 2.1, '#d6283a', { ry });
  ctx.circle(x, z, 2.2);
}

// A little bonsai in a dark pot: a crooked trunk and blocky green cushions.
function bonsai(ctx, x, z) {
  const { v, rnd } = ctx;
  v.box(x, 0, z, 4.2, 2.2, 4.2, '#5a2a1c');
  v.box(x, 2.2, z, 4.6, 0.5, 4.6, '#3b2416');
  v.box(x, 2.7, z, 1.1, 4.5, 1.1, '#5a3a22', { rz: 0.15 });
  v.box(x + 0.8, 6.4, z, 0.8, 2.6, 0.8, '#5a3a22', { rz: -0.4 });
  const greens = ['#4fc24a', '#3fae3a', '#5ad450'];
  v.box(x + 0.4, 6.8, z, 6, 2.4, 5.4, greens[0], { ry: rnd() });
  v.box(x - 0.8, 8.8, z + 0.6, 4.2, 2, 4, greens[1], { ry: rnd() });
  v.box(x + 1.6, 8.4, z - 1, 3, 1.6, 3, greens[2], { ry: rnd() });
  ctx.circle(x, z, 2.6);
}

// A rack of training staffs and spears against the wall.
function weaponRack(ctx, x, z, side) {
  const { v } = ctx;
  for (const dz of [-4, 4]) v.box(x, 0, z + dz, 0.8, 9, 0.8, '#5a2a14');
  v.box(x, 7.6, z, 0.9, 0.8, 9.6, '#7a3a1e');
  v.box(x, 2.2, z, 0.9, 0.6, 9.6, '#7a3a1e');
  for (let k = 0; k < 5; k++) {
    const zz = z - 3 + k * 1.5;
    v.box(x + side * 0.9, 0, zz, 0.35, 11.5, 0.35, k % 2 ? '#c8a060' : '#8a5530', { rz: -side * 0.12 });
    if (k % 2 === 0) v.box(x + side * 0.2, 11.4, zz, 0.5, 1.4, 0.2, '#c8ccd4', { rz: -side * 0.12 });
  }
  ctx.rect(x - 1.5, x + 1.5, z - 5, z + 5);
}

function barrel(ctx, x, z) {
  const { v } = ctx;
  octo(v, x, 0, z, 4.2, 5.6, '#8a5230');
  for (const y of [0.9, 4.1]) octo(v, x, y, z, 4.45, 0.55, '#3a2a20');
  ctx.circle(x, z, 2.5);
}

// A tall cluster of bamboo: segmented green stalks with darker joints and a few leaves on top.
function bamboo(ctx, x, z, n = 5) {
  const { v, rnd, pick } = ctx;
  for (let i = 0; i < n; i++) {
    const bx = x + (rnd() - 0.5) * 5, bz = z + (rnd() - 0.5) * 5;
    const h = 14 + rnd() * 14, seg = 3.2;
    const c = pick(['#62d64c', '#4fc24a', '#74e05a']);
    for (let y = 0; y < h; y += seg) {
      v.box(bx, y, bz, 1.1, Math.min(seg, h - y) - 0.3, 1.1, c);
      v.box(bx, y + seg - 0.3, bz, 1.35, 0.3, 1.35, '#3f9a35');
    }
    v.box(bx + 1.2, h - 2, bz, 2.6, 0.3, 0.9, '#3fae3a', { ry: rnd() * 3, rz: 0.4 });
    v.box(bx - 1, h - 4, bz, 2.4, 0.3, 0.8, '#3fae3a', { ry: rnd() * 3, rz: -0.4 });
  }
  ctx.circle(x, z, 3.2);
}

// A big blocky tree (the video's): a brown trunk and a wide, flat, layered dark-green canopy.
function blockTree(ctx, x, z, s = 1) {
  const { v, rnd } = ctx;
  const h = 15 * s;
  v.box(x, 0, z, 3 * s, h, 3 * s, '#5a3a22');
  v.box(x, 0, z, 4.2 * s, 1.2, 4.2 * s, '#4a2e1a');
  v.box(x + 2.5 * s, h * 0.6, z, 4 * s, 1.2 * s, 1.2 * s, '#5a3a22', { rz: 0.5 });
  v.box(x - 2.2 * s, h * 0.7, z + 0.5, 3.6 * s, 1.1 * s, 1.1 * s, '#5a3a22', { rz: -0.5 });
  const ry = rnd() * 0.6;
  v.box(x, h - 1, z, 20 * s, 2.4 * s, 18 * s, '#2f8f30', { ry });
  v.box(x, h + 1.2 * s, z, 17 * s, 3.2 * s, 15 * s, '#3fae3a', { ry });
  v.box(x + 1.5 * s, h + 4.2 * s, z - 1, 11 * s, 3 * s, 10 * s, '#4cc445', { ry: ry + 0.3 });
  v.box(x - 3 * s, h + 3.6 * s, z + 3 * s, 7 * s, 2.4 * s, 6 * s, '#3fae3a', { ry: ry - 0.2 });
  ctx.circle(x, z, 2.4 * s);
}

// A stone lantern (toro): a stepped grey base, a post, a lit box and a wide roof.
function stoneLantern(ctx, x, z, s = 1) {
  const { v } = ctx;
  const glow = ctx.lamps || ctx.glow; // its light box comes on at night
  const g = ['#9aa0a8', '#858b94', '#b0b5bc'];
  v.box(x, 0, z, 3.6 * s, 0.9 * s, 3.6 * s, g[1]);
  v.box(x, 0.9 * s, z, 1.5 * s, 3.6 * s, 1.5 * s, g[0]);
  v.box(x, 4.5 * s, z, 3 * s, 0.6 * s, 3 * s, g[1]);
  glow.box(x, 5.1 * s, z, 2 * s, 2 * s, 2 * s, '#ffe9a0');
  ctx.lamps?.halo(x, 6.1 * s, z, 12, '#ffd88a');
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) v.box(x + dx * 1.15 * s, 5.1 * s, z + dz * 1.15 * s, 0.5 * s, 2 * s, 0.5 * s, g[0]);
  v.box(x, 7.1 * s, z, 4.4 * s, 0.9 * s, 4.4 * s, g[2]);
  v.box(x, 8 * s, z, 2.6 * s, 0.8 * s, 2.6 * s, g[1]);
  v.box(x, 8.8 * s, z, 0.8 * s, 0.9 * s, 0.8 * s, g[0]);
  ctx.circle(x, z, 2 * s);
}

// The video's little shrine: a black roof with gold horns on two brown posts, a lit offering box
// on a grey stone base.
function shrine(ctx, x, z) {
  const { v } = ctx;
  const glow = ctx.lamps || ctx.glow;
  ctx.lamps?.halo(x, 4, z, 10, '#ffd88a');
  v.box(x, 0, z, 7, 1, 6, '#9aa0a8');
  v.box(x, 1, z, 3.4, 2.4, 2.6, '#5a2a14');
  glow.box(x - 0.8, 3.4, z, 0.5, 1.2, 0.5, '#ffe9a0');
  glow.box(x + 0.8, 3.4, z, 0.5, 1.2, 0.5, '#ffe9a0');
  for (const dx of [-2.4, 2.4]) v.box(x + dx, 1, z, 0.9, 9, 0.9, '#5a2a14');
  v.box(x, 10, z, 11, 1.6, 5.4, '#1c1a20');
  v.box(x, 11.6, z, 8.4, 1.4, 4.4, '#1c1a20');
  v.box(x, 13, z, 5.4, 1.2, 3.4, '#1c1a20');
  for (const s of [-1, 1]) v.box(x + s * 6.2, 10.6, z, 2.6, 1.2, 1.6, GOLD, { rz: s * 0.6 });
  ctx.rect(x - 3.6, x + 3.6, z - 3.2, z + 3.2);
}

// ------------------------------------------------------------------ fire temple pieces

// The temple's emblem: an angular pixel-art sign in gold, crossed strokes round a solid heart
// (7 x 7 cells, row 0 at the top).
const FIRE_GLYPH = [
  '#..#..#',
  '.#.#.#.',
  '..###..',
  '#######',
  '..###..',
  '.#.#.#.',
  '#..#..#',
];

// A square emblem panel. along = 'z' for a panel on a side wall (facing x by `facing`), 'x' for one
// flat on the floor (y = top of whatever it lies on). size = the whole panel; bg / border / gold.
function emblem(v, x, y, z, size, { bg = '#14141a', border = '#ffcc33', gold = '#ffcc33', light = gold, facing = 0, flat = false, glyph = FIRE_GLYPH } = {}) {
  const cell = (size * 0.74) / 7;
  const t = 0.18; // how far each layer stands out
  if (flat) {
    v.box(x, y, z, size, t, size, border);
    v.box(x, y + t * 0.5, z, size * 0.88, t, size * 0.88, bg);
    glyph.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '.') v.box(x + (c - 3) * cell, y + t, z + (r - 3) * cell, cell * 0.92, t, cell * 0.92, ch === 'o' ? light : gold);
    }));
    return;
  }
  // on a wall: the panel's face points along -facing x... built as thin boxes
  v.box(x, y - size / 2, z, t, size, size, border);
  v.box(x + facing * t * 0.6, y - size * 0.44, z, t, size * 0.88, size * 0.88, bg);
  glyph.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '.') v.box(x + facing * t * 1.2, y + (3 - r) * cell - cell / 2, z + (c - 3) * cell * -facing, t, cell * 0.92, cell * 0.92, ch === 'o' ? light : gold);
  }));
}

// A pixel flame licking up the wall: stacked boxes narrowing to a point, orange round a yellow core.
function wallFlame(v, x, y, z, w, h, facing) {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    v.box(x, y + (h / steps) * i, z, 0.3, h / steps + 0.05, w * k, '#ff8a1a');
    if (i < steps - 1) v.box(x + facing * 0.2, y + (h / steps) * i, z, 0.3, h / steps + 0.05, w * k * 0.5, '#ffd23a');
  }
}

// Every animated thing of the corridor (the torch fires): update(dt, t) each frame.
// Things tied to one place (a torch, a nest's dust, a stage's bubbles) carry its z and only move while
// the player is within ANIMATE_NEAR of it: far off they are hidden in the distance or the mist anyway,
// and the CPU is saved for the frames that matter. The rest (shared clocks, sweeping beams) always run.
const ANIMATED = [];
const ANIMATE_NEAR = 520;
let animT = 0;
function animateNear(z, fn) {
  fn.z = z;
  ANIMATED.push(fn);
}
export function updateCorridor(dt, playerZ = null) {
  animT += dt;
  for (const a of ANIMATED) {
    if (a.z !== undefined && playerZ !== null && Math.abs(a.z - playerZ) > ANIMATE_NEAR) continue;
    a(dt, animT);
  }
}

// One of the two great torches at the end of the temple: a black column with red and gold bands, a
// gold emblem facing the path, a gold bowl on top and a fire in it that flickers and lights the
// floor round it.
function fireTorch(ctx, x, z) {
  const { v, scene } = ctx;
  const toLane = -Math.sign(x);
  octo(v, x, 0, z, 12, 2, '#101220');
  octo(v, x, 2, z, 9, 36, '#16182a');
  octo(v, x, 6, z, 9.4, 3.2, '#c8162a');
  octo(v, x, 9.4, z, 9.5, 1.2, '#ffcc33');
  octo(v, x, 27, z, 9.4, 2.4, '#c8162a');
  octo(v, x, 30, z, 9.5, 1.4, '#ffcc33');
  octo(v, x, 38, z, 11.5, 1.8, '#ffcc33');
  octo(v, x, 39.8, z, 10, 0.8, '#3a1408');
  emblem(v, x + toLane * 4.75, 24, z, 7.5, { bg: '#16182a', border: '#16182a', facing: toLane });
  ctx.circle(x, z, 5.2);
  if (!scene || typeof document === 'undefined') return;
  // the fire: a big plume out of the bowl, a red-orange body with tongues of flame licking up round
  // it and a yellow-white heart, embers flying up, a glow round it, all flickering
  const fire = new THREE.Group();
  fire.position.set(x, 40, z);
  const flameMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const cone = (r, h, mat, px = 0, pz = 0) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8, 1, true), mat);
    m.geometry.translate(0, h / 2, 0); // grows up from its base
    m.position.set(px, 0, pz);
    fire.add(m);
    return m;
  };
  const outer = flameMat('#ff3a0a', 0.85), mid = flameMat('#ff8a1a', 0.85), core = flameMat('#ffe88a', 0.95);
  const tongues = [
    { m: cone(4.8, 15, outer), h: 1 },
    { m: cone(3.6, 13, mid), h: 1 },
    { m: cone(2.1, 9, core), h: 1 },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tongues.push({ m: cone(1.6, 7 + (i % 3) * 2.5, i % 2 ? mid : outer, Math.cos(a) * 2.8, Math.sin(a) * 2.8), h: 1, phase: i * 1.7 });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff6a1a', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(34);
  glow.position.y = 6;
  fire.add(glow);
  const embers = Array.from({ length: 10 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: i % 2 ? '#ffb23a' : '#ff5a1a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(1.4);
    fire.add(s);
    return { s, t: i / 10, a: i * 2.1 };
  });
  const light = new THREE.PointLight('#ff8a3a', 900, 120, 1.6);
  light.position.set(0, 6, 0);
  fire.add(light);
  scene.add(fire);
  const seed = x * 0.37;
  animateNear(z, (dt, t) => {
    tongues.forEach((f, i) => {
      const p = f.phase ?? i;
      const s = 1 + Math.sin(t * (6 + i * 1.3) + seed + p) * 0.16 + Math.sin(t * 14.7 + p) * 0.08;
      f.m.scale.set(1 - (s - 1) * 0.4, s, 1 - (s - 1) * 0.4);
      f.m.rotation.y = t * (0.6 + i * 0.25);
    });
    for (const e of embers) {
      e.t = (e.t + dt * 0.55) % 1;
      e.a += dt * 1.5;
      e.s.position.set(Math.cos(e.a) * (1.5 + e.t * 3), 4 + e.t * 22, Math.sin(e.a) * (1.5 + e.t * 3));
      e.s.material.opacity = Math.sin(e.t * Math.PI);
    }
    const k = 0.85 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 23 + seed) * 0.05;
    light.intensity = 900 * k;
    glow.material.opacity = 0.6 + (k - 0.85) * 2;
  });
}

// A big lamp high on a fire-temple wall (one of four): a black bracket out from the wall under its
// orange top, a red and gold housing and a lit face pointing down at the floor. At night it lights
// a wide pool of warm light on the floor.
function highLamp(ctx, side, z) {
  const { v, lamps, scene } = ctx;
  const wx = side * (WALL_X - 1.5), y = WALL_H - 9;
  const x = wx - side * 7;
  v.box(wx - side * 3.5, y + 3, z, 7, 1.2, 1.6, '#16182a');          // the arm out from the wall
  v.box(wx - side * 1.2, y - 3, z, 1.2, 7, 1.6, '#16182a', { rz: side * 0.6 }); // its brace
  v.box(x, y, z, 6, 4, 6, '#16182a');
  v.box(x, y + 4, z, 6.6, 1, 6.6, '#c8162a');
  v.box(x, y - 0.6, z, 6.6, 0.7, 6.6, '#ffcc33');
  (lamps || ctx.glow).box(x, y - 1.6, z, 4.6, 1, 4.6, '#ffe7b0');
  if (!lamps || !scene) return;
  lamps.halo(x, y - 2.5, z, 30, '#ffc070');
  const light = new THREE.SpotLight('#ffb870', 0, 150, 0.8, 0.7, 1.4);
  light.position.set(x, y - 2, z);
  light.target.position.set(x - side * 26, 0, z);
  lamps.light(light, 6000);
}

// A searchlight on the floor by a fire-temple wall (one of four, two each side): a dark drum on a
// gold-rimmed stand, its pale beam shining up into the sky and slowly sweeping to and fro (stronger
// at night).
const BEAM_HEIGHT = 220;
const beamMaterials = new Map();
function searchBeamMaterial(color = '#d8ffe8') {
  if (beamMaterials.has(color)) return beamMaterials.get(color);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.35 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // brightest at the lamp, fading out high up
    fragmentShader: 'varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity; void main() { float a = pow(1.0 - vUv.y, 1.6); gl_FragColor = vec4(uColor, a * uOpacity); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  beamMaterials.set(color, beamMaterial);
  return beamMaterial;
}

// opts: color (the beam), base / rim (the stand), x and y (where the lamp sits), sway (how far it sweeps)
function searchlight(ctx, side, z, phase, { color = '#d8ffe8', base = '#16182a', rim = '#ffcc33', x = side * (H - 7), y = 0, sway = 1 } = {}) {
  const { v, scene, lamps } = ctx;
  if (y === 0) {
    octo(v, x, 0, z, 6, 1.2, base);
    octo(v, x, 1.2, z, 3.2, 2.4, rim);
    ctx.circle(x, z, 3.4);
  }
  if (!scene) return;
  const head = new THREE.Group();
  head.position.set(x, y + 4.2, z);
  scene.add(head);
  // the drum (it tilts with the beam) with a glowing face
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 3.2, 12), new THREE.MeshLambertMaterial({ color: '#202236' }));
  head.add(drum);
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.1, 16), new THREE.MeshBasicMaterial({ color: '#f0fff4' }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 1.62;
  head.add(face);
  const material = searchBeamMaterial(color);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(9, 1.9, BEAM_HEIGHT, 20, 1, true).translate(0, BEAM_HEIGHT / 2 + 1.6, 0), material);
  beam.renderOrder = 7;
  head.add(beam);
  ANIMATED.push((dt, t) => {
    // leaning out over the wall a little, sweeping slowly side to side and back and forth
    head.rotation.z = (side * 0.28 + Math.sin(t * 0.45 + phase) * 0.32) * sway;
    head.rotation.x = Math.sin(t * 0.31 + phase * 1.7) * 0.38 * sway;
    material.uniforms.uOpacity.value = 0.3 + 0.35 * Math.max(0, lamps?.k ?? 0);
  });
}

// ------------------------------------------------------------------ stages 4-6 (like the video)

// Pixel emblems (7 x 7): '#' in the emblem's gold, 'o' in its light colour.
const BOLT_GLYPH = [
  '....#o.',
  '...#o..',
  '..#o...',
  '.#oooo#',
  '...#o..',
  '..#o...',
  '.#o....',
];
const MOUNTAIN_GLYPH = [
  '...#...',
  '..#o#..',
  '..#o#..',
  '.#ooo#.',
  '.#ooo#.',
  '#ooooo#',
  '#######',
];
const STAR_GLYPH = [
  '...#...',
  '...#...',
  '..#o#..',
  '##ooo##',
  '..#o#..',
  '...#...',
  '...#...',
];

// Both walls painted in two bands (like the fire temple): a dark band below a bright line, the
// upper wall in stripes, a line along the top, big emblems up high and small ones along the band.
function twoBandWalls(ctx, o) {
  const { v, biome } = ctx;
  const FACE = WALL_X - 2.1, BAND = 16, mid = ctx.mid;
  for (const side of [-1, 1]) {
    const x = side * FACE, f = -side;
    v.box(x, 0, mid, 0.4, BAND, BIOME_DEPTH, o.band);
    v.box(x + f * 0.1, BAND, mid, 0.5, 1.1, BIOME_DEPTH, o.line);
    v.box(x, BAND + 1.1, mid, 0.4, WALL_H - BAND - 4, BIOME_DEPTH, o.upper);
    for (let z = biome.maxZ - 3; z > biome.minZ; z -= 6) v.box(x + f * 0.05, BAND + 1.1, z, 0.4, WALL_H - BAND - 4, 2.4, o.stripe);
    v.box(x + f * 0.1, WALL_H - 3.6, mid, 0.5, 1, BIOME_DEPTH, o.top || o.line);
    for (let z = biome.maxZ - 30; z > biome.minZ + 20; z -= o.bigStep || 52) emblem(v, x + f * 0.5, 46, z, 14, { ...o.big, facing: f });
    for (let z = biome.maxZ - 14; z > biome.minZ + 8; z -= o.smallStep || 26) emblem(v, x + f * 0.5, 12, z, 6.5, { ...o.small, facing: f });
  }
}

// A rug on the floor: a bright edge round a panel with the stage's emblem.
function floorRug(v, x, z, w, d, edge, bg, look) {
  v.box(x, 0.02, z, w, 0.16, d, edge);
  v.box(x, 0.06, z, w * 0.9, 0.16, d * 0.86, bg);
  emblem(v, x, 0.22, z, Math.min(w, d) * 0.72, { ...look, flat: true, bg, border: bg });
}

function stageRugs(ctx, edge, bg, look) {
  const { v, biome, rnd } = ctx;
  for (let z = biome.maxZ - 60; z > biome.minZ + 50; z -= 110) floorRug(v, (rnd() - 0.5) * 8, z, 14, 11, edge, bg, look);
  for (let i = 0; i < 5; i++) {
    const p = ctx.spot(8, false);
    if (p) floorRug(v, p.x, p.z, 13, 10, edge, bg, look);
  }
}

// A glowing ball: two crossed boxes in the lamp set (they light up at night) and a halo.
function glowBall(ctx, x, y, z, r, color, halo = color) {
  const target = ctx.lamps || ctx.glow;
  target.box(x, y - r, z, r * 2, r * 2, r * 1.4, color);
  target.box(x, y - r * 0.7, z, r * 1.4, r * 1.4, r * 2, color);
  target.box(x, y - r * 0.85, z, r * 1.7, r * 1.7, r * 1.7, color, { ry: Math.PI / 4 });
  ctx.lamps?.halo(x, y, z, r * 9, halo);
}

// A tall pillar at the end of a stage with a glowing top and a beam of light going up out of it.
// look: { body, band, cap, glow, beam, rings? }
function endPillar(ctx, x, z, look, phase) {
  const { v } = ctx;
  octo(v, x, 0, z, 11, 2, look.body);
  octo(v, x, 2, z, 8, 36, look.body);
  if (look.rings) for (let y = 6; y < 36; y += 3) octo(v, x, y, z, 8.5, 1.2, look.band);
  else for (const y of [6, 27]) octo(v, x, y, z, 8.6, 2.4, look.band);
  octo(v, x, 38, z, 11, 1.6, look.cap);
  octo(v, x, 39.6, z, 8, 1, look.body);
  glowBall(ctx, x, 44, z, 2.6, look.glow);
  ctx.circle(x, z, 4.8);
  searchlight(ctx, Math.sign(x), z, phase, { color: look.beam, x, y: 40, sway: 0.25 });
}

// ---- Stage 4: Blue Ninja's Lightning Ruins

// A tesla coil by the wall: a dark foot, a yellow ring, a blue coil, an orange plate and a glowing
// electric orb on top (and now and then a little spark jumps round it).
function teslaCoil(ctx, x, z) {
  const { v, scene } = ctx;
  octo(v, x, 0, z, 6.5, 1.4, '#10183a');
  octo(v, x, 1.4, z, 5.6, 0.9, '#ffd84a');
  for (let i = 0; i < 8; i++) octo(v, x, 2.3 + i * 0.8, z, i % 2 ? 3.2 : 3.6, 0.8, i % 2 ? '#1a3a9a' : '#3a8aff');
  octo(v, x, 8.7, z, 1.4, 1.6, '#10183a');
  octo(v, x, 10.3, z, 7, 0.9, '#e07a3a');
  octo(v, x, 11.2, z, 5.4, 0.4, '#c8602a');
  glowBall(ctx, x, 13.4, z, 1.8, '#bff4ff', '#7fe0ff');
  ctx.circle(x, z, 3.4);
  if (!scene) return;
  // a little crackle of lightning round the orb
  const spark = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 4, 10), new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spark.position.set(x, 13.4, z);
  scene.add(spark);
  const seed = x * 0.7 + z * 0.13;
  animateNear(z, (dt, t) => {
    const on = Math.sin(t * 3.1 + seed) > 0.55 || Math.sin(t * 7.7 + seed * 2) > 0.92;
    spark.visible = on;
    if (on) spark.rotation.set(t * 9 + seed, t * 5, t * 11);
  });
}

const STORM_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    twoBandWalls(ctx, {
      band: '#141c4a', line: '#ffd84a', upper: '#2a56d0', stripe: '#2450c0', top: '#ffd84a',
      big: { glyph: BOLT_GLYPH, bg: '#0e1640', border: '#ffd84a', gold: '#ffe24a', light: '#ffffff' },
      small: { glyph: BOLT_GLYPH, bg: '#0e1640', border: '#3a6ae0', gold: '#ffe24a', light: '#ffffff' },
    });
    stageRugs(ctx, '#ffd84a', '#2a56d0', { glyph: BOLT_GLYPH, gold: '#ffe24a', light: '#ffffff' });
  },
  landmarks(ctx) {
    const { biome } = ctx;
    // tesla coils along both walls
    for (const s of [-1, 1]) {
      for (let z = biome.maxZ - 24; z > biome.minZ + 40; z -= 42) {
        const x = s * (H - 10);
        if (ctx.ok(x, z, 4)) teslaCoil(ctx, x, z);
      }
    }
    // the two tall striped pillars at the far end, crackling orbs on top, beams going up
    let phase = 0.4;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#10183a', band: '#3a8aff', cap: '#e07a3a', glow: '#bff4ff', beam: '#bfeaff', rings: true }, phase++);
  },
  small() {},
};

// ---- Stage 5: Black Ninja's Earth Caves

// Mine-cart rails along the floor: two steel rails on wooden sleepers.
function mineRails(ctx, x, z0, z1) {
  const { v } = ctx;
  const len = Math.abs(z1 - z0), mid = (z0 + z1) / 2;
  for (let z = Math.min(z0, z1) + 1.5; z < Math.max(z0, z1); z += 3.2) v.box(x, 0, z, 7, 0.4, 1.3, '#7a5432');
  for (const dx of [-2.2, 2.2]) v.box(x + dx, 0.4, mid, 0.5, 0.5, len, '#9aa0aa');
}

// A mine cart full of glowing gold ore.
function mineCart(ctx, x, z) {
  const { v } = ctx;
  for (const dz of [-2, 2]) for (const dx of [-2.2, 2.2]) v.box(x + dx, 0.3, z + dz, 0.6, 1.4, 1.4, '#16161c');
  v.box(x, 1.4, z, 5.4, 3, 7, '#3a3f55');
  v.box(x, 4.2, z, 5.8, 0.4, 7.4, '#2a2e40');
  (ctx.lamps || ctx.glow).box(x, 3.8, z, 4.6, 1.2, 6.2, '#ffd23a');
  ctx.lamps?.halo(x, 5, z, 12, '#ffcc33');
  ctx.rect(x - 3, x + 3, z - 3.8, z + 3.8);
}

// A cluster of yellow crystals, glowing at night.
function crystalCluster(ctx, x, z, s = 1) {
  const { v, rnd } = ctx;
  const target = ctx.lamps || ctx.glow;
  octo(v, x, 0, z, 6 * s, 0.8, '#2a2e40');
  const parts = [[0, 0, 0, 2.2, 9, 0], [1.8, 0.6, 0.4, 1.6, 6, 0.45], [-1.8, -0.4, 0.2, 1.5, 5.4, -0.5], [0.4, 1.6, -0.3, 1.3, 4.4, 0.3]];
  for (const [dx, dz, , w, h, rz] of parts) target.box(x + dx * s, 0.6, z + dz * s, w * s, h * s, w * s, '#ffe23a', { rz, ry: rnd() * 3 });
  ctx.lamps?.halo(x, 5 * s, z, 16 * s, '#ffe23a');
  ctx.circle(x, z, 2.8 * s);
}

const EARTH_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    const { v, biome } = ctx;
    twoBandWalls(ctx, {
      band: '#1a1e34', line: '#e09a2a', upper: '#262b48', stripe: '#22263f', top: '#e09a2a',
      big: { glyph: MOUNTAIN_GLYPH, bg: '#14162a', border: '#e09a2a', gold: '#e0a83a', light: '#f4e0b0' },
      small: { glyph: MOUNTAIN_GLYPH, bg: '#14162a', border: '#e09a2a', gold: '#e0a83a', light: '#f4e0b0' },
    });
    // little gold lamps along the dark band
    for (const side of [-1, 1]) {
      for (let z = biome.maxZ - 27; z > biome.minZ + 8; z -= 26) {
        const x = side * (WALL_X - 2.6);
        v.box(x, 0, z, 2.4, 1.2, 2.4, '#2a2e40');
        (ctx.lamps || ctx.glow).box(x, 1.2, z, 1.8, 1, 1.8, '#ffd23a');
        ctx.lamps?.halo(x, 2, z, 6, '#ffcc33');
      }
    }
    stageRugs(ctx, '#e0a83a', '#14162a', { glyph: MOUNTAIN_GLYPH, gold: '#e0a83a', light: '#f4e0b0' });
  },
  landmarks(ctx) {
    const { biome, nest } = ctx;
    // two mine-cart tracks, one each side, with carts on them
    for (const s of [-1, 1]) {
      const x = s * 54;
      const segs = [[biome.maxZ - 20, ctx.mid + 40], [ctx.mid - 40, biome.minZ + 40]];
      for (const [a, b] of segs) {
        if (Math.abs(x - nest.x) < 30 && Math.min(a, b) < nest.z + 30 && Math.max(a, b) > nest.z - 30) continue;
        mineRails(ctx, x, a, b);
        mineCart(ctx, x, (a + b) / 2 + s * 18);
      }
    }
    // yellow crystal clusters by the walls
    for (let i = 0; i < 6; i++) {
      const p = ctx.spot(4, true);
      if (p) crystalCluster(ctx, p.x, p.z, 1 + ctx.rnd() * 0.5);
    }
    // the two navy pillars at the far end with glowing gold tops and beams
    let phase = 1.1;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#20243e', band: '#e09a2a', cap: '#e09a2a', glow: '#ffe23a', beam: '#fff0a0' }, phase++);
  },
  small() {},
};

// ---- Stage 6: Green Ninja's Energy Temple

// A bright green tree (like the video): a black trunk and a blocky light-green canopy.
function energyTree(ctx, x, z) {
  const { v, rnd } = ctx;
  v.box(x, 0, z, 3, 1, 3, '#101010');
  v.box(x, 1, z, 2.2, 9, 2.2, '#1a1a1a');
  const ry = rnd() * 0.5;
  v.box(x, 9, z, 12, 3, 11, '#4cc445', { ry });
  v.box(x, 12, z, 10, 3, 9, '#5ad450', { ry });
  v.box(x - 2, 14.5, z + 1, 6, 2, 5, '#6ae05a', { ry });
  ctx.circle(x, z, 2);
}

// A pillar of green energy rising out of a glowing pad on the floor, with sparks spiralling up it.
function energyBeam(ctx, x, z, phase) {
  const { v, scene } = ctx;
  octo(v, x, 0, z, 7, 0.6, '#1e7a28');
  (ctx.lamps || ctx.glow).box(x, 0.6, z, 4.4, 0.3, 4.4, '#d8ff8a');
  ctx.lamps?.halo(x, 1.5, z, 14, '#aaff6a');
  searchlight(ctx, Math.sign(x) || 1, z, phase, { color: '#c8ff9a', x, y: -3, sway: 0.12 });
  if (!scene) return;
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#eaffb0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(2.2);
    scene.add(s);
    return { s, t: i / 8 };
  });
  animateNear(z, (dt) => {
    for (const p of sparks) {
      p.t = (p.t + dt * 0.25) % 1;
      const a = p.t * Math.PI * 8 + phase;
      p.s.position.set(x + Math.cos(a) * (2 + p.t * 3), 1 + p.t * 60, z + Math.sin(a) * (2 + p.t * 3));
      p.s.material.opacity = Math.sin(p.t * Math.PI);
    }
  });
}

const ENERGY_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    twoBandWalls(ctx, {
      band: '#1e8a30', line: '#e8d23a', upper: '#2fae3a', stripe: '#28a034', top: '#e8d23a',
      big: { glyph: STAR_GLYPH, bg: '#14701e', border: '#e8d23a', gold: '#e8ff3a', light: '#fffbc0' },
      small: { glyph: STAR_GLYPH, bg: '#14701e', border: '#e8d23a', gold: '#d8ff3a', light: '#fffbc0' },
    });
    stageRugs(ctx, '#e8d23a', '#28a034', { glyph: STAR_GLYPH, gold: '#e8ff3a', light: '#fffbc0' });
  },
  landmarks(ctx) {
    const { biome } = ctx;
    // green trees along the walls
    for (const s of [-1, 1]) {
      for (let z = biome.maxZ - 40; z > biome.minZ + 40; z -= 70) {
        const x = s * (H - 13);
        if (ctx.ok(x, z, 7)) energyTree(ctx, x, z);
      }
    }
    // four beams of green energy rising from the floor, two each side
    let phase = 0;
    for (const s of [-1, 1]) {
      for (const z of [biome.maxZ - 70, biome.minZ + 90]) {
        const x = s * 44;
        if (ctx.ok(x, z, 4)) energyBeam(ctx, x, z, phase);
        phase += 1.7;
      }
    }
    // the two green pillars at the far end with glowing tops
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#1e7a28', band: '#e8d23a', cap: '#e8d23a', glow: '#eaff7a', beam: '#d8ffa0' }, phase++);
  },
  small() {},
};

// ---- Stage 7: White Ninja's Ice Temple, Stage 8: Water Queen's Sea Kingdom

const SNOW_GLYPH = [
  '...#...',
  '.#.#.#.',
  '..###..',
  '###o###',
  '..###..',
  '.#.#.#.',
  '...#...',
];
const DROP_GLYPH = [
  '...#...',
  '..#o#..',
  '.#ooo#.',
  '#oo#oo#',
  '#ooooo#',
  '.#ooo#.',
  '..###..',
];

// A snowy pine: a dark trunk and four tiers of green, each with snow lying on top.
function snowPine(ctx, x, z, s = 1) {
  const { v, rnd } = ctx;
  v.box(x, 0, z, 2 * s, 4 * s, 2 * s, '#5a3a22');
  const tiers = [[9, 3.2], [7.2, 6.2], [5.2, 9], [3.2, 11.6]];
  const ry = rnd() * 0.4;
  for (const [w, y] of tiers) {
    v.box(x, y * s, z, w * s, 2.4 * s, w * s, '#2a9a3a', { ry });
    v.box(x, (y + 2.4) * s, z, w * 0.8 * s, 0.5 * s, w * 0.8 * s, '#ffffff', { ry });
  }
  v.box(x, 14 * s, z, 1.4 * s, 1.4 * s, 1.4 * s, '#2a9a3a', { ry });
  ctx.circle(x, z, 2.2 * s);
}

// A big ice crystal: a few tall glowing shards on a snowy base.
function iceCrystal(ctx, x, z, s = 1, color = '#bff0ff') {
  const { v, rnd } = ctx;
  const target = ctx.lamps || ctx.glow;
  v.box(x, 0, z, 6 * s, 1 * s, 6 * s, '#e8f4fc');
  for (const [dx, dz, w, h, rz] of [[0, 0, 2.6, 13, 0], [1.8, 0.8, 1.8, 8, 0.35], [-1.6, -0.6, 1.6, 7, -0.4], [0.4, 1.8, 1.3, 5, 0.2]]) {
    target.box(x + dx * s, 0.8 * s, z + dz * s, w * s, h * s, w * s, color, { rz, ry: 0.785 + rnd() * 0.3 });
  }
  ctx.lamps?.halo(x, 7 * s, z, 22 * s, color);
  ctx.circle(x, z, 3 * s);
}

// A frozen puddle on the snow: pale blue ice with a lighter rim and a crack or two.
function icePatch(ctx, x, z, w, d) {
  const { v, rnd } = ctx;
  const ry = rnd() * 0.5;
  v.box(x, 0.02, z, w + 1, 0.12, d + 1, '#d4ecfa', { ry });
  v.box(x, 0.06, z, w, 0.12, d, '#a8dcf6', { ry });
  v.box(x, 0.1, z, w * 0.6, 0.08, 0.25, '#e8f8ff', { ry: ry + 0.5 });
}

const ICE_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    const { biome, rnd } = ctx;
    twoBandWalls(ctx, {
      band: '#7fb4e8', line: '#d8f0ff', upper: '#eef4fc', stripe: '#dae6f6', top: '#bfe4ff',
      big: { glyph: SNOW_GLYPH, bg: '#1a3a8a', border: '#7fc8ff', gold: '#8ae4ff', light: '#ffffff' },
      small: { glyph: SNOW_GLYPH, bg: '#2a5ab4', border: '#bfe4ff', gold: '#bff0ff', light: '#ffffff' },
    });
    stageRugs(ctx, '#7fc8ff', '#2a5ab4', { glyph: SNOW_GLYPH, gold: '#bff0ff', light: '#ffffff' });
    // frozen puddles here and there
    for (let i = 0; i < 7; i++) {
      const p = ctx.spot(9, false);
      if (p) icePatch(ctx, p.x, p.z, 10 + rnd() * 8, 7 + rnd() * 5);
    }
    // snowy pines along both walls
    for (const s of [-1, 1]) {
      for (let z = biome.maxZ - 20 - rnd() * 10; z > biome.minZ + 20; z -= 30 + rnd() * 14) {
        const x = s * (H - 9 - rnd() * 4);
        if (ctx.ok(x, z, 5)) snowPine(ctx, x, z, 0.8 + rnd() * 0.4);
      }
    }
  },
  landmarks(ctx) {
    const { biome, rnd } = ctx;
    for (let i = 0; i < 5; i++) {
      const p = ctx.spot(5, rnd() < 0.5);
      if (p) iceCrystal(ctx, p.x, p.z, 0.9 + rnd() * 0.5);
    }
    let phase = 2.3;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#e8f2fc', band: '#7fb4e8', cap: '#bfe4ff', glow: '#bff0ff', beam: '#d8f4ff', rings: true }, phase++);
  },
  small() {},
};

// The water's light: a net of bright wavy lines, the light the waves throw through the water.
let causticTex = null;
function causticTexture() {
  if (causticTex) return causticTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3.5;
  g.lineJoin = 'round';
  // a jittered grid of cells, each outlined with wobbly lines (tiles seamlessly: points wrap)
  const N = 6, pts = [];
  const rr = (i, j, k) => (Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453) % 1;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const wi = i % N, wj = j % N;
    pts.push([i * (256 / N) + Math.abs(rr(wi, wj, 1)) * 26 - 13, j * (256 / N) + Math.abs(rr(wi, wj, 2)) * 26 - 13]);
  }
  const P = (i, j) => pts[j * (N + 1) + i];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    for (const [a, b] of [[P(i, j), i < N ? P(i + 1, j) : null], [P(i, j), j < N ? P(i, j + 1) : null]]) {
      if (!b) continue;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.18, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.18;
      g.quadraticCurveTo(mx, my, b[0], b[1]);
      g.stroke();
    }
  }
  causticTex = canvasTextureOf(c);
  causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping;
  return causticTex;
}
function canvasTextureOf(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Red coral: a trunk with branches.
function coral(ctx, x, z, s = 1) {
  const { v, rnd } = ctx;
  const c = rnd() < 0.5 ? '#e0283a' : '#ff5a6a';
  v.box(x, 0, z, 0.9 * s, 5 * s, 0.9 * s, c);
  for (const [dx, y, h, rz] of [[1, 2, 3.6, -0.6], [-1, 3, 3.2, 0.6], [0.6, 4.5, 2.4, -0.4], [-0.5, 1.2, 2, 0.8]]) {
    v.box(x + dx * s, y * s, z, 0.7 * s, h * s, 0.7 * s, c, { rz });
  }
  ctx.circle(x, z, 1.2 * s);
}

// Seaweed: a few tall green stalks leaning this way and that.
function seaweed(ctx, x, z) {
  const { v, rnd } = ctx;
  for (let k = 0; k < 4; k++) {
    const bx = x + (rnd() - 0.5) * 3, bz = z + (rnd() - 0.5) * 3, h = 7 + rnd() * 9;
    for (let y = 0; y < h; y += 2) v.box(bx + Math.sin(y * 0.5 + k) * 0.5, y, bz, 0.7, 2.1, 0.5, y % 4 ? '#3ad08a' : '#2ab474');
  }
}

// A blue starfish lying on the floor.
function starfish(ctx, x, z) {
  const { v, rnd } = ctx;
  const ry = rnd() * 3;
  for (let k = 0; k < 5; k++) v.box(x, 0, z, 0.9, 0.4, 3.6, '#2a7ae0', { ry: ry + (k / 5) * Math.PI * 2 });
  v.box(x, 0.2, z, 1.4, 0.4, 1.4, '#5ab8ff', { ry });
}

// A glowing water crystal on a dark blue base (the video's big glowing pillars).
function waterCrystal(ctx, x, z, s = 1) {
  const { v } = ctx;
  v.box(x, 0, z, 7 * s, 1.6 * s, 7 * s, '#0e2a6a');
  v.box(x, 1.6 * s, z, 5.4 * s, 0.6 * s, 5.4 * s, '#1a4ab0');
  const target = ctx.lamps || ctx.glow;
  target.box(x, 2.2 * s, z, 3.6 * s, 11 * s, 3 * s, '#9ff0ff', { ry: 0.3 });
  target.box(x + 1.4 * s, 9 * s, z, 2.4 * s, 4 * s, 2.4 * s, '#d8faff', { rz: -0.5, ry: 0.3 });
  ctx.lamps?.halo(x, 8 * s, z, 26 * s, '#9ff0ff');
  ctx.circle(x, z, 3.6 * s);
}

const WATER_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    const { biome, rnd, scene } = ctx;
    twoBandWalls(ctx, {
      band: '#123a8a', line: '#7fe0ff', upper: '#62ccf2', stripe: '#52bcea', top: '#bff4ff',
      big: { glyph: DROP_GLYPH, bg: '#0e2a6a', border: '#7fe0ff', gold: '#7fd8ff', light: '#d8faff' },
      small: { glyph: DROP_GLYPH, bg: '#0e2a6a', border: '#3a8ae0', gold: '#7fd8ff', light: '#ffffff' },
    });
    stageRugs(ctx, '#bff4ff', '#e8f4fa', { glyph: DROP_GLYPH, gold: '#3a9ae0', light: '#bff4ff' });
    for (const s of [-1, 1]) {
      for (let z = biome.maxZ - 30; z > biome.minZ + 30; z -= 38 + rnd() * 18) {
        const x = s * (H - 8 - rnd() * 6);
        if (!ctx.ok(x, z, 3)) continue;
        const k = rnd();
        if (k < 0.4) seaweed(ctx, x, z);
        else if (k < 0.7) coral(ctx, x, z, 1 + rnd() * 0.4);
        else starfish(ctx, x, z);
      }
    }
    if (!scene || typeof document === 'undefined') return;
    // the water itself: a see-through box filling the whole stage (its ceiling is the waves above,
    // its front a wall of water you walk into from the ice temple), with the waves' light on it
    const tex = causticTexture();
    const top = tex.clone(); top.needsUpdate = true; top.repeat.set((H * 2) / 40, BIOME_DEPTH / 40);
    const side = tex.clone(); side.needsUpdate = true; side.repeat.set(BIOME_DEPTH / 40, WALL_H / 40);
    const end = tex.clone(); end.needsUpdate = true; end.repeat.set((H * 2) / 40, WALL_H / 40);
    const waterMat = (map, opacity, color = '#2a8ae0') => new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const sideMat = waterMat(side, 0.3);
    const materials = [sideMat, sideMat, waterMat(top, 0.75, '#1a6ad0'), new THREE.MeshBasicMaterial({ visible: false }), waterMat(end, 0.55), waterMat(end, 0.55)];
    const box = new THREE.Mesh(new THREE.BoxGeometry(H * 2 - 2, WALL_H - 1, BIOME_DEPTH), materials);
    box.position.set(0, (WALL_H - 1) / 2, ctx.mid);
    box.renderOrder = 9;
    scene.add(box);
    // the waves' light moving over the floor
    const floorTex = tex.clone(); floorTex.needsUpdate = true; floorTex.repeat.set((H * 2) / 26, BIOME_DEPTH / 26);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(H * 2, BIOME_DEPTH), new THREE.MeshBasicMaterial({
      map: floorTex, color: '#d8faff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.14, ctx.mid);
    floor.renderOrder = 2;
    scene.add(floor);
    // bubbles rising all through the water (one Points)
    const N = 160;
    const pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) seeds.push({ x: (rnd() * 2 - 1) * (H - 4), z: biome.minZ + rnd() * BIOME_DEPTH, y: rnd() * WALL_H, v: 3 + rnd() * 5, w: rnd() * 6 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ring = document.createElement('canvas');
    ring.width = ring.height = 64;
    const g = ring.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5;
    g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(24, 22, 5, 0, Math.PI * 2); g.fill();
    const bubbles = new THREE.Points(geo, new THREE.PointsMaterial({ map: canvasTextureOf(ring), size: 1.6, transparent: true, depthWrite: false, color: '#e8fbff' }));
    bubbles.frustumCulled = false;
    scene.add(bubbles);
    animateNear(ctx.mid, (dt, t) => {
      top.offset.x = t * 0.02; top.offset.y = t * 0.013;
      floorTex.offset.x = -t * 0.025; floorTex.offset.y = t * 0.018;
      side.offset.x = t * 0.015;
      for (let i = 0; i < N; i++) {
        const b = seeds[i];
        b.y += b.v * dt;
        if (b.y > WALL_H - 2) b.y = 0;
        pos[i * 3] = b.x + Math.sin(t * 1.5 + b.w) * 0.6;
        pos[i * 3 + 1] = b.y;
        pos[i * 3 + 2] = b.z;
      }
      geo.attributes.position.needsUpdate = true;
    });
  },
  landmarks(ctx) {
    const { biome, rnd } = ctx;
    for (const s of [-1, 1]) {
      for (const z of [biome.maxZ - 70, ctx.mid + 20, biome.minZ + 90]) {
        const x = s * (H - 18);
        if (ctx.ok(x, z, 5)) waterCrystal(ctx, x, z, 0.9 + rnd() * 0.3);
      }
    }
    let phase = 3.1;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#0e2a6a', band: '#3ab0e0', cap: '#7fe0ff', glow: '#9ff0ff', beam: '#bff4ff', rings: true }, phase++);
  },
  small() {},
};

// ------------------------------------------------------------------ stages 9-10 (like the video)

// A spinning whirl of light falling from a lamp onto the floor: an open cone (narrow at the lamp,
// wide at the floor) with bright swirling bands running round and down it and a few glints, and a
// round pool of light on the floor under it with swirling arms turning in it. Shared materials per
// colour (one clock each); on a weak device / connection the cones are hidden and only the pools
// on the floor stay. Brighter at night.
const whirlMaterials = new Map();
function lightWhirlMaterials(color, lamps) {
  if (whirlMaterials.has(color)) return whirlMaterials.get(color);
  const uniforms = { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uK: { value: 0.6 } };
  const vertexShader = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const cone = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform vec3 uColor; uniform float uTime; uniform float uK;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // bands winding round the cone, turning as they fall
        float s = sin(vUv.x * 6.2832 * 3.0 + vUv.y * 9.0 + uTime * 5.0);
        float bands = smoothstep(0.55, 1.0, s);
        float fine = smoothstep(0.8, 1.0, sin(vUv.x * 6.2832 * 7.0 - vUv.y * 14.0 + uTime * 7.0));
        // glints sparkling on it
        vec2 cell = floor(vec2(vUv.x * 40.0, vUv.y * 20.0 + uTime * 3.0));
        float glint = step(0.985, hash(cell + floor(uTime * 6.0)));
        float a = 0.16 + bands * 0.6 + fine * 0.35 + glint * 0.9;
        a *= mix(0.45, 1.0, vUv.y) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), bands * 0.35 + glint * 0.6), a * uK);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const pool = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform vec3 uColor; uniform float uTime; uniform float uK;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float arms = 0.5 + 0.5 * sin(ang * 4.0 + r * 9.0 - uTime * 4.0);
        float ring = smoothstep(0.1, 0.0, abs(r - fract(uTime * 0.5)));
        float a = pow(1.0 - r, 1.4) * (0.45 + 0.55 * arms) + ring * (1.0 - r) * 0.5;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), (1.0 - r) * 0.35), a * uK);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const set = { cone, pool };
  whirlMaterials.set(color, set);
  ANIMATED.push((dt, t) => {
    uniforms.uTime.value = t;
    uniforms.uK.value = 0.6 + 0.5 * Math.max(0, lamps?.k ?? 0);
    cone.visible = FX.fancy;
  });
  return set;
}

const whirlCones = new Map();
function lightWhirl(ctx, x, top, z, r, color) {
  const { scene, lamps } = ctx;
  if (!scene || typeof document === 'undefined') return;
  const m = lightWhirlMaterials(color, lamps);
  const key = `${r}|${top}`;
  if (!whirlCones.has(key)) whirlCones.set(key, new THREE.CylinderGeometry(r * 0.12, r, top, 28, 1, true).translate(0, top / 2, 0));
  const cone = new THREE.Mesh(whirlCones.get(key), m.cone);
  cone.position.set(x, 0.05, z);
  cone.renderOrder = 7;
  scene.add(cone);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), m.pool);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, 0.2, z);
  pool.renderOrder = 3;
  scene.add(pool);
}

// A pool of coloured light spreading over the floor (the pink torches): soft, pulsing slowly.
const poolMaterials = new Map();
function lightPool(ctx, x, z, r, color, y = 0.2) {
  const { scene, lamps } = ctx;
  if (!scene || typeof document === 'undefined') return;
  let mat = poolMaterials.get(color);
  if (!mat) {
    const m = new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    mat = m;
    poolMaterials.set(color, m);
    ANIMATED.push((dt, t) => { m.opacity = (0.55 + 0.35 * Math.max(0, lamps?.k ?? 0)) * (0.9 + Math.sin(t * 2.3) * 0.1); });
  }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(x, y, z);
  pool.renderOrder = 3;
  scene.add(pool);
}

// ---- Stage 9: Ghost Ninja's Haunted District

// a square spiral (9 x 9): the green tiles on the floor; and a 7 x 7 one for the signs
const SPIRAL_9 = [
  '#########',
  '........#',
  '#######.#',
  '#.....#.#',
  '#.###.#.#',
  '#.#.#.#.#',
  '#.#...#.#',
  '#.#####.#',
  '#.......#',
];
const SPIRAL_GLYPH = [
  '#######',
  '......#',
  '#####.#',
  '#...#.#',
  '#.#.#.#',
  '#.###.#',
  '#.....#',
];

// A glowing green spiral tile on the floor: a dark square with the spiral in bright green (each
// row's runs merged into one box).
function spiralTile(ctx, x, z, size, ry = 0) {
  const { v, glow } = ctx;
  const cell = size / 9;
  v.box(x, 0, z, size + cell, 0.1, size + cell, '#0c1a12', { ry });
  const c = Math.cos(ry), s = Math.sin(ry);
  SPIRAL_9.forEach((row, r) => {
    let c0 = -1;
    for (let k = 0; k <= 9; k++) {
      const on = row[k] === '#';
      if (on && c0 < 0) c0 = k;
      if (!on && c0 >= 0) {
        const lx = ((c0 + k) / 2 - 4.5) * cell, lz = (r - 4) * cell;
        glow.box(x + lx * c + lz * s, 0.1, z - lx * s + lz * c, (k - c0) * cell, 0.06, cell * 0.9, '#2adc6a', { ry });
        c0 = -1;
      }
    }
  });
}

// A haunted house against a wall: a black block with a cap on top, rows of glowing four-pane mint
// windows (a few dark) and a door.
function hauntedHouse(ctx, side, z, w, h, depth = 8) {
  const { v, glow, rnd } = ctx;
  const FACE = WALL_X - 2.1;
  const xc = side * (FACE - depth / 2), front = side * (FACE - depth), f = -side;
  v.box(xc, 0, z, depth, h, w, '#0b0d0c');
  v.box(xc + f * 0.4, h, z, depth + 1.2, 1.2, w + 1.2, '#161c19');
  const cols = Math.max(1, Math.floor((w - 3) / 7));
  for (let y = 9; y < h - 5; y += 10) {
    for (let i = 0; i < cols; i++) {
      const wz = z + (i - (cols - 1) / 2) * 7;
      const lit = rnd() < 0.86;
      (lit ? glow : v).box(front + f * 0.1, y, wz, 0.3, 4.4, 4.4, lit ? '#b4ffd8' : '#1a2420');
      v.box(front + f * 0.3, y + 2.0, wz, 0.3, 0.4, 4.6, '#0b0d0c');
      v.box(front + f * 0.3, y, wz, 0.3, 4.4, 0.4, '#0b0d0c');
    }
  }
  // a door on the ground, its glass glowing faintly
  const dz = z + (rnd() - 0.5) * (w - 8);
  v.box(front + f * 0.15, 0, dz, 0.4, 7, 4.2, '#1e2622');
  glow.box(front + f * 0.3, 4.6, dz, 0.3, 1.6, 3.0, '#3a8a5a');
}

// A free-standing little house (one by the nest, like the video): black with lit windows all round.
function smallHouse(ctx, x, z, w, d, h) {
  const { v, glow } = ctx;
  v.box(x, 0, z, w, h, d, '#0b0d0c');
  v.box(x, h, z, w + 1, 1, d + 1, '#161c19');
  for (const sx of [-1, 1]) {
    for (let y = 6; y < h - 3; y += 8) {
      for (const k of [-0.25, 0.25]) {
        glow.box(x + sx * (w / 2 + 0.05), y, z + k * d, 0.3, 3.6, 3.6, '#b4ffd8');
        v.box(x + sx * (w / 2 + 0.25), y + 1.6, z + k * d, 0.3, 0.35, 3.8, '#0b0d0c');
        v.box(x + sx * (w / 2 + 0.25), y, z + k * d, 0.3, 3.6, 0.35, '#0b0d0c');
      }
    }
  }
  for (const sz of [-1, 1]) {
    for (let y = 6; y < h - 3; y += 8) {
      glow.box(x, y, z + sz * (d / 2 + 0.05), 3.6, 3.6, 0.3, '#b4ffd8');
      v.box(x, y + 1.6, z + sz * (d / 2 + 0.25), 3.8, 0.35, 0.3, '#0b0d0c');
      v.box(x, y, z + sz * (d / 2 + 0.25), 0.35, 3.6, 0.3, '#0b0d0c');
    }
  }
  ctx.rect(x - w / 2 - 0.5, x + w / 2 + 0.5, z - d / 2 - 0.5, z + d / 2 + 0.5);
}

// A street lamp by the lane: a black post with an arm reaching over the lane, a mint glass lamp
// hanging from it, and a spinning whirl of yellow-green light falling from it onto the floor.
function streetLamp(ctx, side, z) {
  const { v, lamps } = ctx;
  const x = side * (LANE + 3), lx = x - side * 4, top = 17;
  const lit = lamps || ctx.glow;
  v.box(x, 0, z, 1.6, 0.8, 1.6, '#0b0d0c');
  v.box(x, 0, z, 0.9, top + 0.8, 0.9, '#0b0d0c');
  v.box((x + lx) / 2, top, z, 4.9, 0.8, 0.8, '#0b0d0c');
  v.box(lx, top - 1.2, z, 0.3, 1.2, 0.3, '#0b0d0c');
  v.box(lx, top - 1.6, z, 2.2, 0.5, 2.2, '#0b0d0c');
  lit.box(lx, top - 4.1, z, 1.8, 2.5, 1.8, '#a8ffd8');
  lit.box(lx, top - 3.6, z, 2.3, 1.5, 1.2, '#a8ffd8');
  v.box(lx, top - 4.5, z, 1.4, 0.4, 1.4, '#0b0d0c');
  lamps?.halo(lx, top - 3, z, 10, '#a8ffd8');
  ctx.circle(x, z, 1);
  lightWhirl(ctx, lx, top - 4.2, z, 6.5, '#e8ff6a');
}

const GHOST_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    const { biome, rnd, glow, nest } = ctx;
    // both walls lined with black houses of different heights, windows glowing
    for (const side of [-1, 1]) {
      let z = biome.maxZ - 4;
      while (z > biome.minZ + 4) {
        const w = 16 + Math.floor(rnd() * 3) * 6;
        const zc = z - w / 2;
        if (zc - w / 2 < biome.minZ + 2) break;
        hauntedHouse(ctx, side, zc, w, 24 + Math.floor(rnd() * 4) * 8, 7 + rnd() * 4);
        z -= w + 2 + rnd() * 3;
      }
      // big green spiral signs high on the walls over the houses
      for (let sz = biome.maxZ - 40; sz > biome.minZ + 30; sz -= 70) {
        emblem(glow, side * (WALL_X - 2.6), 64, sz, 11, { glyph: SPIRAL_GLYPH, bg: '#06100a', border: '#2adc6a', gold: '#3aff8a', light: '#3aff8a', facing: -side });
      }
    }
    // green spiral tiles down the lane and scattered over the floor
    for (let z = biome.maxZ - 26; z > biome.minZ + 20; z -= 38) spiralTile(ctx, (rnd() - 0.5) * 4, z, 10, rnd() < 0.5 ? 0 : Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const p = ctx.spot(7, false);
      if (p) spiralTile(ctx, p.x, p.z, 9 + rnd() * 4, Math.floor(rnd() * 4) * Math.PI / 2);
    }
    // street lamps on both sides of the lane
    for (const side of [-1, 1]) {
      for (let z = biome.maxZ - 24 - (side > 0 ? 0 : 21); z > biome.minZ + 20; z -= 42) {
        if (Math.hypot(side * (LANE + 3) - nest.x, z - nest.z) < NEST_CLEAR + 2) continue;
        streetLamp(ctx, side, z);
      }
    }
  },
  landmarks(ctx) {
    const { biome, nest, rnd } = ctx;
    // a little house behind the guardian, like the video
    smallHouse(ctx, nest.side * 72, nest.z - 4, 12, 16, 22);
    for (let i = 0; i < 2; i++) {
      const p = ctx.spot(9, true);
      if (p && Math.abs(p.x) > 60) smallHouse(ctx, p.x, p.z, 10, 12, 16 + Math.floor(rnd() * 2) * 8);
    }
    let phase = 4.2;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 20, { body: '#0b0d0c', band: '#1e8a3a', cap: '#3aff8a', glow: '#a8ffd8', beam: '#c8ffd8', rings: true }, phase++);
  },
  small() {},
};

// ---- Stage 10: Shadow Lord's Fortress

// A pink fire torch: a black square pillar with a dark rim, pink fire roaring on top, and its pink
// light spreading over the floor round it.
const pinkFire = {};
function pinkTorch(ctx, x, z) {
  const { v, scene, glow } = ctx;
  v.box(x, 0, z, 4.4, 1, 4.4, '#08060c');
  v.box(x, 1, z, 3.4, 8, 3.4, '#0e0b14');
  v.box(x, 9, z, 4.2, 0.8, 4.2, '#1a1424');
  glow.box(x, 6.5, z, 3.5, 0.3, 3.5, '#a82aff');
  ctx.circle(x, z, 2.4);
  lightPool(ctx, x, z, 15, '#ff3ad8');
  if (!scene || typeof document === 'undefined') return;
  if (!pinkFire.outer) {
    const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    pinkFire.outer = mat('#d81ac8', 0.85);
    pinkFire.mid = mat('#ff4ae8', 0.85);
    pinkFire.core = mat('#ffd0fa', 0.95);
    pinkFire.glow = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3ad8', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    pinkFire.ember = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff8af0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    pinkFire.cones = [[2.0, 6.5], [1.5, 5.5], [0.9, 3.8], [0.7, 3.4]].map(([r, h]) => new THREE.ConeGeometry(r, h, 7, 1, true).translate(0, h / 2, 0));
  }
  const fire = new THREE.Group();
  fire.position.set(x, 9.8, z);
  const tongues = [pinkFire.outer, pinkFire.mid, pinkFire.core].map((m, i) => {
    const c = new THREE.Mesh(pinkFire.cones[i], m);
    fire.add(c);
    return c;
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const c = new THREE.Mesh(pinkFire.cones[3], i % 2 ? pinkFire.mid : pinkFire.outer);
    c.position.set(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
    fire.add(c);
    tongues.push(c);
  }
  const halo = new THREE.Sprite(pinkFire.glow);
  halo.scale.setScalar(16);
  halo.position.y = 3;
  fire.add(halo);
  const embers = Array.from({ length: 5 }, (_, i) => {
    const s = new THREE.Sprite(pinkFire.ember);
    s.scale.setScalar(0.8);
    fire.add(s);
    return { s, t: i / 5, a: i * 2.1 };
  });
  scene.add(fire);
  const seed = x * 0.31 + z * 0.17;
  animateNear(z, (dt, t) => {
    tongues.forEach((m, i) => {
      const s = 1 + Math.sin(t * (7 + i * 1.4) + seed + i) * 0.18 + Math.sin(t * 15.3 + i) * 0.07;
      m.scale.set(1 - (s - 1) * 0.4, s, 1 - (s - 1) * 0.4);
      m.rotation.y = t * (0.8 + i * 0.3);
    });
    const fancy = FX.fancy;
    for (const e of embers) {
      e.s.visible = fancy;
      if (!fancy) continue;
      e.t = (e.t + dt * 0.6) % 1;
      e.a += dt * 1.7;
      e.s.position.set(Math.cos(e.a) * (0.8 + e.t * 1.6), 2 + e.t * 10, Math.sin(e.a) * (0.8 + e.t * 1.6));
    }
  });
}

// a purple X mark on the floor
function floorX(ctx, x, z, size, color = '#7a2aff') {
  const { v, glow } = ctx;
  v.box(x, 0, z, size * 1.1, 0.08, size * 1.1, '#0a0812');
  for (const ry of [Math.PI / 4, -Math.PI / 4]) glow.box(x, 0.08, z, size * 1.2, 0.06, size * 0.16, color, { ry });
}

// a purple frame with an X in it on a wall
function wallX(ctx, side, y, z, w, h) {
  const { glow } = ctx;
  const x = side * (WALL_X - 2.4), t = 0.6, c = '#7a2aff';
  glow.box(x, y, z - w / 2, 0.3, h, t, c);
  glow.box(x, y, z + w / 2, 0.3, h, t, c);
  glow.box(x, y, z, 0.3, t, w + t, c);
  glow.box(x, y + h - t, z, 0.3, t, w + t, c);
  const ang = Math.atan2(h, w), len = Math.hypot(w, h) - 1;
  for (const s of [-1, 1]) glow.box(x, y + h / 2 - len / 2, z, 0.3, len, t, c, { rx: s * (Math.PI / 2 - ang) });
}

// A lamp high on a fortress wall: a black bracket with a gold glass, and a spinning whirl of gold
// light falling from it onto the floor.
function fortressLamp(ctx, side, z) {
  const { v, lamps } = ctx;
  const wx = side * (WALL_X - 2), y = 30, x = wx - side * 8;
  v.box(wx - side * 4, y + 1.5, z, 8, 1, 1.4, '#0e0b14');
  v.box(wx - side * 1.5, y - 3, z, 1, 6, 1.4, '#0e0b14', { rz: side * 0.6 });
  v.box(x, y, z, 3.6, 2.2, 3.6, '#0e0b14');
  v.box(x, y + 2.2, z, 4.2, 0.6, 4.2, '#b04ae0');
  (lamps || ctx.glow).box(x, y - 0.8, z, 2.8, 0.8, 2.8, '#ffe2a0');
  lamps?.halo(x, y - 1, z, 14, '#ffd27a');
  lightWhirl(ctx, x, y - 0.8, z, 9, '#ffcf6a');
}

// the fortress's front at the end of the last stage: a red brick wall with purple battlements and a
// great dark gate rimmed in purple light
function fortressWall(ctx) {
  const { v, glow } = ctx;
  const z = WORLD.northZ + 3, W = H * 2 - 2, HGT = 34, BW = 6, BH = 3;
  v.box(0, 0, z, W, HGT, 4, '#5e2620');
  for (let row = 0; row * BH < HGT; row++) {
    const off = row % 2 ? BW / 2 : 0;
    for (let x = -W / 2 + off; x < W / 2 - 0.01; x += BW) {
      const w = Math.min(BW, W / 2 - x);
      if (w < 0.5) continue;
      v.box(x + w / 2, row * BH + 0.15, z + 2.05, w - 0.35, BH - 0.3, 0.3, (row + Math.round(x / BW)) % 3 ? '#8a3a2e' : '#743026');
    }
  }
  for (let x = -W / 2 + 2; x < W / 2; x += 8) v.box(x + 2, HGT, z, 4, 4, 5, '#4a2a6a');
  glow.box(0, HGT - 1.2, z + 2.3, W, 0.6, 0.3, '#b04ae0');
  // the gate
  v.box(0, 0, z + 2.25, 26, 22, 0.4, '#08060c');
  for (const s of [-1, 1]) glow.box(s * 13.4, 0, z + 2.4, 0.8, 23, 0.4, '#c84aff');
  glow.box(0, 22.2, z + 2.4, 27.6, 0.8, 0.4, '#c84aff');
  ctx.rect(-W / 2, W / 2, z - 2, z + 2.5);
}

const FORTRESS_DECOR = {
  smallCount: 0,
  noGrow: true,
  features(ctx) {
    const { biome, rnd, v, glow, nest } = ctx;
    for (const side of [-1, 1]) {
      const x = side * (WALL_X - 2.3), f = -side;
      // slanted neon-pink shards high up, in ones and twos
      for (let z = biome.maxZ - 8; z > biome.minZ + 6; z -= 9 + rnd() * 10) {
        const y = 40 + rnd() * 20, n = 1 + Math.floor(rnd() * 2);
        for (let k = 0; k < n; k++) glow.box(x, y, z - k * 3.4, 0.4, 7 + rnd() * 3, 1.6, '#ff2ad4', { rx: 0.35 * f });
      }
      // grey-lilac bars in threes lower down
      for (let z = biome.maxZ - 20; z > biome.minZ + 15; z -= 34 + rnd() * 16) {
        const y = 6 + rnd() * 10;
        for (let k = 0; k < 3; k++) v.box(x + f * 0.2, y, z - k * 2.6, 0.6, 8 - k * 0.8, 1.4, '#8a7aa6', { rx: 0.22 * f });
      }
      // purple X frames on the walls
      for (let z = biome.maxZ - 50; z > biome.minZ + 40; z -= 80) wallX(ctx, side, 22, z, 9, 15);
      // little pink spikes on the floor along the walls
      for (let z = biome.maxZ - 16; z > biome.minZ + 10; z -= 26 + rnd() * 12) {
        const px = side * (H - 4 - rnd() * 8);
        if (ctx.ok(px, z, 1)) glow.box(px, 0, z, 1.2, 2.6, 1.2, '#ff3ad8', { ry: Math.PI / 4 });
      }
    }
    // purple X marks down the lane and over the floor
    for (let z = biome.maxZ - 30; z > biome.minZ + 26; z -= 46) floorX(ctx, (rnd() - 0.5) * 4, z, 9);
    for (let i = 0; i < 8; i++) {
      const p = ctx.spot(6, false);
      if (p) floorX(ctx, p.x, p.z, 8 + rnd() * 4);
    }
    // pink fire torches along both sides of the lane
    for (const side of [-1, 1]) {
      for (let z = biome.maxZ - 22 - (side > 0 ? 0 : 24); z > biome.minZ + 20; z -= 48) {
        const x = side * (LANE + 5);
        if (Math.hypot(x - nest.x, z - nest.z) < NEST_CLEAR + 3) continue;
        pinkTorch(ctx, x, z);
      }
    }
    // lamps high on the walls, each pouring a whirl of gold light onto the floor
    for (const side of [-1, 1]) for (const z of [biome.maxZ - 60, ctx.mid - 30 * side, biome.minZ + 70]) fortressLamp(ctx, side, z);
  },
  landmarks(ctx) {
    const { biome } = ctx;
    let phase = 5.3;
    for (const s of [-1, 1]) endPillar(ctx, s * (H - 11), biome.minZ + 26, { body: '#0e0b14', band: '#7a2aff', cap: '#ff2ad4', glow: '#ff8af0', beam: '#ffd27a', rings: true }, phase++);
    if (ctx.index === BIOMES.length - 1) fortressWall(ctx);
  },
  small() {},
};

const DECOR = {
  ghost: GHOST_DECOR,
  fortress: FORTRESS_DECOR,
  ice: ICE_DECOR,
  water: WATER_DECOR,
  storm: STORM_DECOR,
  earth: EARTH_DECOR,
  energy: ENERGY_DECOR,
  // Red Ninja's Fire Temple: the walls are painted in two bands (dark navy below a gold line, red
  // stripes above with pixel flames rising out of the gold line), big gold emblems up on the red and
  // small ones along the dark band, red rugs with the emblem on the floor, and the two great fire
  // torches standing against the walls at the far end.
  fire: {
    smallCount: 0, // the floor stays clear, like the video
    noGrow: true,
    features(ctx) {
      const { v, biome, rnd } = ctx;
      const FACE = WALL_X - 2.1;      // just inside the wall's blocks (and the drips off its top)
      const BAND = 16;               // the dark band's height
      const mid = ctx.mid;
      for (const side of [-1, 1]) {
        const x = side * FACE, f = -side; // f: the way the wall faces (into the corridor)
        v.box(x, 0, mid, 0.4, BAND, BIOME_DEPTH, '#1c1e34');
        v.box(x + f * 0.1, BAND, mid, 0.5, 1.1, BIOME_DEPTH, '#ffcc33');
        v.box(x, BAND + 1.1, mid, 0.4, WALL_H - BAND - 4, BIOME_DEPTH, '#c8162a');
        for (let z = biome.maxZ - 3; z > biome.minZ; z -= 6) v.box(x + f * 0.05, BAND + 1.1, z, 0.4, WALL_H - BAND - 4, 2.4, '#a80f1f');
        v.box(x + f * 0.1, WALL_H - 3.6, mid, 0.5, 1, BIOME_DEPTH, '#ffd23a');
        // flames rising out of the gold line, in clusters
        for (let z = biome.maxZ - 10 - rnd() * 8; z > biome.minZ + 6; z -= 22 + rnd() * 10) {
          const n = 3 + Math.floor(rnd() * 3);
          for (let i = 0; i < n; i++) wallFlame(v, x + f * 0.3, BAND + 1.1, z + (i - n / 2) * 3.4, 3 + rnd() * 1.6, 10 + rnd() * 16, f);
        }
        // big emblems up on the red, small ones along the dark band
        for (let z = biome.maxZ - 34; z > biome.minZ + 20; z -= 64) emblem(v, x + f * 0.5, 47, z, 13, { facing: f });
        for (let z = biome.maxZ - 12; z > biome.minZ + 8; z -= 22) emblem(v, x + f * 0.5, 12, z, 6.5, { bg: '#a8141f', facing: f });
      }
      // red rugs with the emblem, down the path and here and there across the floor
      const rug = (rx, rz, w, d, ry) => {
        v.box(rx, 0.02, rz, w, 0.16, d, '#ffcc33', { ry });
        v.box(rx, 0.06, rz, w * 0.9, 0.16, d * 0.86, '#c8162a', { ry });
        emblem(v, rx, 0.22, rz, Math.min(w, d) * 0.7, { flat: true, bg: '#c8162a', border: '#c8162a' });
      };
      for (let z = biome.maxZ - 60; z > biome.minZ + 50; z -= 110) rug((rnd() - 0.5) * 8, z, 14, 10, 0);
      for (let i = 0; i < 5; i++) {
        const p = ctx.spot(7, false);
        if (p) rug(p.x, p.z, 12, 9, rnd() < 0.5 ? 0 : 0.3);
      }
    },
    landmarks(ctx) {
      // the two great torches at the far end, against the walls
      for (const s of [-1, 1]) fireTorch(ctx, s * (H - 11), ctx.biome.minZ + 20);
      // four big lamps high up on the walls, two each side, that light the temple at night
      for (const s of [-1, 1]) for (const z of [ctx.biome.maxZ - 95, ctx.biome.minZ + 120]) highLamp(ctx, s, z);
      // four searchlights on the floor by the walls, two each side, sweeping their beams over the sky
      let phase = 0;
      for (const s of [-1, 1]) for (const z of [ctx.biome.maxZ - 150, ctx.biome.minZ + 175]) searchlight(ctx, s, z, phase++ * 1.9);
    },
    small() {},
  },

  dojo: {
    smallCount: 18,
    // stations of training gear along both walls, in turn, and a row of punching bags down the middle
    features(ctx) {
      const { biome } = ctx;
      const kinds = ['bag', 'wingChun', 'dummy', 'bonsai', 'rack', 'wingChun', 'bag', 'dummy', 'barrels'];
      for (const side of [-1, 1]) {
        let k = side > 0 ? 3 : 0;
        for (let z = biome.maxZ - 26; z > biome.minZ + 18; z -= 30, k++) {
          const kind = kinds[k % kinds.length];
          const x = side * (kind === 'rack' ? H - 4 : kind === 'bonsai' || kind === 'barrels' ? H - 8 : H - 16);
          if (!ctx.ok(x, z, kind === 'dummy' ? 6 : 4)) continue;
          if (kind === 'bag') punchingBag(ctx, x, z);
          else if (kind === 'wingChun') wingChun(ctx, x, z);
          else if (kind === 'dummy') trainingDummy(ctx, x, z);
          else if (kind === 'bonsai') bonsai(ctx, x, z);
          else if (kind === 'rack') weaponRack(ctx, x, z, side);
          else { barrel(ctx, x, z - 2.6); barrel(ctx, x - side * 0.5, z + 2.6); }
        }
        for (let z = biome.maxZ - 60; z > biome.minZ + 30; z -= 75) {
          const x = side * 46;
          if (ctx.ok(x, z, 4)) punchingBag(ctx, x, z);
        }
      }
    },
    small(ctx, x, z) {
      const { v, rnd } = ctx;
      const k = rnd();
      if (k < 0.45) {
        // a cream floor mat
        const ry = rnd() < 0.5 ? 0 : Math.PI / 2;
        v.box(x, 0.02, z, 7, 0.16, 4.5, '#efe2bf', { ry });
        v.box(x, 0.01, z, 7.6, 0.14, 5.1, '#b8925a', { ry });
      } else if (k < 0.7) {
        // a low wooden bench
        const ry = rnd() * 3;
        v.box(x, 1.4, z, 6, 0.6, 1.8, '#8a5530', { ry });
        for (const s of [-1, 1]) v.box(x + Math.cos(ry) * s * 2.4, 0, z - Math.sin(ry) * s * 2.4, 0.6, 1.4, 1.6, '#5a2a14', { ry });
      } else if (k < 0.85) {
        // a rolled-up scroll and a cushion
        v.box(x, 0, z, 2.6, 0.7, 2.6, '#c8283a');
        v.box(x + 2, 0, z + 0.6, 2.4, 0.5, 0.5, '#f4ecd6', { ry: rnd() * 3 });
      } else {
        // a stack of wooden blocks (for breaking)
        for (let i = 0; i < 3; i++) v.box(x, i * 0.55, z, 2.4, 0.5, 1.2, i % 2 ? '#c8a060' : '#b08850', { ry: i * 0.2 });
      }
    },
  },

  garden: {
    smallCount: 34,
    noGrow: true, // drawn at the size it is meant to be
    features(ctx) {
      const { v, biome, rnd, pick } = ctx;
      const mid = ctx.mid;
      for (const side of [-1, 1]) {
        const face = side * (WALL_X - WALL_BLOCK_D / 2 - 0.2);
        // the wall's light upper half and the gold line between (like the video)
        v.box(face, WALL_H * 0.58 + 0.9, mid, 0.3, WALL_H * 0.42 - 3.2, BIOME_DEPTH, '#e2e5ea');
        v.box(face - side * 0.05, WALL_H * 0.58, mid, 0.5, 0.9, BIOME_DEPTH, GOLD);
        // moss: green brick shapes climbing the wall
        for (let z = biome.maxZ - 10 - rnd() * 20; z > biome.minZ + 10; z -= 26 + rnd() * 30) {
          const base = 4 + rnd() * 20;
          for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) {
            const w = 4 + rnd() * 9, h = 3 + rnd() * 7;
            v.box(face - side * 0.25, base + (rnd() - 0.3) * 14, z + (rnd() - 0.5) * 12, 0.5, h, w, pick(['#4cbf45', '#3fae3a', '#5ad450']));
          }
        }
        // bamboo along the walls
        for (let z = biome.maxZ - 24; z > biome.minZ + 20; z -= 34 + rnd() * 16) {
          const x = side * (H - 6 - rnd() * 3);
          if (ctx.ok(x, z, 3.5)) bamboo(ctx, x, z, 4 + Math.floor(rnd() * 3));
        }
      }
      // down the middle of the path: a line of square tiles, half yellow and half white, each half
      // with a little raised slab of the other colour on it (like the reference)
      for (let z = biome.maxZ - 22; z > biome.minZ + 16; z -= 34) {
        const W = 8, D = 10, Y = '#f2d24a', WH = '#eceee8';
        v.box(-W / 2, 0.02, z, W, 0.22, D, Y);
        v.box(W / 2, 0.02, z, W, 0.22, D, WH);
        v.box(-W / 2 - 1.2, 0.24, z - D / 2 + 1.6, 3.4, 0.3, 1.5, WH);
        v.box(W / 2 + 1.4, 0.24, z + D / 2 - 2.2, 3, 0.3, 1.5, Y);
      }
      // yellow training pads on the grass
      for (let i = 0; i < 6; i++) {
        const p = ctx.spot(5, false);
        if (!p || Math.abs(p.x) < LANE + 14) continue; // clear of the lantern rows
        const ry = rnd() < 0.5 ? 0 : Math.PI / 2;
        v.box(p.x, 0.02, p.z, 9, 0.16, 7, '#f2d24a', { ry });
        v.box(p.x, 0.01, p.z, 9.8, 0.14, 7.8, '#e8e4d8', { ry });
      }
    },
    landmarks(ctx) {
      const { rnd, nest } = ctx;
      // the stone lanterns stand in two rows along both sides of the path, all the way through
      // (a gap where the nest is)
      for (const s of [-1, 1]) {
        for (let z = ctx.biome.maxZ - 18; z > ctx.biome.minZ + 14; z -= 30) {
          const x = s * (LANE + 7);
          if (!ctx.ok(x, z, 2.5)) continue;
          stoneLantern(ctx, x, z, 1.2);
        }
      }
      // the big trees out towards the walls, clear of the lantern rows
      for (let i = 0; i < 7; i++) {
        const p = ctx.spot(9, true);
        if (p) blockTree(ctx, p.x, p.z, 0.9 + rnd() * 0.35);
      }
      // the little shrines: one across from the nest, one near the gate in
      for (const [x, z] of [[-nest.side * 60, ctx.mid - 40], [nest.side * 58, ctx.biome.maxZ - 40]]) {
        if (ctx.ok(x, z, 6)) shrine(ctx, x, z);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.45) {
        // a tuft of tall grass
        for (let i = 0; i < 4; i++) v.box(x + (rnd() - 0.5) * 2.4, 0, z + (rnd() - 0.5) * 2.4, 0.4, 1 + rnd() * 1.6, 0.4, pick(['#3fae3a', '#4cbf45', '#2f8f30']), { rz: (rnd() - 0.5) * 0.4 });
      } else if (k < 0.7) {
        // flowers
        for (let i = 0; i < 5; i++) {
          const fx = x + (rnd() - 0.5) * 3, fz = z + (rnd() - 0.5) * 3;
          v.box(fx, 0, fz, 0.25, 1.2, 0.25, '#2f8f30');
          v.box(fx, 1.2, fz, 0.8, 0.5, 0.8, pick(['#ff8ac8', '#ffffff', '#ffd84a', '#ff5a7a']));
        }
      } else if (k < 0.88) {
        // stepping stones
        for (let i = 0; i < 3; i++) v.box(x + i * 2.6, 0, z + (rnd() - 0.5) * 1.5, 2, 0.3, 1.7, pick(['#a8adb5', '#9aa0a8']), { ry: rnd() });
      } else {
        // a mossy rock
        v.box(x, 0, z, 2.6, 1.4, 2.2, '#8a8f98', { ry: rnd() * 3 });
        v.box(x, 1.2, z, 1.8, 0.4, 1.6, '#4cbf45', { ry: rnd() * 3 });
      }
    },
  },

  pumpkin: {
    smallCount: 26,
    features(ctx) {
      const { v, biome, rnd, pick } = ctx;
      // big crop rows along both walls: wide dark soil ridges with leafy tops and big pumpkins on them
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const x = side * (64 + k * 9.5);
          const segs = [[biome.minZ + 14, ctx.mid - 4], [ctx.mid + 4, biome.maxZ - 14]];
          for (const [a, b] of segs) {
            v.box(x, 0, (a + b) / 2, 6.4, 1.1, b - a, '#5a2e14');
            v.box(x, 1.1, (a + b) / 2, 4.6, 1, b - a - 1.5, '#2f6e1f');
            v.box(x, 2.1, (a + b) / 2, 2.4, 0.5, b - a - 3, '#3a8a2a');
            for (let z = a + 5 + rnd() * 6; z < b - 4; z += 9 + rnd() * 8) {
              pumpkin(v, x + (rnd() - 0.5) * 1.2, z, 3 + rnd() * 1.8, pick(['#ff7a1a', '#ff8a1a', '#f06a12']), 1.6);
            }
          }
        }
      }
    },
    landmarks(ctx) {
      const { v, nest, rnd } = ctx;
      // the giant pumpkin, across from the nest
      const gx = -nest.side * 45, gz = ctx.mid + 70; // in front of the crop rows
      v.box(gx, 0, gz, 13, 10, 13, '#ff7a1a');
      v.box(gx, 0.02, gz, 3, 10.1, 13.3, '#e8641a');
      v.box(gx, 0.02, gz, 13.3, 10.1, 3, '#e8641a');
      v.box(gx, 10, gz, 9, 1.4, 9, '#f07018');
      v.box(gx, 11.4, gz, 1.8, 4, 1.8, '#4a6a1e', { rz: 0.2 });
      v.box(gx + 2.5, 11.2, gz + 1, 5, 0.4, 3, '#3a8a2a', { ry: 0.5 });
      ctx.circle(gx, gz, 8.5);
      // a scarecrow on the nest side
      const sx = nest.side * 52, sz = ctx.mid - 70;
      v.box(sx, 0, sz, 0.7, 8, 0.7, '#7a4a24');
      v.box(sx, 5.6, sz, 7, 0.6, 0.6, '#7a4a24');
      v.box(sx, 4.2, sz, 3, 3.4, 1.6, '#4a7ad6');
      v.box(sx, 5.4, sz, 7.2, 1.2, 1.2, '#4a7ad6');
      v.box(sx, 7.6, sz, 2.2, 2.2, 2.2, '#ff8a1a');
      v.box(sx, 9.8, sz, 3.4, 0.3, 3.4, '#c8a44a');
      v.box(sx, 10.1, sz, 1.8, 1.4, 1.8, '#c8a44a');
      ctx.circle(sx, sz, 1.5);
      // hay bales
      for (let i = 0; i < more(5); i++) {
        const p = ctx.spot(2.5, false); // out in the field (the walls have the crop rows)
        if (!p) continue;
        const ry = rnd() * 3;
        v.box(p.x, 0, p.z, 4.2, 2.4, 2.6, '#e8c45a', { ry });
        v.box(p.x, 0.01, p.z, 0.5, 2.44, 2.64, '#b8943a', { ry });
        ctx.circle(p.x, p.z, 2.4);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.45) for (let i = 0; i < 4; i++) v.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 1, 0.15, 0.7, pick(['#f2682c', '#ffb02e', '#e8332f', '#c8411f']), { ry: rnd() * 3 });
      else if (k < 0.8) pumpkin(v, x, z, 2 + rnd() * 1.6);
      else v.box(x, 0, z, 3, 0.9, 1, '#6a3a1e', { ry: rnd() * 3 });
    },
  },

  candy: {
    smallCount: 34,
    landmarks(ctx) {
      const { v, rnd, pick } = ctx;
      // giant candy canes
      for (let i = 0; i < more(4); i++) {
        const p = ctx.spot(2, true);
        if (!p) continue;
        const h = 14 + rnd() * 6, seg = h / 8;
        for (let k = 0; k < 8; k++) v.box(p.x, k * seg, p.z, 1.6, seg, 1.6, k % 2 ? '#ffffff' : '#ff2a3c');
        const hx = -p.side * 1.6;
        v.box(p.x + hx, h - 0.3, p.z, 4.8, 1.6, 1.6, '#ff2a3c');
        v.box(p.x + hx * 2, h - 2.8, p.z, 1.6, 2.6, 1.6, '#ffffff');
        ctx.circle(p.x, p.z, 1.3);
      }
      // giant lollipops
      for (let i = 0; i < more(4); i++) {
        const p = ctx.spot(4, true);
        if (!p) continue;
        const h = 11 + rnd() * 5, c = pick(['#ff5fa8', '#5fd0ff', '#ffe14a', '#c86aff']);
        const ry = Math.PI / 2 + (rnd() - 0.5) * 0.8;
        v.box(p.x, 0, p.z, 0.8, h, 0.8, '#ffffff');
        v.box(p.x, h - 1, p.z, 9, 9, 1.4, c, { ry });
        v.box(p.x, h + 1.2, p.z, 5.6, 4.6, 1.6, '#ffffff', { ry });
        v.box(p.x, h + 2.4, p.z, 2.8, 2.2, 1.8, c, { ry });
        ctx.circle(p.x, p.z, 1);
      }
      // a frosting-topped cake block
      const p = ctx.spot(5, true);
      if (p) {
        v.box(p.x, 0, p.z, 9, 5, 9, '#c8844a');
        v.box(p.x, 5, p.z, 9.4, 1.4, 9.4, '#fff2f8');
        for (let k = 0; k < 6; k++) v.box(p.x + (rnd() - 0.5) * 7, 4, p.z + (rnd() - 0.5) * 7, 1.2, 1.6, 1.2, '#fff2f8');
        v.box(p.x, 6.4, p.z, 1.6, 1.6, 1.6, '#ff2a3c');
        ctx.circle(p.x, p.z, 6.5);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.35) {
        for (let i = 0; i < 2; i++) {
          const c = pick(['#ff5fa8', '#5fd0ff', '#ffe14a', '#7dff3f', '#c86aff']);
          const dx = (rnd() - 0.5) * 2.6, dz = (rnd() - 0.5) * 2.6;
          v.box(x + dx, 0, z + dz, 1.8, 1.1, 1.8, c); v.box(x + dx, 1.1, z + dz, 1.1, 0.7, 1.1, c);
        }
      } else if (k < 0.6) {
        const c = pick(['#ff5fa8', '#5fd0ff', '#ffe14a']);
        v.box(x, 0, z, 0.3, 3, 0.3, '#ffffff'); v.box(x, 3, z, 2.2, 2.2, 0.5, c); v.box(x, 3.5, z + 0.05, 1.2, 1.2, 0.5, '#ffffff');
      } else if (k < 0.8) {
        for (let i = 0; i < 4; i++) v.box(x, i * 1, z, 0.7, 1, 0.7, i % 2 ? '#ffffff' : '#ff2a3c');
        v.box(x + 0.6, 4, z, 1.6, 0.7, 0.7, '#ff2a3c');
      } else {
        for (let i = 0; i < 6; i++) v.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 0.8, 0.2, 0.25, pick(['#ff5fa8', '#5fd0ff', '#ffe14a', '#7dff3f', '#ffffff']), { ry: rnd() * 3 });
      }
    },
  },

  haunted: {
    smallCount: 34,
    landmarks(ctx) {
      for (let i = 0; i < more(7); i++) {
        const p = ctx.spot(2.5, true);
        if (!p) continue;
        deadTree(ctx, p.x, p.z, 14 + ctx.rnd() * 8, ctx.pick(['#2e221a', '#3a2a1e', '#261c16']));
        ctx.circle(p.x, p.z, 1.8);
      }
      for (let i = 0; i < more(5); i++) {
        const p = ctx.spot(1, true);
        if (p) { lantern(ctx, p.x, p.z, '#9effc8'); ctx.circle(p.x, p.z, 0.6); }
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.35) for (let i = 0; i < 3; i++) mushroom(v, x + (rnd() - 0.5) * 2.6, z + (rnd() - 0.5) * 2.6, 0.7 + rnd() * 0.8, pick(['#5affd0', '#a86aff', '#7fd8ff']), glow);
      else if (k < 0.55) deadTree(ctx, x, z, 5 + rnd() * 3, '#3a2a1e');
      else if (k < 0.8) { v.box(x, 0, z, 3 + rnd() * 2, 1.4, 2.6, pick(['#3a2a4a', '#2e3a26']), { ry: rnd() * 3 }); v.box(x, 1, z, 2, 0.9, 1.8, pick(['#4a3a5c', '#3a4a30']), { ry: rnd() * 3 }); }
      else for (let i = 0; i < 3; i++) v.box(x + (rnd() - 0.5) * 2, 0, z + (rnd() - 0.5) * 2, 2.4, 0.4, 0.5, '#2a1e14', { ry: rnd() * 3 });
    },
  },

  graveyard: {
    smallCount: 44,
    features(ctx) {
      const { v, biome } = ctx;
      // wrought iron fences along both sides
      for (const side of [-1, 1]) {
        const x = side * 66;
        for (const [a, b] of [[biome.minZ + 20, biome.minZ + 100], [biome.maxZ - 100, biome.maxZ - 20]]) {
          v.box(x, 0.6, (a + b) / 2, 0.25, 0.25, b - a, '#1e1e24');
          v.box(x, 2.2, (a + b) / 2, 0.25, 0.25, b - a, '#1e1e24');
          for (let z = a; z <= b; z += 5) v.box(x, 0, z, 0.3, 2.9, 0.3, '#1e1e24');
        }
      }
    },
    landmarks(ctx) {
      const { v, nest, rnd } = ctx;
      // a mausoleum against the wall across from the nest
      const mx = -nest.side * 79, mz = ctx.mid + 40;
      v.box(mx, 0, mz, 14, 1, 14, '#5c5c66');
      v.box(mx, 1, mz, 12, 9, 12, '#8a8a94');
      v.box(mx, 10, mz, 14, 1.2, 14, '#74747e');
      v.box(mx, 11.2, mz, 10, 2, 10, '#74747e');
      v.box(mx, 13.2, mz, 1, 3.5, 1, '#5c5c66');
      v.box(mx, 15, mz, 3, 1, 1, '#5c5c66');
      v.box(mx + nest.side * 6.05, 1, mz, 0.3, 6, 4, '#2a2a30');
      for (const dz of [-4.5, 4.5]) v.box(mx + nest.side * 6.6, 1, mz + dz, 1.4, 9, 1.4, '#a0a0a8');
      ctx.rect(mx - 7, mx + 7, mz - 7, mz + 7);
      for (let i = 0; i < more(3); i++) {
        const p = ctx.spot(2, true);
        if (!p) continue;
        deadTree(ctx, p.x, p.z, 12 + rnd() * 6, '#2e2a26');
        ctx.circle(p.x, p.z, 1.5);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      const ry = (rnd() - 0.5) * 0.4;
      if (k < 0.5) {
        const c = pick(['#9a9aa2', '#8a8a94', '#a8a8b0']);
        const h = 2.4 + rnd() * 1.4;
        v.box(x, 0, z, 3, 0.4, 1.6, '#5c5c66', { ry });
        v.box(x, 0.4, z, 2.4, h, 0.7, c, { ry, rz: (rnd() - 0.5) * 0.15 });
        v.box(x, 0.4 + h, z, 1.6, 0.5, 0.7, c, { ry });
      } else if (k < 0.75) {
        v.box(x, 0, z, 0.6, 3.6, 0.6, '#8a8a94', { ry, rz: (rnd() - 0.5) * 0.2 });
        v.box(x, 2.4, z, 2.2, 0.6, 0.6, '#8a8a94', { ry });
      } else if (k < 0.9) {
        v.box(x, 0, z, 3.6, 0.3, 6, '#2a2018', { ry });
        v.box(x + 2.6, 0, z, 1.6, 0.9, 5, '#5a4a3a', { ry });
      } else {
        v.box(x, 0, z, 1.2, 1, 1.2, '#efe9da', { ry: rnd() * 3 });
        v.box(x + 1, 0, z + 0.6, 2, 0.3, 0.4, '#efe9da', { ry: rnd() * 3 });
      }
    },
  },

  carnival: {
    smallCount: 30,
    landmarks(ctx) {
      const { v, glow, nest, rnd } = ctx;
      // two striped big-top tents, one on each side
      const tents = [[-nest.side * 72, ctx.mid + 50], [nest.side * 72, ctx.mid - 80]];
      for (const [tx, tz] of tents) {
        const w = 15;
        for (let k = 0; k < 5; k++) v.box(tx, 0, tz - w / 2 + (k + 0.5) * (w / 5), w, 8, w / 5, k % 2 ? '#f4f0ea' : '#d6283a');
        v.box(tx, 8, tz, w + 1, 1, w + 1, '#ffd21f');
        v.box(tx, 9, tz, w - 2, 3, w - 2, '#d6283a');
        v.box(tx, 12, tz, w - 6, 3, w - 6, '#f4f0ea');
        v.box(tx, 15, tz, w - 10, 2.4, w - 10, '#d6283a');
        v.box(tx, 17.4, tz, 0.4, 4, 0.4, '#3a3a3a');
        v.box(tx + 1.2, 19.6, tz, 2.4, 1.4, 0.2, '#ffd21f');
        v.box(tx - Math.sign(tx) * (w / 2 + 0.05), 0, tz, 0.2, 5, 4, '#2a1a14');
        ctx.rect(tx - w / 2 - 0.5, tx + w / 2 + 0.5, tz - w / 2 - 0.5, tz + w / 2 + 0.5);
      }
      // a ticket booth
      const p = ctx.spot(3.5, true);
      if (p) {
        v.box(p.x, 0, p.z, 5, 6, 5, '#2a62d6');
        glow.box(p.x - p.side * 2.55, 2.6, p.z, 0.2, 2, 3, '#ffe9a0');
        v.box(p.x, 6, p.z, 6.4, 1, 6.4, '#d6283a');
        v.box(p.x, 7, p.z, 4, 1.4, 4, '#f4f0ea');
        v.box(p.x - p.side * 2.6, 7.4, p.z, 0.3, 1.6, 5, '#ffd21f');
        ctx.circle(p.x, p.z, 3.6);
      }
      // striped poles with light bulbs
      for (let i = 0; i < 5; i++) {
        const q = ctx.spot(1, true);
        if (!q) continue;
        for (let k = 0; k < 4; k++) v.box(q.x, k * 2.5, q.z, 0.8, 2.5, 0.8, k % 2 ? '#f4f0ea' : '#d6283a');
        glow.box(q.x, 10, q.z, 1.6, 1.6, 1.6, rnd() < 0.5 ? '#ffe14a' : '#ff6a6a');
        ctx.circle(q.x, q.z, 0.6);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.4) {
        for (let i = 0; i < 3; i++) {
          const h = 4 + rnd() * 3, dx = (rnd() - 0.5) * 1.6, dz = (rnd() - 0.5) * 1.6;
          v.box(x + dx * 0.3, 0, z + dz * 0.3, 0.08, h, 0.08, '#e8e8e8');
          v.box(x + dx, h, z + dz, 1.3, 1.6, 1.3, pick(['#ff3a3a', '#ffe14a', '#3ad1ff', '#7dff3f', '#ff6ae0']));
        }
      } else if (k < 0.65) {
        v.box(x, 0, z, 1.8, 2.4, 1.8, '#d6283a', { ry: rnd() });
        v.box(x, 0.02, z, 0.5, 2.44, 1.84, '#f4f0ea', { ry: rnd() });
      } else if (k < 0.85) {
        v.box(x, 0, z, 2.4, 2, 1.6, '#d6283a');
        v.box(x, 2, z, 2, 1.6, 1.2, '#fff6d0');
        glow.box(x, 3.6, z, 1.6, 0.5, 1, '#ffe14a');
      } else {
        for (let i = 0; i < 6; i++) v.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 0.6, 0.1, 0.6, pick(['#ff3a3a', '#ffe14a', '#3ad1ff', '#ff6ae0']), { ry: rnd() * 3 });
      }
    },
  },

  bog: {
    smallCount: 36,
    features(ctx) {
      const { glow, v } = ctx;
      const RB = ['#ff3a3a', '#ff8c1a', '#ffe11a', '#4cd137', '#19d3ff', '#2f6bff', '#b33dff'];
      // rainbow puddles: rings stacked from red outside to violet in the middle
      for (let i = 0; i < more(8); i++) {
        const p = ctx.spot(5, i < 5);
        if (!p) continue;
        const ry = ctx.rnd() * 3;
        v.box(p.x, 0, p.z, 10.4, 0.05, 7.4, '#2a3a24', { ry });
        for (let k = 0; k < 5; k++) glow.box(p.x, 0.02 + k * 0.012, p.z, 10 - k * 1.8, 0.06, 7 - k * 1.25, RB[k + (i % 3)], { ry });
      }
    },
    landmarks(ctx) {
      const { v, rnd, pick } = ctx;
      // drooping swamp willows
      for (let i = 0; i < more(5); i++) {
        const p = ctx.spot(3, true);
        if (!p) continue;
        const h = 12 + rnd() * 5;
        v.box(p.x, 0, p.z, 2.2, h, 2.2, '#4a3a22', { rz: (rnd() - 0.5) * 0.15 });
        v.box(p.x, h - 1, p.z, 10, 3, 10, '#3d6a3a', { ry: rnd() });
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + rnd();
          v.box(p.x + Math.cos(a) * 4, h - 6, p.z + Math.sin(a) * 4, 1.6, 5.5, 1.6, pick(['#5a8a3a', '#4a7a32']));
        }
        ctx.circle(p.x, p.z, 1.8);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.4) {
        for (let i = 0; i < 4; i++) {
          const h = 2.5 + rnd() * 2.5, dx = (rnd() - 0.5) * 2, dz = (rnd() - 0.5) * 2;
          v.box(x + dx, 0, z + dz, 0.3, h, 0.3, pick(['#6aa83a', '#8ac04a']), { rz: (rnd() - 0.5) * 0.3 });
          if (i < 2) v.box(x + dx, h - 0.3, z + dz, 0.55, 1.2, 0.55, '#6a4224');
        }
      } else if (k < 0.7) {
        v.box(x, 0, z, 5, 0.04, 4, '#2a4a3a', { ry: rnd() * 3 });
        for (let i = 0; i < 3; i++) v.box(x + (rnd() - 0.5) * 3, 0.05, z + (rnd() - 0.5) * 2.4, 1.4, 0.12, 1.4, '#4cbf3a', { ry: rnd() * 3 });
        if (rnd() < 0.4) glow.box(x, 0.17, z, 0.5, 0.4, 0.5, '#ff8fd8');
      } else if (k < 0.85) {
        v.box(x, 0, z, 4, 1, 1.2, '#4a3a22', { ry: rnd() * 3 });
      } else {
        v.box(x, 0, z, 1.2, 0.8, 1.2, '#5aaa3a');
        v.box(x, 0.8, z + 0.3, 0.4, 0.4, 0.2, '#ffffff');
      }
    },
  },

  frost: {
    smallCount: 38,
    features(ctx) {
      const { v } = ctx;
      for (let i = 0; i < more(3); i++) {
        const p = ctx.spot(6, false);
        if (!p) continue;
        const ry = ctx.rnd() * 3;
        v.box(p.x, 0, p.z, 12, 0.08, 9, '#a8dcff', { ry });
        v.box(p.x, 0, p.z, 8, 0.1, 6, '#c8ecff', { ry });
      }
    },
    landmarks(ctx) {
      for (let i = 0; i < more(6); i++) {
        const p = ctx.spot(3.5, true);
        if (!p) continue;
        spikeCluster(ctx.v, ctx, p.x, p.z, 14 + ctx.rnd() * 8, 3, ['#9be8ff', '#bfe9ff', '#7fd8ff', '#e8f8ff'], 4);
        ctx.circle(p.x, p.z, 3);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.45) { const s = 1.6 + rnd() * 2; v.box(x, 0, z, s * 1.6, s * 0.6, s, '#ffffff', { ry: rnd() * 3 }); v.box(x, s * 0.6, z, s, s * 0.35, s * 0.7, '#f2f8ff', { ry: rnd() * 3 }); }
      else if (k < 0.8) spikeCluster(v, ctx, x, z, 2 + rnd() * 3, 0.8, ['#9be8ff', '#bfe9ff', '#7fd8ff'], 3);
      else { v.box(x, 0, z, 2.4, 2.2, 2.4, '#ffffff'); v.box(x, 2.2, z, 1.7, 1.6, 1.7, '#ffffff'); v.box(x, 3.8, z, 1.2, 1.2, 1.2, '#ffffff'); v.box(x, 4.2, z + 0.7, 0.3, 0.3, 0.6, '#ff8a1a'); v.box(x, 5, z, 1.3, 0.3, 1.3, '#2a2a30'); }
    },
  },

  manor: {
    smallCount: 30,
    features(ctx) {
      const { v, biome } = ctx;
      // a long purple carpet down the middle, gold edged (flat, walk on it)
      const a = biome.minZ + 14, b = biome.maxZ - 14;
      v.box(0, 0, (a + b) / 2, 11, 0.08, b - a, '#c8a24a');
      v.box(0, 0, (a + b) / 2, 9.6, 0.1, b - a - 1, '#7a2fb0');
      // and short side runners
      for (const side of [-1, 1]) v.box(side * 80, 0, (a + b) / 2, 5, 0.08, b - a - 40, '#5a2290');
    },
    landmarks(ctx) {
      const { v, glow, rnd } = ctx;
      // broken pillars
      for (let i = 0; i < more(8); i++) {
        const p = ctx.spot(2.5, true);
        if (!p) continue;
        const h = 6 + rnd() * 12;
        v.box(p.x, 0, p.z, 4.4, 1.2, 4.4, '#8a8496');
        v.box(p.x, 1.2, p.z, 3, h, 3, '#a49eb0');
        v.box(p.x, 1.2 + h - 0.4, p.z, 3.2, 1.4, 2.6, '#8a8496', { rx: 0.3, rz: 0.25 });
        if (rnd() < 0.5) v.box(p.x + 3, 0, p.z + 1, 3, 2.6, 2.6, '#a49eb0', { ry: rnd() * 3, rz: 1.4 });
        ctx.circle(p.x, p.z, 2.4);
      }
      // candelabras
      for (let i = 0; i < more(6); i++) {
        const p = ctx.spot(1.5, rnd() < 0.6);
        if (!p) continue;
        v.box(p.x, 0, p.z, 1.6, 0.5, 1.6, '#c8a24a');
        v.box(p.x, 0.5, p.z, 0.4, 5, 0.4, '#c8a24a');
        v.box(p.x, 5.2, p.z, 3.6, 0.3, 0.4, '#c8a24a');
        for (const dx of [-1.6, 0, 1.6]) {
          v.box(p.x + dx, 5.5, p.z, 0.45, 1.1, 0.45, '#f4ecd8');
          glow.box(p.x + dx, 6.6, p.z, 0.35, 0.7, 0.35, '#ffc24a');
        }
        ctx.circle(p.x, p.z, 0.9);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.4) for (let i = 0; i < 3; i++) v.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 1 + rnd() * 1.4, 0.5 + rnd() * 0.8, 1 + rnd(), pick(['#8a8496', '#a49eb0']), { ry: rnd() * 3 });
      else if (k < 0.7) for (let i = 0; i < 3; i++) { const dx = (rnd() - 0.5) * 1.6, h = 0.6 + rnd() * 1.2; v.box(x + dx, 0, z + i * 0.5, 0.4, h, 0.4, '#f4ecd8'); glow.box(x + dx, h, z + i * 0.5, 0.25, 0.45, 0.25, '#ffc24a'); }
      else if (k < 0.85) { v.box(x, 0, z, 2.4, 1.2, 2.2, '#5a2290'); v.box(x, 1.2, z - 0.9, 2.4, 2, 0.5, '#5a2290'); }
      else { v.box(x, 0, z, 1.6, 0.4, 1.2, '#6a2a2a', { ry: rnd() * 3 }); v.box(x, 0.4, z, 1.4, 0.3, 1, '#2a4a6a', { ry: rnd() * 3 }); }
    },
  },

  inferno: {
    smallCount: 32,
    features(ctx) {
      const { glow, v, biome, rnd, nest } = ctx;
      // two lava rivers winding across the pit (flat, walkable)
      for (let r = 0; r < 2; r++) {
        const z0 = biome.minZ + BIOME_DEPTH * (r ? 0.78 : 0.22);
        const wobble = 6 + rnd() * 8, phase = rnd() * 6;
        for (let x = -H + 3; x < H - 2; x += 6) {
          const z = z0 + Math.sin(x * 0.035 + phase) * wobble;
          if (Math.hypot(x - nest.x, z - nest.z) < NEST_RADIUS + 3) continue;
          glow.box(x, 0, z, 6.2, 0.1, 7, '#ff5a1a');
          glow.box(x, 0.01, z, 6.2, 0.12, 3.6, '#ffc21f');
        }
      }
      // lava pools near the walls
      for (let i = 0; i < more(6); i++) {
        const p = ctx.spot(4, true);
        if (!p) continue;
        const ry = rnd() * 3;
        v.box(p.x, 0, p.z, 9, 0.5, 7, '#1c1a24', { ry });
        glow.box(p.x, 0.02, p.z, 7.6, 0.52, 5.6, '#ff5a1a', { ry });
        glow.box(p.x, 0.03, p.z, 4.4, 0.54, 3, '#ffd84a', { ry });
      }
    },
    landmarks(ctx) {
      for (let i = 0; i < more(6); i++) {
        const p = ctx.spot(3, true);
        if (!p) continue;
        spikeCluster(ctx.v, ctx, p.x, p.z, 12 + ctx.rnd() * 9, 2.6, ['#1c1a24', '#26222e', '#2e2834'], 4);
        ctx.glow.box(p.x, 0, p.z, 3.4, 0.6, 3.4, '#ff6a1a', { ry: ctx.rnd() * 3 });
        ctx.circle(p.x, p.z, 2.6);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.35) v.box(x, 0, z, 2 + rnd() * 2, 1 + rnd() * 1.4, 1.6 + rnd() * 1.6, pick(['#2e2e34', '#3a3a42', '#26262c']), { ry: rnd() * 3 });
      else if (k < 0.6) spikeCluster(v, ctx, x, z, 2 + rnd() * 3, 0.7, ['#1c1a24', '#2a2030'], 3);
      else if (k < 0.85) for (let i = 0; i < 3; i++) glow.box(x + (rnd() - 0.5) * 2, 0, z + (rnd() - 0.5) * 2, 0.5, 0.5 + rnd() * 0.6, 0.5, pick(['#ff6a1a', '#ffb21f']), { ry: rnd() * 3 });
      else { v.box(x, 0, z, 1.3, 1.1, 1.3, '#e8e0d0', { ry: rnd() * 3 }); v.box(x, 0, z + 0.7, 0.8, 0.4, 0.4, '#e8e0d0'); }
    },
  },

  // the final stage: a sandy bone temple. Giant rib arches span the corridor, bone pillars and
  // skull heaps line the walls, and a colossal skull stands at the end (see StageSkies.js).
  nightmare: {
    smallCount: 34,
    features(ctx) {
      const { v, biome } = ctx;
      // rib arches: two curved bones meeting over the lane, every ~45 units
      for (let z = biome.maxZ - 30; z > biome.minZ + 30; z -= 46) {
        for (const s of [-1, 1]) {
          // a quarter ellipse from the wall foot up to the top of the lane: short bone segments,
          // each centred on the curve and turned along it (boxes turn round their middle)
          const RX = H - 4, RY = 54, n = 12;
          for (let k = 0; k < n; k++) {
            const a0 = (k / n) * Math.PI / 2, a1 = ((k + 1) / n) * Math.PI / 2;
            const x0 = s * RX * Math.cos(a0), y0 = RY * Math.sin(a0), x1 = s * RX * Math.cos(a1), y1 = RY * Math.sin(a1);
            const len = Math.hypot(x1 - x0, y1 - y0) + 0.8;
            const cx = (x0 + x1) / 2, cy = 3 + (y0 + y1) / 2;
            v.box(cx, cy - len / 2, z, 3.2, len, 3, k % 3 === 1 ? '#e2d6b8' : '#efe4c8', { rz: Math.atan2(-(x1 - x0), y1 - y0) });
          }
          v.box(s * (H - 4), 0, z, 6, 5, 6, '#d8ccac');
        }
      }
    },
    landmarks(ctx) {
      const { v, glow, rnd } = ctx;
      // bone pillars with a skull on top
      for (let i = 0; i < more(8); i++) {
        const p = ctx.spot(3.5, true);
        if (!p) continue;
        const h = 14 + rnd() * 10;
        for (let y = 0; y < h; y += 2.2) v.box(p.x, y, p.z, y % 4.4 < 2.2 ? 3.4 : 2.6, 2.2, y % 4.4 < 2.2 ? 3.4 : 2.6, y % 4.4 < 2.2 ? '#e8dcc0' : '#d4c6a4');
        v.box(p.x, h, p.z, 4.4, 4, 4.4, '#f2e8d0');
        const f = -Math.sign(p.x);
        for (const dz of [-1, 1]) {
          v.box(p.x + f * 2.21, h + 1.8, p.z + dz, 0.2, 1.2, 1.1, '#1a120a');
          glow.box(p.x + f * 2.3, h + 2.1, p.z + dz, 0.1, 0.5, 0.5, '#ff4a1a');
        }
        ctx.circle(p.x, p.z, 2.4);
      }
      // giant teeth bursting out of the ground near the walls
      for (let i = 0; i < more(2); i++) {
        const p = ctx.spot(9, true);
        if (!p) continue;
        for (let k = -2; k <= 2; k++) {
          const h = 6 + (2 - Math.abs(k)) * 2.5 + rnd() * 2;
          v.box(p.x, 0, p.z + k * 3.4, 2.6, h, 2.6, '#f2ead8', { rx: k * 0.12 });
          v.box(p.x, h - 0.5, p.z + k * 3.4 + k * 0.12 * h, 1.4, 1.6, 1.4, '#fffaf0', { rx: k * 0.12 });
          ctx.circle(p.x, p.z + k * 3.4, 1.6);
        }
        v.box(p.x, 0, p.z, 4, 0.6, 18, '#6a3a2a');
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.35) { // a skull
        v.box(x, 0, z, 1.8, 1.6, 1.8, '#f2e8d0', { ry: rnd() * 0.6 });
        v.box(x, 0.6, z + 0.91, 1.2, 0.5, 0.1, '#1a120a');
        if (rnd() < 0.4) glow.box(x, 0.7, z + 0.95, 0.9, 0.25, 0.06, '#ff4a1a');
      } else if (k < 0.65) for (let i = 0; i < 3; i++) v.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 0.5, 0.5, 2.6 + rnd() * 2, '#e8dcc0', { ry: rnd() * 3 });
      else if (k < 0.85) v.box(x, 0, z, 3 + rnd() * 2, 0.3, 2.4, pick(['#a68a62', '#9a7e58']), { ry: rnd() * 3 });
      else { v.box(x, 0, z, 0.6, 4, 0.6, '#3a2614'); glow.box(x, 4, z, 0.9, 1.4, 0.9, '#ff8a1a'); }
    },
  },

  // yellow wallpaper, wet brown carpet, a low ceiling of buzzing lights and endless empty doorways
  backrooms: {
    smallCount: 12,
    features(ctx) {
      const { v, glow, biome } = ctx;
      const CEIL = 58;
      // the ceiling: tiles with rows of fluorescent panels (unlit, so it never casts a shadow over the floor)
      glow.box(0, CEIL, ctx.mid, H * 2, 1, BIOME_DEPTH, '#c9b98a');
      for (let z = biome.minZ + 12; z < biome.maxZ - 6; z += 22) {
        for (let x = -72; x <= 72; x += 24) glow.box(x, CEIL - 0.25, z, 9, 0.3, 3.4, '#fffbe6');
      }
      // wallpaper stripes on the walls' inner faces
      for (const side of [-1, 1]) {
        for (let z = biome.minZ + 3; z < biome.maxZ - 2; z += 6) v.box(side * (H - 0.4), 0, z, 0.3, CEIL, 1.2, '#c9b05a');
        v.box(side * (H - 0.5), 0, ctx.mid, 0.4, 3, BIOME_DEPTH, '#8a6a2a'); // the skirting board
      }
    },
    landmarks(ctx) {
      const { v } = ctx;
      // wooden pillars with a black base, like in the halls
      for (let i = 0; i < more(10); i++) {
        const p = ctx.spot(2.6, ctx.rnd() < 0.5);
        if (!p) continue;
        v.box(p.x, 0, p.z, 4.4, 6, 4.4, '#141414');
        v.box(p.x, 6, p.z, 3.6, 52, 3.6, '#a8642e');
        v.box(p.x, 54, p.z, 4.6, 4, 4.6, '#8a4e22');
        ctx.circle(p.x, p.z, 2.4);
      }
      // half walls with empty doorways
      for (let i = 0; i < more(3); i++) {
        const p = ctx.spot(8, true);
        if (!p) continue;
        v.box(p.x, 0, p.z - 6, 3, 22, 6, '#d8c06a');
        v.box(p.x, 0, p.z + 6, 3, 22, 6, '#d8c06a');
        v.box(p.x, 16, p.z, 3, 6, 6, '#d8c06a');
        ctx.rect(p.x - 1.6, p.x + 1.6, p.z - 9, p.z - 3);
        ctx.rect(p.x - 1.6, p.x + 1.6, p.z + 3, p.z + 9);
      }
    },
    small(ctx, x, z) {
      const { v, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.5) v.box(x, 0, z, 3 + rnd() * 3, 0.06, 2 + rnd() * 3, pick(['#6a4e1e', '#74561f']), { ry: rnd() * 3 }); // a damp stain
      else if (k < 0.8) { v.box(x, 0, z, 1.6, 1.2, 1.6, '#c8b070'); v.box(x, 1.2, z, 1.4, 0.2, 1.4, '#a89050'); } // a cardboard box
      else v.box(x, 0, z, 0.8, 2.2, 0.8, '#6a6a70'); // a chair leg / pipe
    },
  },

  glitch: {
    smallCount: 30,
    features(ctx) {
      const { v, glow, rnd, pick } = ctx;
      // checker "error" tiles flat on the ground
      for (let i = 0; i < more(8); i++) {
        const p = ctx.spot(5, i < 4);
        if (!p) continue;
        v.box(p.x, 0, p.z, 8, 0.1, 8, '#0a0a0e');
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
          if ((a + b) % 2) glow.box(p.x - 3 + a * 2, 0.02, p.z - 3 + b * 2, 2, 0.1, 2, '#ff2ad4');
        }
      }
      // floating misaligned neon blocks
      for (let i = 0; i < more(44); i++) {
        const p = ctx.spot(2, rnd() < 0.6);
        if (!p) continue;
        const s = 1 + rnd() * 3;
        glow.box(p.x, 4 + rnd() * 18, p.z, s, s, s, pick(['#25e890', '#ff2ad4', '#2ad4ff', '#ffe92a']), { rx: rnd(), ry: rnd(), rz: rnd() });
      }
    },
    landmarks(ctx) {
      const { v, glow, rnd, pick } = ctx;
      // towers of offset black and neon cubes
      for (let i = 0; i < more(5); i++) {
        const p = ctx.spot(4, true);
        if (!p) continue;
        let y = 0;
        for (let k = 0; k < 5; k++) {
          const s = 5 - k * 0.6;
          const target = k % 2 ? glow : v;
          target.box(p.x + (rnd() - 0.5) * 1.6, y, p.z + (rnd() - 0.5) * 1.6, s, s * 0.8, s, k % 2 ? pick(['#25e890', '#ff2ad4', '#2ad4ff']) : '#16161f', { ry: rnd() * 0.3 });
          y += s * 0.8;
        }
        ctx.circle(p.x, p.z, 3.4);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.4) {
        // a "missing texture" cube
        v.box(x, 0, z, 2, 2, 2, '#16161f');
        glow.box(x - 0.5, 1, z - 0.5, 1.02, 1.02, 1.02, '#ff2ad4');
        glow.box(x + 0.5, 0, z + 0.5, 1.02, 1.02, 1.02, '#ff2ad4');
      } else if (k < 0.75) for (let i = 0; i < 3; i++) glow.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 0.6 + rnd(), 0.6 + rnd() * 2, 0.6 + rnd(), pick(['#25e890', '#2ad4ff', '#ff2ad4']), { ry: rnd() });
      else v.box(x, 0, z, 3, 0.4, 3, pick(['#2ad4ff', '#25e890']), { ry: rnd() * 3, rz: 0.15 });
    },
  },

  void: {
    smallCount: 24,
    features(ctx) {
      const { glow, biome, rnd, pick, nest } = ctx;
      // star specks all over the black ground (flat)
      for (let i = 0; i < more(150); i++) {
        const x = (rnd() * 2 - 1) * (H - 2), z = biome.minZ + 4 + rnd() * (BIOME_DEPTH - 8);
        if (Math.hypot(x - nest.x, z - nest.z) < NEST_RADIUS + 1) continue;
        const s = 0.25 + rnd() * 0.35;
        glow.box(x, 0, z, s, 0.08, s, pick(['#ffffff', '#c8a8ff', '#9a6aff', '#7fe8ff']));
      }
      // floating shards
      for (let i = 0; i < more(40); i++) {
        const p = ctx.spot(1.5, rnd() < 0.5);
        if (!p) continue;
        glow.box(p.x, 3 + rnd() * 22, p.z, 0.6 + rnd(), 2 + rnd() * 3, 0.6 + rnd(), pick(['#6a3aff', '#9a6aff', '#c8a8ff']), { rx: rnd() * 2, ry: rnd() * 2, rz: rnd() * 2 });
      }
    },
    landmarks(ctx) {
      const { v, glow, rnd } = ctx;
      // black monoliths with glowing edges
      for (let i = 0; i < more(5); i++) {
        const p = ctx.spot(3, true);
        if (!p) continue;
        const h = 14 + rnd() * 8, ry = rnd() * 0.6;
        v.box(p.x, 0, p.z, 4, h, 2, '#05040a', { ry });
        glow.box(p.x, 0, p.z, 4.2, 0.3, 2.2, '#6a3aff', { ry });
        glow.box(p.x, h - 0.3, p.z, 4.2, 0.4, 2.2, '#9a6aff', { ry });
        glow.box(p.x, h + 2, p.z, 1.4, 1.4, 1.4, '#c8a8ff', { rx: 0.6, rz: 0.6 });
        ctx.circle(p.x, p.z, 2.6);
      }
    },
    small(ctx, x, z) {
      const { v, glow, rnd, pick } = ctx;
      const k = rnd();
      if (k < 0.5) spikeCluster(v, ctx, x, z, 2 + rnd() * 3, 0.9, ['#1a1428', '#241c36', '#0d0a14'], 3);
      else if (k < 0.8) for (let i = 0; i < 3; i++) glow.box(x + (rnd() - 0.5) * 3, 0, z + (rnd() - 0.5) * 3, 2 + rnd() * 2, 0.06, 0.25, pick(['#6a3aff', '#9a6aff']), { ry: rnd() * 3 });
      else glow.box(x, 1.5 + rnd() * 2, z, 1, 1, 1, '#c8a8ff', { rx: rnd(), rz: rnd() });
    },
  },
};

// From the second stage on the decor is drawn DECOR_K times bigger, to match the first stage's big
// pumpkins: every thing put at a random free spot (ctx.spot) grows round that spot (its boxes within
// GROW_NEAR of it move out from it and get bigger; fixed things like fences and the walls stay as
// they are). The spots keep the bigger things clear of the lane and the walls.
const DECOR_K = 1.9;
const GROW_NEAR = 16;
function grower(target, ctx) {
  return {
    box(x, y, z, w, h, d, color, opts) {
      const g = ctx.grow(x, z);
      if (!g) return target.box(x, y, z, w, h, d, color, opts);
      return target.box(g.x, y * g.k, g.z, w * g.k, h * g.k, d * g.k, color, opts);
    },
  };
}

function addDecor(ctx) {
  const d = DECOR[ctx.biome.id];
  if (!d) return;
  const { v, glow } = ctx;
  const grow = ctx.index > 0 && !d.noGrow;
  if (grow) {
    ctx.decorK = DECOR_K;
    ctx.v = grower(v, ctx);
    ctx.glow = grower(glow, ctx);
  }
  ctx.anchor = null;
  d.features?.(ctx);
  ctx.anchor = null;
  d.landmarks?.(ctx);
  // fewer of the small things (they are bigger now)
  const count = grow ? Math.round(more(d.smallCount) * 0.7) : more(d.smallCount);
  for (let i = 0; i < count; i++) {
    const p = ctx.spot(2.5, ctx.rnd() < 0.7);
    if (p) d.small(ctx, p.x, p.z);
  }
  ctx.v = v;
  ctx.glow = glow;
  ctx.decorK = 1;
  ctx.anchor = null;
}

// ------------------------------------------------------------------ build

// Draws the whole corridor into v / glow (and the arch signs into scene).
// Returns { colliders, signs }: colliders = solid things a player should bump into, as
// { kind: 'circle', x, z, r } or { kind: 'box', minX, maxX, minZ, maxZ } (each with its biome id).
export function buildBiomeCorridor(scene, v, glow, lamps = null) {
  const colliders = [];
  const floors = [];
  BIOMES.forEach((biome, index) => {
    const ctx = makeCtx(v, glow, biome, index, colliders);
    ctx.scene = scene; // for the few live things (the torch fires)
    ctx.lamps = lamps;  // lamps that come on at night
    ctx.floors = floors; // raised floors to walk on (the nests' stages)
    addGround(ctx);
    addSideWalls(ctx);
    if (index > 0) addArch(scene, ctx); // the first stage's way in is the dojo hall (Dojo.js)
    addNest(ctx);
    addEscapeBoard(scene, ctx);
    addDecor(ctx);
    if (index === BIOMES.length - 1) addEndWall(ctx);
  });
  return { colliders, floors };
}
