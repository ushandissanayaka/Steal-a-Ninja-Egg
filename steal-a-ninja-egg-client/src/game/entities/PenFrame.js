// The pen's frame: the pen stands on a raised stage (a little above the ground, with a step all
// round it) and a fence runs round its edge with the gate facing the lobby. Every Upgrade Pen level
// (1-5) changes its look, getting stronger each time:
//   1  a brown wooden ranch fence on an earth-brown stage
//   2  pale stone rails with stud panels, gold posts, on an orange-brown stage (like the video)
//   3  white stone rails, blue posts with gold caps, on a slate stage
//   4  dark rails, red posts, on a deep red stage
//   5  ivory rails, gold posts, on a royal purple stage
// From level 2 the four corner posts are thicker and taller than the rest, more so every level, with
// a cap block on top. Each level has a small accent colour (a line along the top rail and bands on the
// corner posts); everything is matte (no shine).

import { PLOT } from '../../shared/gameData.js';

export const PEN_RISE = 1.0;   // the stage's height (pen units)
const STAGE_PAD = 2;           // the stage reaches this far past the fence
const STEP_PAD = 2;            // and the step this much further

const LOOKS = [
  null,
  { rail: '#8a4b2b', panel: '#6e3a20', kick: '#b8723c', post: '#5e311a', cap: '#7a4326', stage: '#7a5034', step: '#5e3a24', accent: null },
  { rail: '#efe6d2', panel: '#d6ccb4', kick: '#e6dcc4', post: '#d8a23a', cap: '#c08a2a', stage: '#c8642a', step: '#a04e20', accent: '#ffd84a' },
  { rail: '#eef2f6', panel: '#d2dae4', kick: '#e4eaf0', post: '#2f6ad6', cap: '#ffd84a', stage: '#3a4a6a', step: '#2a3650', accent: '#7fd8ff' },
  { rail: '#2e2e3a', panel: '#454556', kick: '#3a3a48', post: '#c8162a', cap: '#ffcc33', stage: '#6a1a16', step: '#4a100e', accent: '#ff8a1a' },
  { rail: '#f6f2e4', panel: '#e2dcc6', kick: '#ece6d2', post: '#ffcc33', cap: '#fff0a0', stage: '#4a2a7a', step: '#341c58', accent: '#c89bff' },
];
export const MAX_FRAME_LEVEL = LOOKS.length - 1;

// The fence's sides: [ax, az, bx, bz] (the front has the open gate in the middle)
export function fenceSides() {
  const { penMinX, penMaxX, penHalfZ, gateHalf } = PLOT;
  return [
    [penMinX, -penHalfZ, penMaxX, -penHalfZ],
    [penMinX, penHalfZ, penMaxX, penHalfZ],
    [penMinX, -penHalfZ, penMinX, penHalfZ],
    [penMaxX, -penHalfZ, penMaxX, -gateHalf],
    [penMaxX, gateHalf, penMaxX, penHalfZ],
  ];
}

// The stage's top and its step: [minX, maxX, minZ, maxZ, height] (pen units)
export function stageFloors() {
  const { penMinX, penMaxX, penHalfZ } = PLOT;
  const s = STAGE_PAD, t = STAGE_PAD + STEP_PAD;
  return [
    [penMinX - s, penMaxX + s, -penHalfZ - s, penHalfZ + s, PEN_RISE],
    [penMinX - t, penMaxX + t, -penHalfZ - t, penHalfZ + t, PEN_RISE * 0.5],
  ];
}

const isCorner = (x, z) => {
  const { penMinX, penMaxX, penHalfZ } = PLOT;
  return (Math.abs(x - penMinX) < 0.01 || Math.abs(x - penMaxX) < 0.01) && Math.abs(Math.abs(z) - penHalfZ) < 0.01;
};

