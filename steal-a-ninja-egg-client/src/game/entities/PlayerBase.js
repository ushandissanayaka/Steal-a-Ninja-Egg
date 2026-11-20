// A player's plot (like the video): a fenced rectangle of brown wooden ranch fence (two chunky
// rails on square posts, a kick board along the ground) with an open gate facing the dojo. Inside: the stolen eggs growing right on the grass (a timer over
// each, "Hold E!" when ready) and the hatched pets wandering about. Outside, beside the gate: the
// round training arena with its "Upgrade Arena" board, and on the other side of the gate the
// "Upgrade Pen" board (more egg slots). An unowned plot says "Empty Plot".

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { canvasTexture, drawOutlinedText, FONT_TITLE, FONT_UI, makeBillboard } from '../util/canvasText.js';
import {
  ARENA, EGG_SIZES, penSlotOf, MAX_PEN_LEVEL, PLOT, PLOT_SCALE, RARITY_COLOR, RULES, eggName, formatNumber, nextPenLevel, nextTreadmill, plotToWorld, treadmillById,
} from '../../shared/gameData.js';
import { ARENA_BLOCK, TreadmillView, arenaColor, arenaWallBlocks } from './Treadmill.js';
import { PEN_RISE, buildPenFrame, fenceSides, stageFloors } from './PenFrame.js';
import { createEgg } from './Egg.js';
import { PetPen } from './PetDisplay.js';
import { OwnerSign } from './OwnerSign.js';
import { createGlow } from './Effects.js';

const OWNER_SIGN_HEIGHT = 10; // the owner's board, a little wider than the treadmill frame it stands on

const EGG_GROW_FROM = 0.9;  // just put down...
const EGG_GROW_TO = 2.4;    // ...ready to hatch: well over twice as big

const parse = (json) => {
  try { return JSON.parse(json); } catch { return []; }
};
const clockText = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// A navy board on a thick dark post, facing the lobby (+x): "Upgrade Arena" / "Upgrade Pen".
const BOARD = { w: 9, h: 5.2, y: 3.6 };
function addSignBoard(v, x, z) {
  v.box(x - 0.3, 0, z, 1.1, BOARD.y + 1, 1.1, '#1a1f3a');
  v.box(x - 0.3, 0, z, 2.2, 0.5, 2.2, '#14182e');
  v.box(x, BOARD.y, z, 0.7, BOARD.h + 0.4, BOARD.w + 0.4, '#101430');
}

// The board's face: a title, a line under it and a green cash button with the price (like the video).
const BOARD_PX = 96; // canvas pixels per plot unit
function drawBoard({ title, line, lineColor = '#9fe7ff', price, done }) {
  const c = document.createElement('canvas');
  c.width = BOARD.w * BOARD_PX;
  c.height = BOARD.h * BOARD_PX;
  const g = c.getContext('2d');
  const W = c.width, Hh = c.height;
  const grad = g.createLinearGradient(0, 0, 0, Hh);
  grad.addColorStop(0, '#24306e');
  grad.addColorStop(1, '#141a46');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, Hh);
  g.strokeStyle = '#3a4a9a';
  g.lineWidth = 10;
  g.strokeRect(10, 10, W - 20, Hh - 20);
  drawOutlinedText(g, title, W / 2, Hh * 0.2, { size: 92, fill: '#ffffff', stroke: '#0a0c20', strokeWidth: 12, font: FONT_TITLE, weight: 400, glow: false });
  drawOutlinedText(g, line, W / 2, Hh * 0.42, { size: 56, fill: lineColor, stroke: '#0a0c20', strokeWidth: 9, font: FONT_UI, weight: 800, glow: false });
  // the button
  const bw = W * 0.62, bh = Hh * 0.3, bx = (W - bw) / 2, by = Hh * 0.58;
  g.fillStyle = done ? '#ffb21f' : '#2fbf3a';
  g.beginPath();
  g.roundRect(bx, by, bw, bh, 26);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.roundRect(bx + 8, by + 6, bw - 16, bh * 0.38, 20);
  g.fill();
  g.strokeStyle = done ? '#7a4a00' : '#145a1a';
  g.lineWidth = 8;
  g.beginPath();
  g.roundRect(bx, by, bw, bh, 26);
  g.stroke();
  drawOutlinedText(g, done ? 'MAX' : `💵 $${formatNumber(price)}`, W / 2, by + bh / 2 + 4, { size: 84, fill: '#ffffff', stroke: '#0a2a0c', strokeWidth: 12, font: FONT_TITLE, weight: 400, glow: false });
  return c;
}

