// A player's plot (like the video): a fenced rectangle of brown wooden ranch fence (two chunky
// rails on square posts, a kick board along the ground) with an open gate facing the dojo. Inside: straw nests where stolen eggs grow (a timer over
// each, "Hold E!" when ready) and the hatched pets wandering about. Outside, beside the gate: the
// treadmill and its Unlock / Upgrade board. An unowned plot says "Empty Plot".

import * as THREE from 'three';
import { Voxels } from '../util/bake.js';
import { makeBillboard, makeTextPlane } from '../util/canvasText.js';
import { EGG_SIZES, TREADMILLS, PLOT, PLOT_SCALE, RARITY_COLOR, RULES, eggName, formatNumber, nextTreadmill, plotToWorld, treadmillById } from '../../shared/gameData.js';
import { FRAME_HEIGHT, FRAME_POST_X, FRAME_Z, TREADMILL_BELT, TREADMILL_HALF, TreadmillView } from './Treadmill.js';
import { createEgg } from './Egg.js';
import { PetPen } from './PetDisplay.js';
import { OwnerSign } from './OwnerSign.js';
import { createGlow } from './Effects.js';

const OWNER_SIGN_HEIGHT = 10; // the owner's board, a little wider than the treadmill frame it stands on

const RAIL = '#8a4b2b';
const RAIL_DARK = '#6e3a20';
const POST = '#5e311a';
const POST_CAP = '#7a4326';
const KICK = '#b8723c';     // the lighter plank along the bottom
const STRAW = ['#e8c25a', '#d6a83e'];
const EGG_GROW_FROM = 0.9;  // just put down...
const EGG_GROW_TO = 2.4;    // ...ready to hatch: well over twice as big

const parse = (json) => {
  try { return JSON.parse(json); } catch { return []; }
};
const clockText = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// One side of the fence: two chunky brown rails between square posts, a light kick board along
// the ground (the video's wooden ranch fence).
function addFence(v, ax, az, bx, bz, colliders) {
  const horizontal = az === bz;
  const length = horizontal ? Math.abs(bx - ax) : Math.abs(bz - az);
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const rail = (y, h, t, color) => v.box(cx, y, cz, horizontal ? length : t, h, horizontal ? t : length, color);
  rail(0, 0.5, 1.6, KICK);
  rail(1.5, 1.0, 0.8, RAIL);
  rail(3.3, 1.0, 0.8, RAIL);
  rail(3.3, 0.25, 0.9, RAIL_DARK); // a darker edge under the top rail
  const posts = Math.max(1, Math.round(length / 14));
  for (let i = 0; i <= posts; i++) {
    const k = i / posts;
    const px = ax + (bx - ax) * k, pz = az + (bz - az) * k;
    v.box(px, 0, pz, 1.5, 4.8, 1.5, POST);
    v.box(px, 4.8, pz, 1.8, 0.4, 1.8, POST_CAP);
  }
  colliders.push([Math.min(ax, bx) - 0.7, Math.max(ax, bx) + 0.7, Math.min(az, bz) - 0.7, Math.max(az, bz) + 0.7, 5]);
}

// A round straw nest where an egg sits while it grows.
function addStrawNest(v, x, z) {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    v.box(x + Math.cos(a) * 2.6, 0, z + Math.sin(a) * 2.6, 1.6, 0.9, 1, STRAW[i % 2], { ry: -a });
  }
  v.box(x, 0, z, 4, 0.35, 4, STRAW[1]);
}

