// The biome corridor north of the safe zone: ten walled stages one after another, each with its
// own checkered ground, tall checker-block walls with a plateau on top, an entrance arch with a
// sign, the dirt nest the guardian sleeps on, and themed decor along the sides.
//
// Everything static goes into the ChunkedVoxels `v` (lit) and `glow` (unlit: lava, neon, crystals).
// Only the arch signs (canvas text planes) go into the scene directly.

import * as THREE from 'three';
import { makeTextPlane } from '../util/canvasText.js';
import { BIOMES, BIOME_DEPTH, DIFFICULTY_COLOR, GUARDIANS, NESTS, NEST_RADIUS, WORLD, formatNumber } from '../../shared/gameData.js';

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
    style: BIOME_STYLE[biome.id],
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
  const a = ARCH_STYLE[biome.id];
  const x = nest.x - nest.side * 6, z = nest.z + NEST_RADIUS + 3;
  for (const s of [-1, 1]) {
    v.box(x + s * (BOARD_W / 2 - 1.5), 0, z - 0.6, 1.3, BOARD_Y + BOARD_H + 0.6, 1.3, '#3a2414');
    ctx.rect(x + s * (BOARD_W / 2 - 1.5) - 0.8, x + s * (BOARD_W / 2 - 1.5) + 0.8, z - 1.4, z + 0.2);
  }
  v.box(x, BOARD_Y - 0.5, z, BOARD_W + 1, BOARD_H + 1, 0.7, a.trim);
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
  const a = ARCH_STYLE[biome.id];
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

function addNest(ctx) {
  const { v, rnd, nest, biome } = ctx;
  const ns = NEST_STYLE[biome.id];
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

// Each biome: big landmark pieces (with colliders), long features, then `small` pieces scattered.
// small(ctx, x, z) draws one small piece; smallCount is how many.
const DECOR = {
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
  if (ctx.index > 0) {
    ctx.decorK = DECOR_K;
    ctx.v = grower(v, ctx);
    ctx.glow = grower(glow, ctx);
  }
  ctx.anchor = null;
  d.features?.(ctx);
  ctx.anchor = null;
  d.landmarks?.(ctx);
  // fewer of the small things (they are bigger now)
  const count = ctx.index > 0 ? Math.round(more(d.smallCount) * 0.7) : more(d.smallCount);
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
export function buildBiomeCorridor(scene, v, glow) {
  const colliders = [];
  BIOMES.forEach((biome, index) => {
    const ctx = makeCtx(v, glow, biome, index, colliders);
    addGround(ctx);
    addSideWalls(ctx);
    if (index > 0) addArch(scene, ctx); // the first stage's way in is the dojo hall (Dojo.js)
    addNest(ctx);
    addEscapeBoard(scene, ctx);
    addDecor(ctx);
    if (index === BIOMES.length - 1) addEndWall(ctx);
  });
  return { colliders };
}