// The green button on a board face, in its UV space (see drawBoard: 62% wide, from 58% to 88% down).
const BUTTON_UV = { u0: 0.19, u1: 0.81, v0: 0.12, v1: 0.42 };
export const onBoardButton = (uv) => uv && uv.x >= BUTTON_UV.u0 && uv.x <= BUTTON_UV.u1 && uv.y >= BUTTON_UV.v0 && uv.y <= BUTTON_UV.v1;

function boardMesh(canvas, x, z, buy = null) {
  const tex = canvasTexture(canvas);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), new THREE.MeshBasicMaterial({ map: tex }));
  mesh.position.set(x + 0.37, BOARD.y + 0.2 + BOARD.h / 2, z);
  mesh.rotation.y = Math.PI / 2; // facing the lobby
  mesh.userData.buy = buy; // the message its green button sends (see Game's click)
  return mesh;
}

export class PlotView {
  constructor(index, plot, scene, physics, effects) {
    this.index = index;
    this.plot = plot;
    this.effects = effects;
    this.group = new THREE.Group();
    this.group.position.set(plot.x, 0, plot.z);
    this.group.rotation.y = plot.rot;
    this.group.scale.setScalar(PLOT_SCALE);
    scene.add(this.group);

    this.buildStatic(physics);
    this.treadmill = new TreadmillView(this.group, PLOT.treadmill.x, PLOT.treadmill.z);

    this.labels = {};
    // the pen's floor is up on its stage: the eggs and the ninjas stand on it
    this.penFloor = new THREE.Group();
    this.penFloor.position.y = PEN_RISE;
    this.group.add(this.penFloor);
    this.pens = new PetPen(this.penFloor);
    this.eggs = [];      // [{ mesh, glow, key }] per slot
    this.penKey = '';
    // the owner's board floats high over the pen's gate (like the video's "ushand99's Base")
    this.ownerSign = new OwnerSign(this.group, new THREE.Vector3(PLOT.penMaxX - 6, 20 + OWNER_SIGN_HEIGHT / 2, 0), OWNER_SIGN_HEIGHT);
    this.time = index * 1.7;
  }

  buildStatic(physics) {
    const v = new Voxels();
    const boxes = [];
    // the fence (its look comes with the Upgrade Pen level: setFrameLevel); its walls stop you here
    for (const [ax, az, bx, bz] of fenceSides()) {
      boxes.push([Math.min(ax, bx) - 0.7, Math.max(ax, bx) + 0.7, Math.min(az, bz) - 0.7, Math.max(az, bz) + 0.7, 5 + PEN_RISE]);
    }
    // the stage and its step: you walk up onto them
    for (const [a, b, c, d, h] of stageFloors()) {
      const p = plotToWorld(this.plot, a, c), q = plotToWorld(this.plot, b, d);
      physics.addFloor(p.x, q.x, p.z, q.z, h * PLOT_SCALE);
    }
    this.setFrameLevel(1);
    addSignBoard(v, PLOT.treadmillSign.x, PLOT.treadmillSign.z);
    addSignBoard(v, PLOT.penSign.x, PLOT.penSign.z);
    this.group.add(v.mesh());

    // the training arena: a round raised floor inside a low wall you can jump over (or walk in by the door)
    const { x: tx, z: tz } = PLOT.treadmill;
    const mid = plotToWorld(this.plot, tx, tz);
    const door = plotToWorld(this.plot, tx + Math.cos(ARENA.door), tz + Math.sin(ARENA.door));
    physics.addRoundSurface(mid.x, mid.z, ARENA.wall * PLOT_SCALE, ARENA.height * PLOT_SCALE, {
      floorR: ARENA.floor * PLOT_SCALE, doorAngle: Math.atan2(door.z - mid.z, door.x - mid.x), plot: this.index,
    });
    const half = ARENA_BLOCK / 2;
    for (const [bx, bz] of arenaWallBlocks()) boxes.push([tx + bx - half, tx + bx + half, tz + bz - half, tz + bz + half, ARENA.wallHeight + 0.3]);
    for (const s of [PLOT.treadmillSign, PLOT.penSign]) boxes.push([s.x - 0.8, s.x + 0.6, s.z - 4.7, s.z + 4.7, 9]);
    for (const [a, b, c, d, top] of boxes) {
      const p = plotToWorld(this.plot, a, c);
      const q = plotToWorld(this.plot, b, d);
      physics.addBox(p.x, q.x, p.z, q.z, top * PLOT_SCALE);
    }

    // a see-through green column over the pen while you bring an egg home
    const w = PLOT.penMaxX - PLOT.penMinX;
    this.penGlow = new THREE.Mesh(new THREE.BoxGeometry(w, 6, PLOT.penHalfZ * 2), new THREE.MeshBasicMaterial({
      color: '#3dff6a', transparent: true, opacity: 0.16, depthWrite: false,
    }));
    this.penGlow.position.set((PLOT.penMinX + PLOT.penMaxX) / 2, 3 + PEN_RISE, 0);
    this.penGlow.renderOrder = 2;
    this.penGlow.visible = false;
    this.group.add(this.penGlow);
  }