function addSide(v, [ax, az, bx, bz], look, level) {
  const y0 = PEN_RISE;
  const horizontal = az === bz;
  const length = horizontal ? Math.abs(bx - ax) : Math.abs(bz - az);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const rail = (y, h, t, color) => v.box(cx, y0 + y, cz, horizontal ? length : t, h, horizontal ? t : length, color);
  const thick = level >= 2 ? 1.1 : 0.8;
  rail(0, 0.5, 1.6, look.kick);
  rail(1.4, 1.2, thick, look.rail);
  rail(3.2, 1.2, thick, look.rail);
  if (level >= 2) {
    // stud panels set into both rails, both faces
    for (let d = 1.2; d < length - 0.6; d += 2.2) {
      for (const y of [1.65, 3.45]) {
        for (const f of [-1, 1]) {
          const px = horizontal ? Math.min(ax, bx) + d : cx + f * (thick / 2 + 0.02);
          const pz = horizontal ? cz + f * (thick / 2 + 0.02) : Math.min(az, bz) + d;
          v.box(px, y0 + y, pz, horizontal ? 1.3 : 0.08, 0.7, horizontal ? 0.08 : 1.3, look.panel);
        }
      }
    }
  } else rail(3.2, 0.25, 0.9, look.panel); // the wooden fence's darker edge under the top rail
  if (look.accent) rail(4.4, 0.18, thick + 0.1, look.accent);
  // the posts: the corners stronger than the rest from the second level on
  const posts = Math.max(1, Math.round(length / 14));
  for (let i = 0; i <= posts; i++) {
    const k = i / posts;
    const px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
    if (level >= 2 && isCorner(px, pz)) continue; // drawn once, big (see corners)
    v.box(px, y0, pz, 1.5, 4.8, 1.5, look.post);
    v.box(px, y0 + 4.8, pz, 1.8, 0.4, 1.8, look.cap);
  }
}

function addCorners(v, look, level) {
  const { penMinX, penMaxX, penHalfZ } = PLOT;
  const k = level - 1;                    // 1..4
  const w = 1.5 * (1 + 0.32 * k), h = 4.8 * (1 + 0.24 * k);
  for (const x of [penMinX, penMaxX]) {
    for (const z of [-penHalfZ, penHalfZ]) {
      v.box(x, PEN_RISE, z, w + 0.6, 0.6, w + 0.6, look.cap);           // a wide foot
      v.box(x, PEN_RISE + 0.6, z, w, h - 0.6, w, look.post);
      for (const y of [h * 0.35, h * 0.7]) v.box(x, PEN_RISE + y, z, w + 0.12, 0.3, w + 0.12, look.accent || look.cap);
      v.box(x, PEN_RISE + h, z, w + 0.5, 0.5, w + 0.5, look.cap);       // the cap
      v.box(x, PEN_RISE + h + 0.5, z, w * 0.6, w * 0.45, w * 0.6, look.post); // the block on top
    }
  }
}

// The whole frame at a level (1..5), drawn into v (pen units, the plot's own frame).
export function buildPenFrame(v, level = 1) {
  const L = Math.max(1, Math.min(MAX_FRAME_LEVEL, level || 1));
  const look = LOOKS[L];
  const { penMinX, penMaxX, penHalfZ } = PLOT;
  const cx = (penMinX + penMaxX) / 2, w = penMaxX - penMinX, d = penHalfZ * 2;
  // the step all round, the stage on it, the grass on top inside, a strip of the stage colour under the fence
  const [stage, step] = stageFloors();
  v.box(cx, 0, 0, step[1] - step[0], step[4], step[3] - step[2], look.step);
  v.box(cx, 0, 0, stage[1] - stage[0], stage[4], stage[3] - stage[2], look.stage);
  v.box(cx, PEN_RISE - 0.04, 0, w - 1.4, 0.08, d - 1.4, '#78d43c');
  for (const s of fenceSides()) {
    const [ax, az, bx, bz] = s;
    v.box((ax + bx) / 2, PEN_RISE, (az + bz) / 2, Math.abs(bx - ax) + 2.4, 0.1, Math.abs(bz - az) + 2.4, look.stage);
    addSide(v, s, look, L);
  }
  if (L >= 2) addCorners(v, look, L);
}