// The board on two legs beside the treadmill: "Unlock: $1K" / "Upgrade $9K".
function addSignBoard(v, x, z) {
  for (const s of [-1, 1]) v.box(x, 0, z + s * 3, 0.7, 5, 0.7, POST);
  v.box(x, 4.4, z, 0.8, 4.4, 8.6, '#1f3fa8');
  v.box(x, 4.2, z, 0.6, 4.8, 9, '#14275e');
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
    this.pens = new PetPen(this.group);
    this.eggs = [];      // [{ mesh, glow, key }] per slot
    this.penKey = '';
    // the owner's board stands on top of the treadmill's wooden (later stone) gate frame, by the pen's gate
    this.ownerSign = new OwnerSign(this.group, new THREE.Vector3(PLOT.treadmill.x, FRAME_HEIGHT + 3.4 + OWNER_SIGN_HEIGHT / 2, PLOT.treadmill.z + FRAME_Z), OWNER_SIGN_HEIGHT);
    this.time = index * 1.7;
  }

  buildStatic(physics) {
    const v = new Voxels();
    const boxes = [];
    const { penMinX, penMaxX, penHalfZ, gateHalf } = PLOT;
    addFence(v, penMinX, -penHalfZ, penMaxX, -penHalfZ, boxes);
    addFence(v, penMinX, penHalfZ, penMaxX, penHalfZ, boxes);
    addFence(v, penMinX, -penHalfZ, penMinX, penHalfZ, boxes);
    // the front: two sections with the open gate between them
    addFence(v, penMaxX, -penHalfZ, penMaxX, -gateHalf, boxes);
    addFence(v, penMaxX, gateHalf, penMaxX, penHalfZ, boxes);
    for (const slot of PLOT.eggSlots) addStrawNest(v, slot.x, slot.z);
    addSignBoard(v, PLOT.treadmillSign.x, PLOT.treadmillSign.z);
    this.group.add(v.mesh());

    const { x: tx, z: tz } = PLOT.treadmill;
    boxes.push([tx - TREADMILL_HALF.x, tx + TREADMILL_HALF.x, tz - TREADMILL_HALF.z, tz - TREADMILL_BELT.backZ, 6]);
    const beltA = plotToWorld(this.plot, tx - TREADMILL_BELT.halfX, tz - TREADMILL_BELT.backZ);
    const beltB = plotToWorld(this.plot, tx + TREADMILL_BELT.halfX, tz + TREADMILL_BELT.frontZ);
    physics.addSurface(beltA.x, beltB.x, beltA.z, beltB.z, TREADMILL_BELT.height * PLOT_SCALE, this.plot.rot + Math.PI);
    // the treadmill's frame posts
    for (const side of [-1, 1]) boxes.push([tx + side * FRAME_POST_X - 1.3, tx + side * FRAME_POST_X + 1.3, tz + FRAME_Z - 1.3, tz + FRAME_Z + 1.3, Infinity]);
    const s = PLOT.treadmillSign;
    boxes.push([s.x - 0.6, s.x + 0.6, s.z - 4.5, s.z + 4.5, 9]);
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
    this.penGlow.position.set((PLOT.penMinX + PLOT.penMaxX) / 2, 3, 0);
    this.penGlow.renderOrder = 2;
    this.penGlow.visible = false;
    this.group.add(this.penGlow);
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

  sync(state, mine, owner = null, carrying = false) {
    this.ownerSign.set(owner);
    const petsJson = state ? state.pets : '';
    if (petsJson !== this.petsKey) {
      this.petsKey = petsJson;
      this.pens.sync(state ? parse(state.pets) : []);
    }
    if (!state) this.pens.clear();
    this.billboard('empty', state ? '' : 'empty', state ? null : [{ text: 'Empty Plot', size: 80, fill: '#ffffff' }], 5,
      (PLOT.penMinX + PLOT.penMaxX) / 2, 9, 0);

    const penJson = state?.pen || '[]';
    if (penJson !== this.penKey) {
      this.penKey = penJson;
      this.showPen(parse(penJson), mine);
    }
    this.syncTreadmill(state, mine);
    this.penGlow.visible = !!(mine && carrying);
  }

  // The eggs growing in the nests, each with its timer, or "Hold E!" once it is ready.
  showPen(list, mine) {
    PLOT.eggSlots.forEach((slot, i) => {
      const egg = list[i];
      const have = this.eggs[i];
      const key = egg ? `${egg.type}|${egg.rarity}|${egg.size}|${egg.kg}` : '';
      if (have && have.key !== key) {
        this.group.remove(have.mesh, have.glow);
        if (!egg) this.effects.burst(this.localToWorld(slot.x, 3, slot.z), '#fff6c8', 26, 22); // hatched
        this.eggs[i] = null;
      }
      if (egg && !this.eggs[i]) {
        const mesh = createEgg(egg);
        mesh.position.set(slot.x, 0.3, slot.z);
        const glow = createGlow('#f6ffd8', 7);
        glow.position.set(slot.x, 2.4, slot.z);
        this.group.add(mesh, glow);
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
      this.billboard(`egg${i}`, `${ready}|${lines[1].text}|${lines[0].text}`, lines, 2.6, slot.x, 7.5 * Math.min(1.6, e?.size || 1), slot.z);
    });
  }

  syncTreadmill(state, mine) {
    const millId = state?.treadmill || 'none';
    const mill = treadmillById(millId);
    this.treadmill.sync(state);
    const next = state ? nextTreadmill(millId) : null;
    const level = TREADMILLS.indexOf(mill);
    const { x, z } = PLOT.treadmillSign;
    const signKey = state ? `${millId}|${mine}` : '';
    this.setLabel('sign', signKey, state && (() => {
      const lines = !next ? [{ text: 'MAX', size: 90, fill: '#ffd21f' }]
        : mill.gain ? [
          { text: 'Upgrade', size: 66, fill: '#ffffff' },
          { text: `Level ${level} > Level ${level + 1}`, size: 40, fill: '#7dff3f' },
          { text: `$${formatNumber(next.price)}`, size: 72, fill: '#ff5a5a' },
        ] : [{ text: 'Unlock:', size: 70, fill: '#ffffff' }, { text: `$${formatNumber(next.price)}`, size: 84, fill: '#7dff3f' }];
      const plane = makeTextPlane(lines, mill.gain && next ? 4.4 : 3.8, { side: THREE.DoubleSide });
      plane.position.set(x + 0.5, 6.6, z);
      plane.rotation.y = Math.PI / 2; // facing the lane
      return plane;
    }));
  }

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
    const at = this.localToWorld(s.x, 2, s.z);
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