  // The pen's frame at this Upgrade Pen level (rebuilt only when the level changes).
  setFrameLevel(level) {
    if (level === this.frameLevel) return;
    this.frameLevel = level;
    if (this.frame) {
      this.group.remove(this.frame);
      this.frame.geometry.dispose();
    }
    const v = new Voxels();
    buildPenFrame(v, level);
    this.frame = v.mesh();
    this.group.add(this.frame);
  }

  // Replaces a text label; does nothing while its text is unchanged.
  setLabel(slot, key, make) {
    const old = this.labels[slot];
    if (old?.key === key) return;
    if (old) {
      this.group.remove(old.object);
      old.object.material.map?.dispose();
      old.object.material.dispose();
      if (!old.object.isSprite) old.object.geometry?.dispose();
    }
    if (!make) return void delete this.labels[slot];
    const object = make();
    this.group.add(object);
    this.labels[slot] = { key, object };
  }

  billboard(slot, key, lines, height, x, y, z) {
    this.setLabel(slot, key, lines && (() => {
      const sprite = makeBillboard(lines, height, { renderOrder: 6 });
      sprite.position.set(x, y, z);
      return sprite;
    }));
  }

  localToWorld(x, y, z) {
    return this.group.localToWorld(new THREE.Vector3(x, y, z));
  }

  // How many of this pen's ninjas are shown (Game.updatePenViews: from the device and connection, and
  // only for your own pen and the two nearest others; 0 hides them all, so they cost nothing). The
  // newest ones show, so a ninja that just hatched always pops out of its egg.
  setPetLimit(limit) {
    if (limit === this.petLimit) return;
    this.petLimit = limit;
    this.applyPets();
  }

  applyPets() {
    const json = this.petsJson || '';
    const limit = this.petLimit ?? Infinity;
    const key = `${json}|${limit}`;
    if (key === this.petsKey) return;
    this.petsKey = key;
    const all = json ? parse(json) : [];
    this.pens.sync(limit >= all.length ? all : limit > 0 ? all.slice(-limit) : []);
  }

  sync(state, mine, owner = null, carrying = false) {
    this.ownerSign.set(owner);
    this.petsJson = state ? state.pets : '';
    this.applyPets();
    if (!state) this.pens.clear();
    this.billboard('empty', state ? '' : 'empty', state ? null : [{ text: 'Empty Plot', size: 80, fill: '#ffffff' }], 5,
      (PLOT.penMinX + PLOT.penMaxX) / 2, 9, 0);

    const penJson = state?.pen || '[]';
    if (penJson !== this.penKey) {
      this.penKey = penJson;
      this.showPen(parse(penJson), mine);
    }
    this.setFrameLevel(state?.penLevel || 1); // the frame grows stronger with every Upgrade Pen
    this.syncTreadmill(state, mine);
    this.penGlow.visible = !!(mine && carrying);
  }

  // The eggs growing in the nests, each with its timer, or "Hold E!" once it is ready.
  showPen(list, mine) {
    // each egg sits in its own nest (its slot), not in list order
    const bySlot = [];
    list.forEach((e, k) => { bySlot[penSlotOf(e, k)] = e; });
    PLOT.eggSlots.forEach((slot, i) => {
      const egg = bySlot[i];
      const have = this.eggs[i];
      const key = egg ? `${egg.type}|${egg.rarity}|${egg.size}|${egg.kg}` : '';
      if (have && have.key !== key) {
        this.penFloor.remove(have.mesh, have.glow);
        if (!egg) this.effects.burst(this.localToWorld(slot.x, 3 + PEN_RISE, slot.z), '#fff6c8', 26, 22); // hatched
        this.eggs[i] = null;
      }
      if (egg && !this.eggs[i]) {
        const mesh = createEgg(egg);
        mesh.position.set(slot.x, 0, slot.z); // right on the grass of the pen
        const glow = createGlow('#f6ffd8', 7);
        glow.position.set(slot.x, 2.4, slot.z);
        this.penFloor.add(mesh, glow);
        this.eggs[i] = { mesh, glow, key, size: EGG_SIZES[egg.size || 1]?.scale || 1 };
      }
      const e = this.eggs[i];
      if (e) {
        e.progress = egg.grow ? 1 - egg.left / egg.grow : 1;
        e.ready = egg.left <= 0;
      }
      if (!egg) return void this.billboard(`egg${i}`, '', null);
      const ready = egg.left <= 0;
      const lines = ready
        ? [{ text: eggName(egg), size: 46, fill: RARITY_COLOR[egg.rarity] }, { text: mine ? 'Hold E!' : 'Ready!', size: 60, fill: '#ffe14a' }]
        : [{ text: eggName(egg), size: 46, fill: RARITY_COLOR[egg.rarity] }, { text: clockText(egg.left), size: 62, fill: '#ffffff' }];
      this.billboard(`egg${i}`, `${ready}|${lines[1].text}|${lines[0].text}`, lines, 2.6, slot.x, PEN_RISE + 7.5 * Math.min(1.6, e?.size || 1), slot.z);
    });
  }

  // The arena and its "Upgrade Arena" board, and the "Upgrade Pen" board.
  syncTreadmill(state, mine) {
    const millId = state?.treadmill || 'none';
    const mill = treadmillById(millId);
    this.treadmill.sync(state);
    const next = state ? nextTreadmill(millId) : null;
    const { x, z } = PLOT.treadmillSign;
    this.setLabel('sign', state ? `${millId}|${mine}` : '', state && (() => boardMesh(drawBoard({
      title: mill.gain ? 'Upgrade Arena' : 'Unlock Arena',
      line: next ? (mill.gain ? `${mill.name.replace(' Arena', '')} > ${next.name.replace(' Arena', '')}` : next.name) : mill.name,
      lineColor: arenaColor(next?.id || millId),
      price: next?.price || 0,
      done: !next,
    }), x, z, mine && next ? 'buyTreadmill' : null)));
    const level = Math.min(MAX_PEN_LEVEL, state?.penLevel || 1);
    const nextPen = state ? nextPenLevel(level) : null;
    const p = PLOT.penSign;
    this.setLabel('penSign', state ? `${level}|${mine}` : '', state && (() => boardMesh(drawBoard({
      title: 'Upgrade Pen',
      line: nextPen ? `Lv. ${level} > Lv. ${nextPen.level}` : `Lv. ${level}`,
      lineColor: '#ffffff',
      price: nextPen?.price || 0,
      done: !nextPen,
    }), p.x, p.z, mine && nextPen ? 'buyPen' : null)));
  }

  // The boards (to click their green buttons).
  boards() {
    return ['sign', 'penSign'].map((k) => this.labels[k]?.object).filter(Boolean);
  }

  // Is someone spinning in this arena? (the floor's arrows race round)
  setSpinning(on) { this.treadmill.setSpinning(on); }

  update(dt) {
    if (this.penGlow.visible) {
      this.glowT = (this.glowT || 0) + dt;
      this.penGlow.material.opacity = 0.12 + Math.sin(this.glowT * 4) * 0.06;
    }
    this.time += dt;
    this.pens.update(dt);
    this.ownerSign.update(dt);
    this.treadmill.update(dt);
    for (const e of this.eggs) {
      if (!e) continue;
      const grown = EGG_GROW_FROM + (EGG_GROW_TO - EGG_GROW_FROM) * Math.min(1, e.progress ?? 0);
      e.mesh.scale.setScalar(grown * e.size);
      e.mesh.rotation.z = e.ready ? Math.sin(this.time * 6) * 0.08 : 0;
      e.glow.scale.setScalar((e.ready ? 9 : 5 + e.progress * 4) + Math.sin(this.time * 4) * 0.8);
      e.glow.material.opacity = e.ready ? 0.55 : 0.25;
    }
  }

  // hatch: a little wobble then burst is done by showPen when the egg goes; the pet pops out of this slot
  // A hatch here: with fancy on (a smooth frame rate and a good connection) a cloud of smoke puffs
  // up where the egg was, magic dust bursts out of it, and the animal steps out once the smoke is up;
  // otherwise a quick sparkle and the animal pops straight out.
  hatchedAt(slot) {
    const s = PLOT.eggSlots[slot] || PLOT.eggSlots[0];
    this.pens.popAt = s;
    const at = this.localToWorld(s.x, 2 + PEN_RISE, s.z);
    if (TreadmillView.fancy) {
      this.effects.smoke(at, '#fff6e8', 16, 7);
      this.effects.magicDust(at.clone().setY(4), 40, 6, 16);
      this.pens.popDelay = 0.55;
    } else {
      this.effects.burst(at, '#fff6c8', 14, 16);
      this.pens.popDelay = 0;
    }
  }
}

export { RULES };
